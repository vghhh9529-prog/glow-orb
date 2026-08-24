import "dotenv/config";

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  Partials,
  PermissionFlagsBits,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type GuildMember,
  type Message,
  type VoiceState,
} from "discord.js";

import { supabaseAdmin } from "../src/integrations/supabase/client.server";
import {
  handleDiscordCardCommand,
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
const customCommandCooldowns = new Map<string, number>();
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
    enabled: data ? Boolean(data.enabled) : module === "commands" || module === "tickets",
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

async function ticketConfig(guildId: string) {
  const settings = await moduleConfig(guildId, "tickets");
  return settings;
}

function ticketRecordData(input: {
  channelId: string;
  creatorId: string;
  creatorName: string;
  status: "open" | "closed";
  claimedBy?: string | null;
  priority?: string;
  categoryId?: string;
}) {
  return {
    channelId: input.channelId,
    creatorId: input.creatorId,
    creatorName: input.creatorName,
    status: input.status,
    claimedBy: input.claimedBy ?? null,
    priority: input.priority ?? "normal",
    categoryId: input.categoryId ?? null,
    updatedAt: new Date().toISOString(),
  };
}

async function findTicket(channelId: string) {
  const { data, error } = await database()
    .from("guild_items")
    .select("id, guild_id, name, enabled, data")
    .eq("kind", "tickets")
    .contains("data", { channelId })
    .maybeSingle();
  if (error) console.error(`[Glow Bot] Failed to load ticket ${channelId}: ${error.message}`);
  return data;
}

async function saveTicketRecord(input: {
  guildId: string;
  channelId: string;
  creatorId: string;
  creatorName: string;
  status: "open" | "closed";
  id?: string;
  claimedBy?: string | null;
  priority?: string;
  categoryId?: string;
}) {
  const record = {
    guild_id: input.guildId,
    kind: "tickets",
    name: `ticket-${input.channelId}`,
    enabled: input.status === "open",
    data: ticketRecordData(input),
    updated_at: new Date().toISOString(),
  };
  const query = input.id
    ? database().from("guild_items").update(record).eq("id", input.id).eq("guild_id", input.guildId)
    : database().from("guild_items").insert(record);
  const { error } = await query;
  if (error) console.error(`[Glow Bot] Failed to save ticket ${input.channelId}: ${error.message}`);
}

async function buildTicketEmbed(guildName: string, creatorId: string, status: "open" | "closed", priority = "normal") {
  return new EmbedBuilder()
    .setColor(status === "open" ? 0x7c5cff : 0x64748b)
    .setTitle(status === "open" ? "Glow Support Ticket" : "Ticket closed")
    .setDescription(status === "open" ? `Welcome <@${creatorId}>. Tell us what you need and the support team will be with you shortly.` : "This ticket is closed. The HTML transcript was saved when the ticket was closed. Reopen it if you still need help, or delete the ticket permanently when you are done.")
    .addFields({ name: "Priority", value: priority, inline: true }, { name: "Status", value: status, inline: true })
    .setFooter({ text: `${guildName} · Glow Support` });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>\"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

async function postTicketTranscript(channel: Message["channel"], ticket: { id?: string; data?: Record<string, unknown> }, config: Record<string, unknown>) {
  const transcriptChannelId = typeof config["transcriptChannelId"] === "string" ? config["transcriptChannelId"] : "";
  if (config["transcriptEnabled"] === false || !transcriptChannelId || !channel.isTextBased()) return;
  const transcriptChannel = await channel.client.channels.fetch(transcriptChannelId).catch(() => null);
  if (!transcriptChannel || !transcriptChannel.isTextBased() || !("send" in transcriptChannel)) return;
  const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
  const channelName = "name" in channel && typeof channel.name === "string" ? channel.name : channel.id;
  const ticketData = ticket.data ?? {};
  const rows = messages
    ? [...messages.values()].reverse().map((message) => {
        const attachments = [...message.attachments.values()]
          .map((attachment) => `<a href="${escapeHtml(attachment.url)}">${escapeHtml(attachment.name ?? "attachment")}</a>`)
          .join(" · ");
        return `<article class="message"><div class="meta"><strong>${escapeHtml(message.author.tag)}</strong><time>${escapeHtml(message.createdAt.toISOString())}</time></div><p>${escapeHtml(message.cleanContent || "").replaceAll("\n", "<br>") || "<em>empty message</em>"}</p>${attachments ? `<div class="attachments">${attachments}</div>` : ""}</article>`;
      }).join("\n")
    : `<p class="empty">No messages could be fetched.</p>`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Glow ticket transcript · ${escapeHtml(channelName)}</title><style>body{margin:0;background:#090b18;color:#eef0ff;font:15px/1.6 Inter,system-ui,sans-serif;padding:32px}.wrap{max-width:900px;margin:auto}.hero{background:linear-gradient(135deg,#181332,#0c1630);border:1px solid #343064;border-radius:22px;padding:24px;margin-bottom:20px}.eyebrow{color:#a996ff;text-transform:uppercase;letter-spacing:.16em;font-size:11px;font-weight:700}.meta{display:flex;gap:14px;align-items:center;color:#a9acc8}.meta time{font-size:12px}.message{background:#11152a;border:1px solid #24294a;border-radius:16px;padding:14px 16px;margin:10px 0}.message p{margin:8px 0 0;white-space:normal}.attachments{font-size:12px;color:#a996ff}.attachments a{color:#a996ff}</style></head><body><main class="wrap"><section class="hero"><div class="eyebrow">Glow Support</div><h1>${escapeHtml(channelName)}</h1><p>Ticket transcript · ${escapeHtml(String(ticket.id ?? "unknown"))}</p><p>Creator: ${escapeHtml(String(ticketData["creatorName"] ?? "unknown"))}</p></section><section>${rows}</section></main></body></html>`;
  await transcriptChannel.send({
    embeds: [new EmbedBuilder().setColor(0x64748b).setTitle("Ticket transcript saved").setDescription(`HTML transcript for **${channelName}** is attached below.`)],
    files: [{ attachment: Buffer.from(html, "utf8"), name: `glow-${channel.id}-transcript.html` }],
  }).catch((error) => console.error("[Glow Bot] Ticket HTML transcript failed", error));
}

async function handleTicketButton(interaction: ButtonInteraction) {
  if (!interaction.guild) return interaction.reply({ content: "Tickets are available inside a server only.", ephemeral: true });
  const settings = await ticketConfig(interaction.guild.id);
  const config = settings.config;

  if (interaction.customId === "glow_ticket_open") {
    if (!settings.enabled) return interaction.reply({ content: "Support tickets are disabled for this server.", ephemeral: true });
    const existing = await database().from("guild_items").select("id, data").eq("guild_id", interaction.guild.id).eq("kind", "tickets").contains("data", { creatorId: interaction.user.id, status: "open" }).maybeSingle();
    if (existing.data?.data && typeof existing.data.data === "object" && "channelId" in existing.data.data) {
      const existingChannel = await interaction.guild.channels.fetch(String(existing.data.data.channelId)).catch(() => null);
      if (existingChannel) return interaction.reply({ content: `You already have an open ticket: <#${existingChannel.id}>`, ephemeral: true });
    }
    const supportRoleIds = Array.isArray(config.supportRoleIds) ? config.supportRoleIds.filter((id): id is string => typeof id === "string") : [];
    const nameTemplate = typeof config.ticketName === "string" ? config.ticketName : "ticket-{username}";
    const channelName = nameTemplate.replaceAll("{username}", interaction.user.username.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 20) || "member").slice(0, 90);
    const channel = await interaction.guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: typeof config.categoryId === "string" && config.categoryId ? config.categoryId : undefined,
      permissionOverwrites: [
        { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        ...supportRoleIds.map((roleId) => ({ id: roleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] })),
      ],
    }).catch(() => null);
    if (!channel) return interaction.reply({ content: "Could not create the ticket. Check Glow's Manage Channels permission.", ephemeral: true });
    const record = ticketRecordData({ channelId: channel.id, creatorId: interaction.user.id, creatorName: interaction.user.username, status: "open", categoryId: typeof config.categoryId === "string" ? config.categoryId : undefined });
    await database().from("guild_items").insert({ guild_id: interaction.guild.id, kind: "tickets", name: channel.name, enabled: true, data: record });
    const staffMentions = config.notifyStaff === false ? "" : supportRoleIds.map((roleId) => `<@&${roleId}>`).join(" ");
    await channel.send({ content: staffMentions || undefined, embeds: [await buildTicketEmbed(interaction.guild.name, interaction.user.id, "open")], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId("glow_ticket_claim").setLabel("Claim").setStyle(ButtonStyle.Secondary), new ButtonBuilder().setCustomId("glow_ticket_close").setLabel("Close").setStyle(ButtonStyle.Danger))] });
    return interaction.reply({ content: `Your private ticket is ready: <#${channel.id}>`, ephemeral: true });
  }

  const ticket = await findTicket(interaction.channelId);
  if (!ticket) return interaction.reply({ content: "This channel is not a Glow ticket.", ephemeral: true });
  const ticketData = (ticket.data ?? {}) as Record<string, unknown>;
  if (interaction.customId === "glow_ticket_delete") {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels) && String(ticketData.creatorId) !== interaction.user.id) return interaction.reply({ content: "Only the ticket creator or staff can delete this ticket.", ephemeral: true });
    await interaction.deferUpdate();
    await interaction.channel?.delete("Glow ticket deleted").catch(() => undefined);
    await database().from("guild_items").delete().eq("id", ticket.id).eq("guild_id", interaction.guild.id);
    return;
  }
  if (interaction.customId === "glow_ticket_claim") {
    if (config.allowClaim === false) return interaction.reply({ content: "Ticket claiming is disabled.", ephemeral: true });
    await saveTicketRecord({ guildId: interaction.guild.id, channelId: interaction.channelId, creatorId: String(ticketData.creatorId ?? ""), creatorName: String(ticketData.creatorName ?? "member"), status: "open", id: ticket.id, claimedBy: interaction.user.id, priority: String(ticketData.priority ?? "normal"), categoryId: String(ticketData.categoryId ?? "") });
    return interaction.reply({ content: `Ticket claimed by **${interaction.user.username}**.`, ephemeral: false });
  }
  if (interaction.customId === "glow_ticket_reopen") {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels) && String(ticketData.creatorId) !== interaction.user.id) return interaction.reply({ content: "Only the ticket creator or staff can reopen this ticket.", ephemeral: true });
    if (interaction.channel && "setName" in interaction.channel) await interaction.channel.setName(String(ticket.name ?? "ticket").replace(/^closed-/, "")).catch(() => undefined);
    await saveTicketRecord({ guildId: interaction.guild.id, channelId: interaction.channelId, creatorId: String(ticketData.creatorId ?? ""), creatorName: String(ticketData.creatorName ?? "member"), status: "open", id: ticket.id, claimedBy: String(ticketData.claimedBy ?? "") || null, priority: String(ticketData.priority ?? "normal"), categoryId: String(ticketData.categoryId ?? "") });
    return interaction.update({ embeds: [await buildTicketEmbed(interaction.guild.name, String(ticketData.creatorId ?? interaction.user.id), "open", String(ticketData.priority ?? "normal"))], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId("glow_ticket_claim").setLabel("Claim").setStyle(ButtonStyle.Secondary), new ButtonBuilder().setCustomId("glow_ticket_close").setLabel("Close").setStyle(ButtonStyle.Danger))] });
  }
  if (interaction.customId === "glow_ticket_close") {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels) && String(ticketData.creatorId) !== interaction.user.id) return interaction.reply({ content: "Only the ticket creator or staff can close this ticket.", ephemeral: true });
    await postTicketTranscript(interaction.channel, ticket, config);
    if (interaction.channel && "setName" in interaction.channel) await interaction.channel.setName(`closed-${String(ticket.name ?? "ticket").replace(/^closed-/, "")}`.slice(0, 100)).catch(() => undefined);
    if (interaction.channel && "permissionOverwrites" in interaction.channel) await interaction.channel.permissionOverwrites.edit(String(ticketData.creatorId), { SendMessages: false }).catch(() => undefined);
    await saveTicketRecord({ guildId: interaction.guild.id, channelId: interaction.channelId, creatorId: String(ticketData.creatorId ?? ""), creatorName: String(ticketData.creatorName ?? "member"), status: "closed", id: ticket.id, claimedBy: String(ticketData.claimedBy ?? "") || null, priority: String(ticketData.priority ?? "normal"), categoryId: String(ticketData.categoryId ?? "") });
    return interaction.update({ embeds: [await buildTicketEmbed(interaction.guild.name, String(ticketData.creatorId ?? interaction.user.id), "closed", String(ticketData.priority ?? "normal"))], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId("glow_ticket_reopen").setLabel("Reopen").setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId("glow_ticket_delete").setLabel("Delete ticket").setStyle(ButtonStyle.Danger))] });
  }
  return interaction.reply({ content: "Unknown ticket action.", ephemeral: true });
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

  const customCommands = await moduleConfig(message.guild.id, "customcommands");
  if (customCommands.enabled && !(customCommands.config.ignoreBots && message.author.bot)) {
    const prefix = String(customCommands.config.prefix ?? "!").trim() || "!";
    const raw = message.content.trim();
    if (raw.startsWith(prefix)) {
      const commandName = raw.slice(prefix.length).trim().split(/\s+/)[0]?.toLowerCase() ?? "";
      if (commandName) {
        const items = await guildItems(message.guild.id, "customcommands");
        const match = items.find((item) => {
          const data = (item.data ?? {}) as Record<string, unknown>;
          const trigger = String(data.trigger ?? item.name ?? "").trim().replace(/^!+/, "").toLowerCase();
          return trigger === commandName;
        });
        if (match) {
          const cooldownSeconds = Math.max(0, Number(customCommands.config.cooldownSeconds ?? 3));
          const cooldownKey = `${message.guild.id}:${match.id ?? match.name}:${message.author.id}`;
          const now = Date.now();
          const lastUsed = customCommandCooldowns.get(cooldownKey) ?? 0;
          if (now - lastUsed >= cooldownSeconds * 1000) {
            customCommandCooldowns.set(cooldownKey, now);
            const data = (match.data ?? {}) as Record<string, unknown>;
            const response = String(data.response ?? data.reply ?? data.message ?? "").trim();
            if (response) {
              const member = message.member;
              const rendered = member
                ? replacePlaceholders(response, member)
                : response
                    .replaceAll("{user}", `<@${message.author.id}>`)
                    .replaceAll("{username}", message.author.username)
                    .replaceAll("{server}", message.guild.name);
              await message.reply(rendered).catch((error: unknown) =>
                console.error(`[Glow Bot] Custom command could not reply in ${message.guild?.id}`, error),
              );
            }
            if (Boolean(customCommands.config.deleteTrigger) && message.deletable)
              await message.delete().catch(() => undefined);
          }
        }
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
    channel_id: interaction.channelId ?? undefined,
    member: {
      user: {
        id: interaction.user.id,
        username: interaction.user.username,
        global_name: interaction.user.globalName,
        avatar: interaction.user.displayAvatarURL({ extension: "png", size: 128 }),
      },
      permissions: interaction.memberPermissions?.bitfield.toString(),
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
  if (interaction.isButton() && interaction.customId.startsWith("glow_ticket_")) {
    await handleTicketButton(interaction).catch((error: unknown) => {
      console.error("[Glow Bot] Ticket interaction failed", error);
      if (!interaction.replied && !interaction.deferred)
        void interaction.reply({ content: "حدث خطأ في التذكرة.", ephemeral: true }).catch(() => undefined);
    });
    return;
  }
  if (!interaction.isChatInputCommand()) return;
  try {
    const settings = await moduleConfig(interaction.guildId ?? "", "commands");
    const disabled = Array.isArray(settings.config.disabled)
      ? settings.config.disabled.filter((item): item is string => typeof item === "string")
      : [];
    if (!settings.enabled || disabled.includes(interaction.commandName)) {
      await interaction.reply({ content: "هذا الأمر معطل من لوحة Glow لهذا السيرفر.", ephemeral: true });
      return;
    }
    const payload = interactionPayload(interaction);
    if (interaction.commandName === "user" || interaction.commandName === "profile") {
      const card = await handleDiscordCardCommand(payload);
      if (!card) throw new Error("Card command did not return an image");
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x7c5cff)
            .setTitle(card.title)
            .setDescription("English profile card · live Discord and Glow data")
            .setImage(`attachment://${card.filename}`)
            .setFooter({ text: "Glow · Community progression" }),
        ],
        files: [{ attachment: card.buffer, name: card.filename }],
      });
      return;
    }
    const response = await handleDiscordInteraction(payload, SITE_URL);
    const body = (await response.json()) as {
      data?: { content?: string; embeds?: Array<Record<string, unknown>>; flags?: number };
    };
    await interaction.reply({
      content: body.data?.content,
      embeds: (body.data?.embeds ?? []) as never[],
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
