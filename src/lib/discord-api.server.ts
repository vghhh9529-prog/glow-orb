export const API = "https://discord.com/api/v10";

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
  owner?: boolean | string;
  owner_id?: string;
  permissions?: string | number;
}

export interface DiscordRole {
  id: string;
  name: string;
  color: number;
  position: number;
  managed: boolean;
  permissions?: string | number;
}

export interface DiscordChannel {
  id: string;
  name: string;
  type: number;
  parent_id: string | null;
  position: number;
  guild_id?: string;
  permission_overwrites?: Array<{ id: string; type: number; allow?: string; deny?: string }>;
}

async function botFetch<T>(path: string): Promise<T | null> {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bot ${botToken()}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

async function botFetchResult<T>(path: string): Promise<{ data: T | null; status: number }> {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bot ${botToken()}` },
  });
  if (!res.ok) return { data: null, status: res.status };
  return { data: (await res.json()) as T, status: res.status };
}

export interface DiscordUserProfile {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
  banner?: string | null;
}

export async function fetchDiscordUser(userId: string) {
  return await botFetch<DiscordUserProfile>(`/users/${encodeURIComponent(userId)}`);
}

export async function fetchUserGuilds(accessToken: string): Promise<DiscordGuildSummary[]> {
  const res = await fetch(`${API}/users/@me/guilds`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return [];
  return (await res.json()) as DiscordGuildSummary[];
}

export interface DiscordBotGuild {
  id: string;
  name: string;
  icon: string | null;
  approximate_member_count?: number;
  approximate_presence_count?: number;
  premium_subscription_count?: number;
  owner_id: string;
  banner?: string | null;
}

export async function inspectBotGuild(guildId: string) {
  return botFetchResult<DiscordBotGuild>(`/guilds/${guildId}?with_counts=true`);
}

export async function fetchBotGuild(guildId: string) {
  return (await inspectBotGuild(guildId)).data;
}

export async function fetchGuildRoles(guildId: string) {
  return (await botFetch<DiscordRole[]>(`/guilds/${guildId}/roles`)) ?? [];
}

export async function fetchGuildChannels(guildId: string) {
  return (await botFetch<DiscordChannel[]>(`/guilds/${guildId}/channels`)) ?? [];
}

export async function inspectDiscordChannel(channelId: string) {
  return await botFetchResult<DiscordChannel>(`/channels/${encodeURIComponent(channelId)}`);
}

export class DiscordOAuthError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly description: string,
  ) {
    super(`Discord OAuth failed: ${status} ${code}`);
    this.name = "DiscordOAuthError";
  }
}

function oauthError(status: number, body: string): DiscordOAuthError {
  try {
    const parsed = JSON.parse(body) as { error?: string; error_description?: string };
    return new DiscordOAuthError(
      status,
      parsed.error ?? "unknown_error",
      parsed.error_description ?? "Discord rejected the token request",
    );
  } catch {
    return new DiscordOAuthError(status, "unknown_error", "Discord rejected the token request");
  }
}

async function readTokenResponse(response: Response) {
  const body = await response.text();
  if (!response.ok) throw oauthError(response.status, body);
  return JSON.parse(body) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope: string;
  };
}

export async function exchangeCode(code: string, redirectUri: string) {
  const secret = clientSecret();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
  const basic = btoa(`${CLIENT_ID}:${secret}`);
  const response = await fetch(`${API}/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  try {
    return await readTokenResponse(response);
  } catch (error) {
    // Some older Discord-compatible proxies accept client credentials in the form body.
    // Only retry that legacy shape for an authentication rejection; authorization-code
    // and redirect errors must not consume a second request with the same one-time code.
    if (!(error instanceof DiscordOAuthError) || error.status !== 401) throw error;
    const legacyBody = new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: secret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    });
    const legacyResponse = await fetch(`${API}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: legacyBody,
    });
    return readTokenResponse(legacyResponse);
  }
}

export async function refreshAccessToken(refreshToken: string) {
  const secret = clientSecret();
  const response = await fetch(`${API}/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${CLIENT_ID}:${secret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
  });
  return readTokenResponse(response);
}

export async function fetchGuildMember(guildId: string, userId: string) {
  return botFetch<{
    user?: { id: string; username: string; global_name?: string | null; avatar?: string | null };
    joined_at?: string;
    roles?: string[];
    communication_disabled_until?: string | null;
  }>(`/guilds/${guildId}/members/${userId}`);
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

/** Discord permission bits used by the dashboard access guard. */
export function hasDiscordPermission(
  permissions: string | number | bigint | null | undefined,
  bit: bigint,
) {
  if (permissions === null || permissions === undefined || permissions === "") return false;
  try {
    return (BigInt(permissions) & bit) === bit;
  } catch {
    return false;
  }
}

export function canManageGuild(g: DiscordGuildSummary, userId?: string) {
  if (g.owner === true || g.owner === "true" || (userId && g.owner_id === userId)) return true;
  return hasDiscordPermission(g.permissions, 0x20n) || hasDiscordPermission(g.permissions, 0x8n);
}

export function canManageGuildMember(
  member: { roles?: string[] } | null | undefined,
  roles: DiscordRole[],
) {
  const memberRoleIds = new Set(member?.roles ?? []);
  return roles.some(
    (role) =>
      memberRoleIds.has(role.id) &&
      (hasDiscordPermission(role.permissions, 0x20n) || hasDiscordPermission(role.permissions, 0x8n)),
  );
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

export async function upsertChannelMessage(
  channelId: string,
  messageId: string | undefined,
  payload: Record<string, unknown>,
) {
  const path = messageId
    ? `${API}/channels/${channelId}/messages/${messageId}`
    : `${API}/channels/${channelId}/messages`;
  let res = await fetch(path, {
    method: messageId ? "PATCH" : "POST",
    headers: {
      Authorization: `Bot ${botToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  // A previously published panel may have been deleted manually. Recover by creating a fresh panel.
  if (!res.ok && messageId && res.status === 404) {
    res = await fetch(`${API}/channels/${channelId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${botToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  }
  if (!res.ok) return { ok: false as const, status: res.status, error: await res.text() };
  const data = (await res.json()) as { id: string };
  return { ok: true as const, id: data.id };
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

export async function kickMember(guildId: string, userId: string, reason: string) {
  const res = await fetch(`${API}/guilds/${guildId}/members/${userId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bot ${botToken()}`,
      "X-Audit-Log-Reason": reason.slice(0, 400),
    },
  });
  return res.ok;
}

export async function banMember(guildId: string, userId: string, reason: string) {
  const res = await fetch(`${API}/guilds/${guildId}/bans/${userId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bot ${botToken()}`,
      "Content-Type": "application/json",
      "X-Audit-Log-Reason": reason.slice(0, 400),
    },
    body: JSON.stringify({ delete_message_seconds: 0 }),
  });
  return res.ok;
}

export async function clearChannelMessages(channelId: string, amount: number, reason: string) {
  const messages = await botFetch<Array<{ id: string; timestamp?: string }>>(
    `/channels/${channelId}/messages?limit=${Math.min(100, Math.max(1, amount))}`,
  );
  if (!messages) return { ok: false, deleted: 0 };
  const ids = messages.slice(0, amount).map((message) => message.id);
  let deleted = 0;
  for (const id of ids) {
    const res = await fetch(`${API}/channels/${channelId}/messages/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bot ${botToken()}`,
        "X-Audit-Log-Reason": reason.slice(0, 400),
      },
    });
    if (res.ok) deleted += 1;
  }
  return { ok: true, deleted };
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


export async function fetchGuildEmojis(guildId: string) {
  return (await botFetch<Array<{ id: string; name: string | null; animated?: boolean }>>(`/guilds/${guildId}/emojis`)) ?? [];
}

export async function fetchGuildInvites(guildId: string) {
  return (await botFetch<Array<{ code: string; uses?: number; max_uses?: number; inviter?: { username?: string }; channel?: { name?: string } }>>(`/guilds/${guildId}/invites`)) ?? [];
}

export async function fetchGuildMembers(guildId: string, limit = 1000) {
  return (await botFetch<Array<{ user: { id: string; username: string; global_name?: string | null; bot?: boolean }; nick?: string | null; roles?: string[]; deaf?: boolean; mute?: boolean; communication_disabled_until?: string | null }>>(`/guilds/${guildId}/members?limit=${Math.min(1000, Math.max(1, limit))}`)) ?? [];
}

export async function updateGuildChannel(
  channelId: string,
  patch: { permission_overwrites?: Array<{ id: string; type: 0; allow?: string; deny?: string }>; rate_limit_per_user?: number },
  reason: string,
) {
  const res = await fetch(`${API}/channels/${channelId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bot ${botToken()}`,
      "Content-Type": "application/json",
      "X-Audit-Log-Reason": reason.slice(0, 400),
    },
    body: JSON.stringify(patch),
  });
  return res.ok;
}

export async function updateGuildMember(
  guildId: string,
  userId: string,
  patch: { nick?: string | null; channel_id?: string | null },
  reason: string,
) {
  const res = await fetch(`${API}/guilds/${guildId}/members/${userId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bot ${botToken()}`,
      "Content-Type": "application/json",
      "X-Audit-Log-Reason": reason.slice(0, 400),
    },
    body: JSON.stringify(patch),
  });
  return res.ok;
}

export async function addGuildMemberRole(guildId: string, userId: string, roleId: string, reason: string) {
  const res = await fetch(`${API}/guilds/${guildId}/members/${userId}/roles/${roleId}`, {
    method: "PUT",
    headers: { Authorization: `Bot ${botToken()}`, "X-Audit-Log-Reason": reason.slice(0, 400) },
  });
  return res.ok;
}

export async function removeGuildMemberRole(guildId: string, userId: string, roleId: string, reason: string) {
  const res = await fetch(`${API}/guilds/${guildId}/members/${userId}/roles/${roleId}`, {
    method: "DELETE",
    headers: { Authorization: `Bot ${botToken()}`, "X-Audit-Log-Reason": reason.slice(0, 400) },
  });
  return res.ok;
}

export async function deleteGuildRole(guildId: string, roleId: string, reason: string) {
  const res = await fetch(`${API}/guilds/${guildId}/roles/${roleId}`, {
    method: "DELETE",
    headers: { Authorization: `Bot ${botToken()}`, "X-Audit-Log-Reason": reason.slice(0, 400) },
  });
  return res.ok;
}

export async function getGuildBans(guildId: string) {
  return (await botFetch<Array<{ user: { id: string; username: string } }>>(`/guilds/${guildId}/bans?limit=1000`)) ?? [];
}

export async function clearGuildXp(guildId: string, userId?: string) {
  // This helper is intentionally kept out of the REST layer; callers update the scoped Supabase rows.
  return { guildId, userId };
}
