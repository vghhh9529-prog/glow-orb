/** Client-safe Discord constants shared by the dashboard UI. */

export const DISCORD_CLIENT_ID = "1450816538377715782";

/** Administrator — required so every Glow module (automod, roles, voice) works. */
export const BOT_PERMISSIONS = "8";

export const SUPPORT_SERVER_URL = "https://discord.gg/pcDdV37g34";

export const OAUTH_SCOPES = ["identify", "email", "guilds"] as const;

export function botInviteUrl(guildId?: string) {
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    permissions: BOT_PERMISSIONS,
    scope: "bot applications.commands",
  });
  if (guildId) {
    params.set("guild_id", guildId);
    params.set("disable_guild_select", "true");
  }
  return `https://discord.com/oauth2/authorized?${params.toString()}`.replace(
    "/authorized?",
    "/authorize?",
  );
}

export function guildIconUrl(id: string, icon: string | null | undefined) {
  if (!icon) return null;
  const ext = icon.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/icons/${id}/${icon}.${ext}?size=128`;
}

export function userAvatarUrl(id: string, avatar: string | null | undefined) {
  if (avatar?.startsWith("http")) return avatar;
  if (!avatar) {
    const index = (BigInt(id) >> 22n) % 6n;
    return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
  }
  const ext = avatar.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${id}/${avatar}.${ext}?size=128`;
}

/** Modules available in the dashboard sidebar. */
export const MODULE_KEYS = [
  "welcome",
  "leveling",
  "suggestions",
  "autoroles",
  "tempvoice",
  "autoreply",
  "autointeraction",
  "automod",
  "protection",
  "logging",
  "customcommands",
  "tickets",
  "commands",
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];
