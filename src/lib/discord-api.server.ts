/** Server-only helpers for talking to the Discord REST API. */

const API = "https://discord.com/api/v10";

export function botToken(): string {
  const token = process.env["DISCORD_BOT_TOKEN"];
  if (!token) throw new Error("DISCORD_BOT_TOKEN is not configured");
  return token;
}

export function clientSecret(): string {
  const secret = process.env["DISCORD_CLIENT_SECRET"];
  if (!secret) throw new Error("DISCORD_CLIENT_SECRET is not configured");
  return secret;
}

export const CLIENT_ID = "1450816538377715782";

export interface DiscordGuildSummary {
  id: string;
  name: string;
  icon: string | null;
  owner?: boolean;
  permissions?: string;
}

export interface DiscordRole {
  id: string;
  name: string;
  color: number;
  position: number;
  managed: boolean;
}

export interface DiscordChannel {
  id: string;
  name: string;
  type: number;
  parent_id: string | null;
  position: number;
}

async function botFetch<T>(path: string): Promise<T | null> {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bot ${botToken()}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

export async function fetchUserGuilds(accessToken: string): Promise<DiscordGuildSummary[]> {
  const res = await fetch(`${API}/users/@me/guilds`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return [];
  return (await res.json()) as DiscordGuildSummary[];
}

export async function fetchBotGuild(guildId: string) {
  return botFetch<{
    id: string;
    name: string;
    icon: string | null;
    approximate_member_count?: number;
    approximate_presence_count?: number;
    premium_subscription_count?: number;
    owner_id: string;
  }>(`/guilds/${guildId}?with_counts=true`);
}

export async function fetchGuildRoles(guildId: string) {
  return (await botFetch<DiscordRole[]>(`/guilds/${guildId}/roles`)) ?? [];
}

export async function fetchGuildChannels(guildId: string) {
  return (await botFetch<DiscordChannel[]>(`/guilds/${guildId}/channels`)) ?? [];
}

export async function exchangeCode(code: string, redirectUri: string) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
  const basic = btoa(`${CLIENT_ID}:${clientSecret()}`);
  const res = await fetch(`${API}/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope: string;
  };
}

export async function fetchCurrentUser(accessToken: string) {
  const res = await fetch(`${API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Failed to load Discord profile");
  return (await res.json()) as {
    id: string;
    username: string;
    global_name: string | null;
    avatar: string | null;
    email: string | null;
  };
}

/** Manage-guild permission bit (0x20). */
export function canManageGuild(g: DiscordGuildSummary) {
  if (g.owner) return true;
  if (!g.permissions) return false;
  const perms = BigInt(g.permissions);
  return (perms & 0x20n) === 0x20n || (perms & 0x8n) === 0x8n;
}

export async function registerSlashCommands(commands: unknown[]) {
  const res = await fetch(`${API}/applications/${CLIENT_ID}/commands`, {
    method: "PUT",
    headers: {
      Authorization: `Bot ${botToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error(`Command registration failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as unknown[];
}

export async function timeoutMember(
  guildId: string,
  userId: string,
  until: string | null,
  reason: string,
) {
  const res = await fetch(`${API}/guilds/${guildId}/members/${userId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bot ${botToken()}`,
      "Content-Type": "application/json",
      "X-Audit-Log-Reason": reason.slice(0, 400),
    },
    body: JSON.stringify({ communication_disabled_until: until }),
  });
  return res.ok;
}

export async function unbanMember(guildId: string, userId: string, reason: string) {
  const res = await fetch(`${API}/guilds/${guildId}/bans/${userId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bot ${botToken()}`,
      "X-Audit-Log-Reason": reason.slice(0, 400),
    },
  });
  return res.ok;
}

export async function putAutoModRule(guildId: string, rule: Record<string, unknown>) {
  const res = await fetch(`${API}/guilds/${guildId}/auto-moderation/rules`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${botToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(rule),
  });
  if (!res.ok) return { ok: false, error: await res.text() };
  return { ok: true, rule: await res.json() };
}

export async function listAutoModRules(guildId: string) {
  return (
    (await botFetch<Array<{ id: string; name: string; enabled: boolean; trigger_type: number }>>(
      `/guilds/${guildId}/auto-moderation/rules`,
    )) ?? []
  );
}

export async function deleteAutoModRule(guildId: string, ruleId: string) {
  const res = await fetch(`${API}/guilds/${guildId}/auto-moderation/rules/${ruleId}`, {
    method: "DELETE",
    headers: { Authorization: `Bot ${botToken()}` },
  });
  return res.ok;
}
