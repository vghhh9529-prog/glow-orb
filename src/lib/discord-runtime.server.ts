import {
  AuditLogEvent,
  EmbedBuilder,
  PermissionFlagsBits,
  type Guild,
  type GuildMember,
  type Role,
} from "discord.js";

import { supabaseAdmin } from "../integrations/supabase/client.server";
import { withDefaults } from "./module-defaults";
import type { ModuleKey } from "./discord";

export type LogEventKey =
  | "messageDelete"
  | "messageUpdate"
  | "memberJoin"
  | "memberLeave"
  | "memberBan"
  | "memberUnban"
  | "roleCreate"
  | "roleDelete"
  | "roleUpdate"
  | "channelCreate"
  | "channelDelete"
  | "channelUpdate"
  | "voiceState"
  | "ticket"
  | "moderation";

const protectionWindows = new Map<string, number[]>();

async function moduleConfig<T extends ModuleKey>(guildId: string, module: T) {
  const { data, error } = await supabaseAdmin
    .from("guild_modules")
    .select("enabled, config")
    .eq("guild_id", guildId)
    .eq("module", module)
    .maybeSingle();
  if (error) console.error(`[Glow Runtime] Failed to load ${module} config`, error.message);
  return {
    enabled: data ? Boolean(data.enabled) : false,
    config: withDefaults(module, data?.config),
  };
}

function hexColor(value: unknown, fallback = 0x7c5cff) {
  const parsed = Number.parseInt(String(value ?? "").replace("#", ""), 16);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clipped(value: string, max = 1024) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export async function logGuildEvent(input: {
  guild: Guild;
  event: LogEventKey;
  title: string;
  description: string;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  channelId?: string;
  destinationChannelId?: string;
  roleIds?: string[];
  isBot?: boolean;
  messageContent?: string;
}) {
  const settings = await moduleConfig(input.guild.id, "logging");
  const config = settings.config;
  const destinationChannelId = input.destinationChannelId;
  if (!settings.enabled && !destinationChannelId) return false;
  const enabledEvents = Array.isArray(config["enabledEvents"])
    ? config["enabledEvents"].filter((item): item is string => typeof item === "string")
    : [];
  if (settings.enabled && !enabledEvents.includes(input.event)) return false;
  if (input.isBot && config["includeBots"] === false) return false;
  if (input.channelId && Array.isArray(config["ignoredChannelIds"]) && config["ignoredChannelIds"].includes(input.channelId)) return false;
  const ignoredRoleIds = Array.isArray(config["ignoredRoleIds"])
    ? config["ignoredRoleIds"].filter((item): item is string => typeof item === "string")
    : [];
  if (input.roleIds && input.roleIds.some((id) => ignoredRoleIds.includes(id))) return false;

  const logChannelId = input.destinationChannelId ?? (typeof config["channelId"] === "string" ? config["channelId"] : "");
  if (!logChannelId) return false;
  const channel = input.guild.channels.cache.get(logChannelId) ?? await input.guild.channels.fetch(logChannelId).catch(() => null);
  if (!channel?.isTextBased() || !("send" in channel)) return false;
  const colors = (config["colors"] ?? {}) as Record<string, unknown>;
  const messageContent = input.messageContent && config["includeMessageContent"] !== false
    ? `\n\nMessage content:\n${clipped(input.messageContent, 1800)}`
    : "";
  const embed = new EmbedBuilder()
    .setColor(hexColor(colors[input.event === "ticket" ? "ticket" : input.event === "moderation" ? "moderation" : input.event.startsWith("message") ? "message" : input.event.startsWith("member") ? "member" : input.event.startsWith("role") ? "role" : input.event.startsWith("channel") ? "channel" : input.event === "voiceState" ? "voice" : "system"], 0x7c5cff))
    .setTitle(clipped(input.title, 256))
    .setDescription(clipped(`${input.description}${messageContent}`, 4096))
    .setTimestamp()
    .setFooter({ text: `${input.guild.name} · Glow Logs` });
  if (input.fields?.length) embed.addFields(input.fields.slice(0, 25).map((field) => ({ ...field, name: clipped(field.name, 256), value: clipped(field.value) })));
  await channel.send({ embeds: [embed] }).catch((error: unknown) => console.error("[Glow Runtime] Could not send log", error));
  return true;
}

export async function recentAuditActor(guild: Guild, type: AuditLogEvent, targetId?: string) {
  const logs = await guild.fetchAuditLogs({ type, limit: 8 }).catch(() => null);
  if (!logs) return null;
  const entry = logs.entries.find((item) => {
    if (Date.now() - item.createdTimestamp > 20_000) return false;
    if (targetId && item.targetId !== targetId) return false;
    return Boolean(item.executorId);
  });
  return entry?.executorId ?? null;
}

function ruleNameForEvent(event: string) {
  const names: Record<string, string> = {
    channelDelete: "channelDelete",
    channelCreate: "channelCreate",
    channelUpdate: "serverUpdate",
    roleDelete: "roleDelete",
    roleCreate: "roleCreate",
    roleUpdate: "roleUpdate",
    memberBan: "ban",
    memberKick: "kick",
    botAdd: "botAdd",
    webhookCreate: "webhookCreate",
    memberUpdate: "memberUpdate",
    massRoleChange: "massRoleChange",
  };
  return names[event] ?? event;
}

async function applyPunishment(member: GuildMember, action: string, reason: string) {
  if (member.id === member.guild.ownerId || member.id === member.guild.client.user?.id) return "skipped";
  if (action === "removeRoles") {
    await member.roles.set([], reason);
    return "roles removed";
  }
  if (action === "kick") {
    await member.kick(reason);
    return "kicked";
  }
  if (action === "ban") {
    await member.ban({ deleteMessageSeconds: 0, reason });
    return "banned";
  }
  if (action === "timeout") {
    await member.timeout(10 * 60_000, reason);
    return "timed out";
  }
  return "no action";
}

export async function protectGuildEvent(input: {
  guild: Guild;
  event: string;
  actorId?: string | null;
  targetId?: string | null;
  details: string;
}) {
  const settings = await moduleConfig(input.guild.id, "protection");
  if (!settings.enabled) return { triggered: false as const };
  const config = settings.config;
  const whitelist = Array.isArray(config["whitelist"])
    ? config["whitelist"].filter((item): item is string => typeof item === "string")
    : [];
  if (!input.actorId || whitelist.includes(input.actorId) || input.actorId === input.guild.ownerId || input.actorId === input.guild.client.user?.id) {
    return { triggered: false as const };
  }
  const rules = (config["rules"] ?? {}) as Record<string, Record<string, unknown>>;
  const rule = rules[ruleNameForEvent(input.event)];
  if (!rule?.["enabled"]) return { triggered: false as const };
  const limit = Math.max(1, Number(rule["limit"] ?? 1));
  const windowSeconds = Math.max(5, Number(rule["windowSeconds"] ?? 30));
  const key = `${input.guild.id}:${input.event}:${input.actorId}`;
  const now = Date.now();
  const recent = (protectionWindows.get(key) ?? []).filter((time) => now - time <= windowSeconds * 1000);
  recent.push(now);
  protectionWindows.set(key, recent);
  if (recent.length < limit) return { triggered: false as const, count: recent.length };

  const reason = `Glow anti-nuke: ${input.event} threshold reached (${recent.length}/${limit})`;
  const actor = await input.guild.members.fetch(input.actorId).catch(() => null);
  const action = String(rule["punishment"] ?? config["punishment"] ?? "removeRoles");
  let result = "actor not found";
  protectionWindows.delete(key);
  if (actor) {
    try {
      result = await applyPunishment(actor, action, reason);
    } catch (error) {
      result = `failed: ${error instanceof Error ? error.message : "unknown error"}`;
      console.error("[Glow Runtime] Protection punishment failed", error);
    }
  }
  const protectionLogChannel = typeof config["logChannelId"] === "string" ? config["logChannelId"] : "";
  await logGuildEvent({
    guild: input.guild,
    event: "moderation",
    ...(protectionLogChannel ? { destinationChannelId: protectionLogChannel } : {}),
    title: "Anti-Nuke protection triggered",
    description: `Glow detected repeated **${input.event}** activity and applied a protection action.`,
    fields: [
      { name: "Actor", value: `<@${input.actorId}>`, inline: true },
      { name: "Action", value: result, inline: true },
      { name: "Details", value: input.details },
    ],
  });
  return { triggered: true as const, action: result, count: recent.length };
}

export async function logModerationAction(input: {
  guild: Guild;
  title: string;
  description: string;
  moderator?: string | null;
  target?: string | null;
  reason?: string | null;
}) {
  return logGuildEvent({
    guild: input.guild,
    event: "moderation",
    title: input.title,
    description: input.description,
    fields: [
      ...(input.moderator ? [{ name: "Moderator", value: `<@${input.moderator}>`, inline: true }] : []),
      ...(input.target ? [{ name: "Target", value: `<@${input.target}>`, inline: true }] : []),
      ...(input.reason ? [{ name: "Reason", value: clipped(input.reason) }] : []),
    ],
  });
}

export function roleIds(member: GuildMember | null | undefined) {
  return member ? [...member.roles.cache.keys()].filter((id) => id !== member.guild.id) : [];
}

export function isManageableMember(member: GuildMember | null | undefined) {
  return Boolean(member && !member.user.bot && member.manageable && member.permissions.has(PermissionFlagsBits.ViewChannel));
}

export function roleDetails(role: Role) {
  return `@${role.name} (${role.id})`;
}
