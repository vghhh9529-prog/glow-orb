import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertGuildAccess } from "./guilds.server";
import { botToken, fetchBotGuild, fetchGuildChannels, inspectDiscordChannel } from "./discord-api.server";
import { withDefaults } from "./module-defaults";

const DISCORD_API = "https://discord.com/api/v10";
const MESSAGE_GUARD_MODULE = "messageguard";
const MESSAGE_GUARD_BUTTON = "glow_message_guard_count";
const DEFAULT_ROOM_NAME = "mrbeast-guard";
const MAX_ROOM_NAME_LENGTH = 90;
const PUNISHMENTS = new Set(["kick", "ban"]);

type MessageGuardConfig = {
  channelId: string;
  channelName: string;
  categoryId: string;
  punishment: "kick" | "ban";
  punishmentCount: number;
  messageId: string;
};

type DiscordMessage = {
  id: string;
};

type DiscordChannelResponse = {
  id: string;
  name: string;
  type: number;
  guild_id?: string;
  parent_id?: string | null;
};

function cleanRoomName(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, MAX_ROOM_NAME_LENGTH);
  return normalized || DEFAULT_ROOM_NAME;
}

function cleanPunishment(value: unknown): "kick" | "ban" {
  return value === "ban" ? "ban" : "kick";
}

function readConfig(value: unknown): MessageGuardConfig {
  const config = withDefaults("messageguard", value);
  return {
    channelId: typeof config["channelId"] === "string" ? config["channelId"] : "",
    channelName: typeof config["channelName"] === "string" ? config["channelName"] : DEFAULT_ROOM_NAME,
    categoryId: typeof config["categoryId"] === "string" ? config["categoryId"] : "",
    punishment: cleanPunishment(config["punishment"]),
    punishmentCount: Math.max(0, Number(config["punishmentCount"] ?? 0) || 0),
    messageId: typeof config["messageId"] === "string" ? config["messageId"] : "",
  };
}

function punishmentLabel(punishment: "kick" | "ban", arabic: boolean) {
  if (punishment === "ban") return arabic ? "حظر مباشر" : "Immediate ban";
  return arabic ? "طرد مباشر" : "Immediate kick";
}

function buildGuardEmbed(config: MessageGuardConfig, guildName: string) {
  return {
    title: "🚫 Message Guard · حارس الرسائل",
    description:
      "**العربية**\nلا ترسل أي رسالة في هذا الروم. عند إرسال أي رسالة سيتم حذفها وتطبيق العقوبة المحددة مباشرة.\n\n**English**\nDo not send messages in this channel. Any message will be deleted and the selected punishment will be applied immediately.",
    color: 0xef4444,
    fields: [
      { name: "العقوبة · Punishment", value: punishmentLabel(config.punishment, true), inline: true },
      { name: "العقوبات · Penalties", value: String(config.punishmentCount), inline: true },
      { name: "السيرفر · Server", value: guildName.slice(0, 100), inline: true },
    ],
    footer: { text: "Glow Orb · Message Guard" },
  };
}

function messagePayload(config: MessageGuardConfig, guildName: string) {
  return {
    embeds: [buildGuardEmbed(config, guildName)],
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 2,
            label: `Penalties · ${config.punishmentCount}`.slice(0, 80),
            custom_id: MESSAGE_GUARD_BUTTON,
          },
        ],
      },
    ],
    allowed_mentions: { parse: [] as string[] },
  };
}

async function discordRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${DISCORD_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bot ${botToken()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Discord request failed (${response.status}): ${body.slice(0, 300)}`);
  }
  if (response.status === 204) return {} as T;
  return (await response.json()) as T;
}

async function tryPatchGuardMessage(config: MessageGuardConfig, guildName: string) {
  if (!config.channelId || !config.messageId) return false;
  try {
    await discordRequest(`/channels/${encodeURIComponent(config.channelId)}/messages/${encodeURIComponent(config.messageId)}`, {
      method: "PATCH",
      body: JSON.stringify(messagePayload(config, guildName)),
    });
    return true;
  } catch {
    return false;
  }
}

async function saveConfig(guildId: string, config: MessageGuardConfig, enabled = true) {
  const { error } = await supabaseAdmin.from("guild_modules").upsert(
    {
      guild_id: guildId,
      module: MESSAGE_GUARD_MODULE,
      enabled,
      config,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "guild_id,module" },
  );
  if (error) throw error;
}

export async function getMessageGuardSettings(guildId: string) {
  const { data, error } = await supabaseAdmin
    .from("guild_modules")
    .select("enabled, config")
    .eq("guild_id", guildId)
    .eq("module", MESSAGE_GUARD_MODULE)
    .maybeSingle();
  if (error) console.error(`[Glow Bot] Failed to load messageguard config for ${guildId}: ${error.message}`);
  return { enabled: data ? Boolean(data.enabled) : false, config: readConfig(data?.config) };
}

export async function provisionMessageGuard(input: {
  guildId: string;
  channelName: string;
  categoryId: string;
  punishment: "kick" | "ban";
}) {
  await assertGuildAccess(input.guildId);
  const guild = await fetchBotGuild(input.guildId);
  if (!guild) throw new Error("BOT_NOT_IN_GUILD");

  const categories = await fetchGuildChannels(input.guildId);
  const category = input.categoryId
    ? categories.find((channel) => channel.id === input.categoryId && channel.type === 4)
    : undefined;
  if (input.categoryId && !category) throw new Error("INVALID_CATEGORY");

  const current = await getMessageGuardSettings(input.guildId);
  const next: MessageGuardConfig = {
    ...current.config,
    channelName: cleanRoomName(input.channelName),
    categoryId: input.categoryId,
    punishment: cleanPunishment(input.punishment),
  };

  let channel: DiscordChannelResponse | null = null;
  if (next.channelId) {
    const existing = await inspectDiscordChannel(next.channelId);
    if (existing.data?.guild_id === input.guildId && existing.data.type === 0) {
      channel = existing.data;
    }
  }
  if (!channel) {
    channel = await discordRequest<DiscordChannelResponse>(`/guilds/${encodeURIComponent(input.guildId)}/channels`, {
      method: "POST",
      body: JSON.stringify({
        name: next.channelName,
        type: 0,
        parent_id: next.categoryId || null,
        topic: "Glow Orb Message Guard · Do not send messages in this channel.",
        permission_overwrites: [
          {
            id: input.guildId,
            type: 0,
            allow: "68608",
            deny: "64",
          },
        ],
      }),
    });
  } else if (channel.name !== next.channelName || channel.parent_id !== (next.categoryId || null)) {
    channel = await discordRequest<DiscordChannelResponse>(`/channels/${encodeURIComponent(channel.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ name: next.channelName, parent_id: next.categoryId || null }),
    });
  }

  next.channelId = channel.id;
  const updated = await tryPatchGuardMessage(next, guild.name);
  if (!updated) {
    const created = await discordRequest<DiscordMessage>(`/channels/${encodeURIComponent(channel.id)}/messages`, {
      method: "POST",
      body: JSON.stringify(messagePayload(next, guild.name)),
    });
    next.messageId = created.id;
  }
  await saveConfig(input.guildId, next, true);
  return { ok: true, channelId: next.channelId, channelName: next.channelName, punishment: next.punishment };
}

export async function updateMessageGuardCounter(guildId: string, increment = 1) {
  const current = await getMessageGuardSettings(guildId);
  const next = { ...current.config, punishmentCount: current.config.punishmentCount + Math.max(1, increment) };
  const guild = await fetchBotGuild(guildId);
  if (guild) {
    const updated = await tryPatchGuardMessage(next, guild.name);
    if (!updated && next.channelId) {
      const created = await discordRequest<DiscordMessage>(`/channels/${encodeURIComponent(next.channelId)}/messages`, {
        method: "POST",
        body: JSON.stringify(messagePayload(next, guild.name)),
      });
      next.messageId = created.id;
    }
  }
  await saveConfig(guildId, next, current.enabled);
  return next.punishmentCount;
}

export function isMessageGuardCounterButton(customId: string) {
  return customId === MESSAGE_GUARD_BUTTON;
}

export { cleanPunishment };
