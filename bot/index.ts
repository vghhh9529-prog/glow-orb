import "dotenv/config";

import {
  ChannelType,
  Client,
  Events,
  GatewayIntentBits,
  Partials,
  type ChatInputCommandInteraction,
  type GuildMember,
  type Message,
  type VoiceState,
} from "discord.js";

import { supabaseAdmin } from "../src/integrations/supabase/client.server";
import {
  handleDiscordInteraction,
  type DiscordInteractionOption,
  type DiscordInteractionPayload,
} from "../src/lib/discord-interactions.server";
import { botToken, registerSlashCommands } from "../src/lib/discord-api.server";
import { MODULE_DEFAULTS, withDefaults } from "../src/lib/module-defaults";
import { type ModuleKey } from "../src/lib/discord";
import { SLASH_COMMANDS } from "../src/lib/slash-commands";

const SITE_URL = (
  process.env["PUBLIC_APP_URL"] ??
  "https://id-preview--fa584a01-062d-40c8-a629-78cea86c73db.lovable.app"
).replace(/\/$/, "");
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

const messageCooldowns = new Map<string, number>();
const voiceCreatedChannels = new Set<string>();

function database() {
  return supabaseAdmin;
}

function replacePlaceholders(
  text: string,
  member: GuildMember,
  values: { level?: number; xp?: number; rank?: number } = {},
) {
  return text
    .replaceAll("{user}", `<@${member.id}>`)
    .replaceAll("{username}", member.user.username)
    .replaceAll("{userid}", member.id)
    .replaceAll("{avatar}", member.user.displayAvatarURL({ extension: "png", size: 256 }))
    .replaceAll("{server}", member.guild.name)
    .replaceAll("{membercount}", String(member.guild.memberCount))
    .replaceAll("{level}", String(values.level ?? 0))
    .replaceAll("{xp}", String(values.xp ?? 0))
    .replaceAll("{rank}", String(values.rank ?? 0));
}

async function moduleConfig<T extends ModuleKey>(guildId: string, module: T) {
  const { data, error } = await database()
    .from("guild_modules")
    .select("enabled, config")
    .eq("guild_id", guildId)
    .eq("module", module)
    .maybeSingle();
  if (error) {
    console.error(
      `[Glow Bot] Failed to load ${module} config for guild ${guildId}: ${error.message}`,
    );
  }
  return {
    enabled: Boolean(data?.enabled),
    config: withDefaults(module, data?.config),
  };
}

async function guildItems(guildId: string, kind: string) {
  const { data, error } = await database()
    .from("guild_items")
    .select("id, name, enabled, data")
    .eq("guild_id", guildId)
    .eq("kind", kind)
    .eq("enabled", true);
  if (error) {
    console.error(`[Glow Bot] Failed to load ${kind} items for guild ${guildId}: ${error.message}`);
  }
  return data ?? [];
}

async function ensureUser(member: GuildMember) {
  const user = member.user;
  await database()
    .from("discord_users")
    .upsert(
      {
        id: user.id,
        username: user.username,
        global_name: user.globalName,
        avatar: user.displayAvatarURL({ extension: "png", size: 128 }),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
  await database()
    .from("glow_wallets")
    .upsert({ user_id: user.id }, { onConflict: "user_id", ignoreDuplicates: true });
}

async function handleWelcome(member: GuildMember) {
  const settings = await moduleConfig(member.guild.id, "welcome");
  if (!settings.enabled) return;
  const config = settings.config;
  const channelId = String(config.channelId ?? "");
  const channel = member.guild.channels.cache.get(channelId);
  if (!channel?.isTextBased()) return;

  const message = replacePlaceholders(
    String(config.message ?? "أهلاً {user} في {server}!"),
    member,
  );
  const embedConfig = (config.embed ?? {}) as Record<string, unknown>;
  const payload: Parameters<typeof channel.send>[0] = { content: message };
  if (embedConfig.enabled) {
    payload.embeds = [
      {
        title: replacePlaceholders(String(embedConfig.title ?? "مرحباً {username}"), member),
        description: replacePlaceholders(
          String(embedConfig.description ?? "نورت {server}!"),
          member,
        ),
        color: String(embedConfig.color ?? "#3B9DF8") as `#${string}`,
        thumbnail: embedConfig.thumbnailAvatar
          ? { url: member.user.displayAvatarURL({ extension: "png", size: 256 }) }
          : undefined,
        footer: embedConfig.footer
          ? { text: replacePlaceholders(String(embedConfig.footer), member) }
          : undefined,
      },
    ];
  }
  const sent = await channel.send(payload);
  const deleteAfterSeconds = Number(config.deleteAfterSeconds ?? 0);
  if (deleteAfterSeconds > 0) {
    setTimeout(() => void sent.delete().catch(() => undefined), deleteAfterSeconds * 1000);
  }
}

async function handleAutoroles(member: GuildMember) {
  const settings = await moduleConfig(member.guild.id, "autoroles");
  if (!settings.enabled) return;
  const config = settings.config;
  const roleIds = (member.user.bot ? config.botRoles : config.userRoles) as string[];
  const delaySeconds = Number(config.delaySeconds ?? 0);
  const apply = async () => {
    const roles = roleIds
      .map((id) => member.guild.roles.cache.get(String(id)))
      .filter((role): role is NonNullable<typeof role> => Boolean(role) && !role.managed);
    if (roles.length)
      await member.roles
        .add(roles, "Glow Auto-Roles")
        .catch((error: unknown) => console.error("Auto-roles failed", error));
  };
  if (delaySeconds > 0) setTimeout(() => void apply(), delaySeconds * 1000);
  else await apply();
}

function levelFromXp(xp: number, curve: number) {
  return Math.max(0, Math.floor(Math.sqrt(xp / Math.max(curve, 1))));
}

async function handleLeveling(message: Message) {
  if (!message.guild || message.author.bot || !message.member) return;
  const settings = await moduleConfig(message.guild.id, "leveling");
  if (!settings.enabled) return;
  const config = settings.config;
  const xpConfig = (config.xp ?? {}) as Record<string, unknown>;
  const exclusions = (config.exclusions ?? {}) as Record<string, unknown>;
  const excludedChannels = (exclusions.textChannels ?? []) as string[];
  const excludedRoles = (exclusions.roles ?? []) as string[];
  if (
    excludedChannels.includes(message.channelId) ||
    message.member.roles.cache.some((role) => excludedRoles.includes(role.id))
  )
    return;

  const cooldown = Math.max(0, Number(xpConfig.textCooldown ?? 60)) * 1000;
  const key = `${message.guild.id}:${message.author.id}`;
  const now = Date.now();
  if ((messageCooldowns.get(key) ?? 0) > now) return;
  messageCooldowns.set(key, now + cooldown);

  const min = Number(xpConfig.textMin ?? 15);
  const max = Math.max(min, Number(xpConfig.textMax ?? 25));
  const baseXp = Math.floor(Math.random() * (max - min + 1)) + min;
  const channelMultipliers = (config.channelMultipliers ?? []) as Array<{
    channelId?: string;
    multiplier?: number;
  }>;
  const roleMultipliers = (config.roleMultipliers ?? []) as Array<{
    roleId?: string;
    multiplier?: number;
  }>;
  const channelMultiplier =
    channelMultipliers.find((item) => item.channelId === message.channelId)?.multiplier ?? 1;
  const roleMultiplier = message.member.roles.cache.reduce(
    (value, role) =>
      Math.max(value, roleMultipliers.find((item) => item.roleId === role.id)?.multiplier ?? 1),
    1,
  );
  const earnedXp = Math.max(
    1,
    Math.round(baseXp * Number(channelMultiplier) * Number(roleMultiplier)),
  );

  const { data: current } = await database()
    .from("member_levels")
    .select("xp, level, daily_xp, weekly_xp, monthly_xp, voice_minutes")
    .eq("guild_id", message.guild.id)
    .eq("user_id", message.author.id)
    .maybeSingle();
  const oldLevel = Number(current?.level ?? 0);
  const xp = Number(current?.xp ?? 0) + earnedXp;
  const level = levelFromXp(xp, Number(xpConfig.curve ?? 100));
  await database()
    .from("member_levels")
    .upsert(
      {
        guild_id: message.guild.id,
        user_id: message.author.id,
        username: message.member.displayName,
        avatar: message.author.displayAvatarURL({ extension: "png", size: 128 }),
        xp,
        level,
        daily_xp: Number(current?.daily_xp ?? 0) + earnedXp,
        weekly_xp: Number(current?.weekly_xp ?? 0) + earnedXp,
        monthly_xp: Number(current?.monthly_xp ?? 0) + earnedXp,
        voice_minutes: Number(current?.voice_minutes ?? 0),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "guild_id,user_id" },
    );

  if (level <= oldLevel) return;
  const announce = (config.announce ?? {}) as Record<string, unknown>;
  const announceChannel = message.guild.channels.cache.get(
    String(announce.channelId || message.channelId),
  );
  if (announceChannel?.isTextBased()) {
    await announceChannel
      .send(
        replacePlaceholders(
          String(announce.message ?? "🎉 مبروك {user}! وصلت للمستوى {level}"),
          message.member,
          { level, xp },
        ),
      )
      .catch(() => undefined);
  }
  const rewards = (config.rewards ?? []) as Array<{
    level?: number;
    roleId?: string;
    removePrevious?: boolean;
  }>;
  for (const reward of rewards.filter((item) => Number(item.level) === level)) {
    const role = reward.roleId ? message.guild.roles.cache.get(reward.roleId) : undefined;
    if (!role || role.managed) continue;
    if (reward.removePrevious) {
      for (const previous of rewards.filter((item) => Number(item.level) < level && item.roleId)) {
        if (previous.roleId)
          await message.member.roles.remove(previous.roleId).catch(() => undefined);
      }
    }
    await message.member.roles.add(role, `Glow level ${level}`).catch(() => undefined);
  }
}

async function handleAutomations(message: Message) {
  if (!message.guild) return;
  const autoReply = await moduleConfig(message.guild.id, "autoreply");
  if (autoReply.enabled && !(autoReply.config.ignoreBots && message.author.bot)) {
    const content = (message.content || message.cleanContent || "").toLowerCase().trim();
    const items = await guildItems(message.guild.id, "autoreply");
    console.log(
      `[Glow Bot] Auto Reply check guild=${message.guild.id} channel=${message.channelId} contentLength=${content.length} rules=${items.length}`,
    );
    if (items.length === 0) {
      console.warn(
        `[Glow Bot] Auto Reply is enabled but has no active rules in guild ${message.guild.id}`,
      );
    }
    for (const item of items) {
      const data = (item.data ?? {}) as Record<string, unknown>;
      const trigger = String(data.trigger ?? data.keyword ?? data.phrase ?? "")
        .toLowerCase()
        .trim();
      if (!trigger || !content.includes(trigger)) continue;
      const response = String(data.response ?? data.reply ?? data.message ?? "").trim();
      console.log(
        `[Glow Bot] Auto Reply matched rule "${String(item.name ?? trigger)}" in guild ${message.guild.id}`,
      );
      if (response) {
        await message
          .reply(response)
          .catch((error: unknown) =>
            console.error(
              `[Glow Bot] Auto Reply could not send a response in guild ${message.guild?.id}`,
              error,
            ),
          );
      }
      if (Boolean(autoReply.config.deleteTrigger) && message.deletable)
        await message
          .delete()
          .catch((error: unknown) =>
            console.error(
              `[Glow Bot] Auto Reply could not delete the trigger in guild ${message.guild?.id}`,
              error,
            ),
          );
      break;
    }
  }

  const autoInteraction = await moduleConfig(message.guild.id, "autointeraction");
  if (autoInteraction.enabled && !(autoInteraction.config.ignoreBots && message.author.bot)) {
    const items = await guildItems(message.guild.id, "autointeraction");
    for (const item of items) {
      const data = (item.data ?? {}) as Record<string, unknown>;
      const trigger = String(data.trigger ?? "").trim();
      const emoji = String(data.emoji ?? data.response ?? "").trim();
      if (trigger && emoji && message.content.toLowerCase().includes(trigger.toLowerCase())) {
        await message.react(emoji).catch(() => undefined);
      }
    }
  }
}

async function handleTempVoice(oldState: VoiceState, newState: VoiceState) {
  const guild = newState.guild;
  const settings = await moduleConfig(guild.id, "tempvoice");
  if (!settings.enabled) return;
  const config = settings.config;
  const lobbyId = String(config.lobbyChannelId ?? "");
  if (newState.channelId === lobbyId && newState.member) {
    const categoryId = String(config.categoryId ?? "") || undefined;
    const created = await guild.channels
      .create({
        name: replacePlaceholders(
          String(config.nameTemplate ?? "🔊 روم {username}"),
          newState.member,
        ),
        type: ChannelType.GuildVoice,
        parent: categoryId,
        userLimit: Number(config.defaultUserLimit ?? 0),
      })
      .catch(() => null);
    if (created) {
      voiceCreatedChannels.add(created.id);
      await newState.setChannel(created).catch(() => undefined);
    }
  }
  const oldChannel = oldState.channel;
  if (!oldChannel || !voiceCreatedChannels.has(oldChannel.id)) return;
  if (oldChannel.members.size === 0 && Boolean(config.deleteWhenEmpty ?? true)) {
    voiceCreatedChannels.delete(oldChannel.id);
    await oldChannel.delete("Glow temporary voice cleanup").catch(() => undefined);
  }
}

function interactionPayload(interaction: ChatInputCommandInteraction): DiscordInteractionPayload {
  return {
    type: 2,
    token: interaction.token,
    guild_id: interaction.guildId ?? undefined,
    member: {
      user: {
        id: interaction.user.id,
        username: interaction.user.username,
        global_name: interaction.user.globalName,
        avatar: interaction.user.displayAvatarURL({ extension: "png", size: 128 }),
      },
    },
    data: {
      name: interaction.commandName,
      options: interaction.options.data as unknown as DiscordInteractionOption[],
    },
  };
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(
    `[Glow Bot] Online as ${readyClient.user.tag} in ${readyClient.guilds.cache.size} server(s)`,
  );
  await registerSlashCommands([...SLASH_COMMANDS]);
  console.log(`[Glow Bot] Registered ${SLASH_COMMANDS.length} slash commands`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  try {
    const response = await handleDiscordInteraction(interactionPayload(interaction), SITE_URL);
    const body = (await response.json()) as {
      data?: { content?: string; flags?: number };
    };
    await interaction.reply({
      content: body.data?.content ?? "تم تنفيذ الأمر.",
      ephemeral: Boolean((body.data?.flags ?? 0) & 64),
    });
  } catch (error) {
    console.error("[Glow Bot] Slash command failed", error);
    if (interaction.replied || interaction.deferred)
      await interaction
        .followUp({ content: "حدث خطأ غير متوقع.", ephemeral: true })
        .catch(() => undefined);
    else
      await interaction
        .reply({ content: "حدث خطأ غير متوقع.", ephemeral: true })
        .catch(() => undefined);
  }
});

client.on(Events.GuildMemberAdd, async (member) => {
  await ensureUser(member).catch((error: unknown) => console.error("User setup failed", error));
  await handleWelcome(member).catch((error: unknown) => console.error("Welcome failed", error));
  await handleAutoroles(member).catch((error: unknown) =>
    console.error("Auto-roles failed", error),
  );
});

client.on(Events.MessageCreate, async (message) => {
  if (message.guild) {
    const contentLength = (message.content || message.cleanContent || "").length;
    console.log(
      `[Glow Bot] MessageCreate guild=${message.guild.id} channel=${message.channelId} authorBot=${message.author.bot} contentLength=${contentLength}`,
    );
  }
  await handleAutomations(message).catch((error: unknown) =>
    console.error("Automation failed", error),
  );
  await handleLeveling(message).catch((error: unknown) => console.error("Leveling failed", error));
});

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  await handleTempVoice(oldState, newState).catch((error: unknown) =>
    console.error("Temp voice failed", error),
  );
});

client.on(Events.Error, (error) => console.error("[Glow Bot] Discord client error", error));

process.on("SIGTERM", () => client.destroy());
process.on("SIGINT", () => client.destroy());

client.login(botToken()).catch((error: unknown) => {
  console.error("[Glow Bot] Login failed. Check DISCORD_BOT_TOKEN and enabled intents.", error);
  process.exitCode = 1;
});
