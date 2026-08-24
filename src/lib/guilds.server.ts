import type { Json } from "@/integrations/supabase/types";
import {
  canManageGuild,
  canManageGuildMember,
  fetchBotGuild,
  fetchGuildChannels,
  fetchGuildMember,
  inspectBotGuild,
  fetchGuildRoles,
  fetchUserGuilds,
  refreshAccessToken,
} from "./discord-api.server";
import { MODULE_DEFAULTS, withDefaults } from "./module-defaults";
import type { ModuleKey } from "./discord";
import { requireSessionUser } from "./session.server";
import { decryptSecret, encryptSecret, isEncryptedSecret } from "./secret-crypto.server";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function discordAccessToken(userId: string) {
  const db = await admin();
  const { data: row } = await db
    .from("discord_users")
    .select("access_token, refresh_token, token_expires_at")
    .eq("id", userId)
    .maybeSingle();
  const accessToken = decryptSecret(row?.access_token);
  if (!accessToken) return null;
  const refreshToken = decryptSecret(row?.refresh_token);
  const expiresAt = row?.token_expires_at ? new Date(row.token_expires_at).getTime() : 0;
  if (refreshToken && expiresAt > 0 && expiresAt <= Date.now() + 5 * 60_000) {
    try {
      const refreshed = await refreshAccessToken(refreshToken);
      const refreshedExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
      await db
        .from("discord_users")
        .update({
          access_token: encryptSecret(refreshed.access_token),
          refresh_token: encryptSecret(refreshed.refresh_token || refreshToken),
          token_expires_at: refreshedExpiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);
      return refreshed.access_token;
    } catch {
      if (expiresAt <= Date.now()) return null;
    }
  }

  if (!isEncryptedSecret(row?.access_token) || (row?.refresh_token && !isEncryptedSecret(row.refresh_token))) {
    await db
      .from("discord_users")
      .update({
        access_token: encryptSecret(accessToken),
        ...(refreshToken ? { refresh_token: encryptSecret(refreshToken) } : {}),
      })
      .eq("id", userId);
  }
  return accessToken;
}

export interface ManageableGuild {
  id: string;
  name: string;
  icon: string | null;
  botPresent: boolean;
  memberCount: number | null;
}

async function botConfirmedGuildAccess(guildId: string, userId: string) {
  const botGuildResult = await inspectBotGuild(guildId);
  const botGuild = botGuildResult.data;
  if (!botGuild) return null;
  if (botGuild.owner_id === userId) {
    return {
      id: botGuild.id,
      name: botGuild.name,
      icon: botGuild.icon,
      owner: true,
      owner_id: botGuild.owner_id,
    };
  }

  const [member, roles] = await Promise.all([
    fetchGuildMember(guildId, userId),
    fetchGuildRoles(guildId),
  ]);
  if (!canManageGuildMember(member, roles)) return null;
  return {
    id: botGuild.id,
    name: botGuild.name,
    icon: botGuild.icon,
    owner: false,
    owner_id: botGuild.owner_id,
    permissions: "8",
  };
}

async function resolveGuildAccess(
  guildId: string,
  userId: string,
  oauthGuilds: Awaited<ReturnType<typeof fetchUserGuilds>>,
) {
  const oauthMatch = oauthGuilds.find((guild) => guild.id === guildId && canManageGuild(guild, userId));
  return oauthMatch ?? (await botConfirmedGuildAccess(guildId, userId));
}

export async function listManageableGuilds(): Promise<ManageableGuild[]> {
  const user = await requireSessionUser();
  const accessToken = await discordAccessToken(user.id);
  if (!accessToken) return [];

  const guilds = (await fetchUserGuilds(accessToken)).filter((guild) =>
    canManageGuild(guild, user.id),
  );
  const results = await Promise.all(
    guilds.map(async (g) => {
      const botGuild = await fetchBotGuild(g.id);
      return {
        id: g.id,
        name: g.name,
        icon: g.icon,
        botPresent: Boolean(botGuild),
        memberCount: botGuild?.approximate_member_count ?? null,
      } satisfies ManageableGuild;
    }),
  );
  return results.sort(
    (a, b) => Number(b.botPresent) - Number(a.botPresent) || a.name.localeCompare(b.name),
  );
}

export async function assertGuildAccess(guildId: string) {
  const user = await requireSessionUser();
  const accessToken = await discordAccessToken(user.id);
  if (!accessToken) throw new Error("UNAUTHENTICATED");
  const guilds = await fetchUserGuilds(accessToken);
  const match = await resolveGuildAccess(guildId, user.id, guilds);
  if (!match) throw new Error("FORBIDDEN");
  return { user, guild: match };
}

export async function ensureGuildRow(guildId: string, name: string, icon: string | null) {
  const db = await admin();
  await db
    .from("guilds")
    .upsert(
      { id: guildId, name, icon, updated_at: new Date().toISOString() },
      { onConflict: "id" },
    );
}

export async function loadGuildWorkspace(guildId: string) {
  const { guild } = await assertGuildAccess(guildId);
  const botCheck = await inspectBotGuild(guildId);
  const botGuild = botCheck.data;
  if (!botGuild) {
    return {
      botPresent: false as const,
      botCheckError: botCheck.status !== 404,
      guild: { id: guildId, name: guild.name, icon: guild.icon },
    };
  }
  await ensureGuildRow(guildId, botGuild.name, botGuild.icon);
  const db = await admin();
  const [roles, channels, settings, modules] = await Promise.all([
    fetchGuildRoles(guildId),
    fetchGuildChannels(guildId),
    db.from("guilds").select("*").eq("id", guildId).maybeSingle(),
    db.from("guild_modules").select("module, enabled, config").eq("guild_id", guildId),
  ]);

  const moduleMap: Record<string, { enabled: boolean; config: Record<string, unknown> }> = {};
  for (const key of Object.keys(MODULE_DEFAULTS) as ModuleKey[]) {
    const found = modules.data?.find((m) => m.module === key);
    moduleMap[key] = {
      enabled: found?.enabled ?? (key === "commands" || key === "tickets"),
      config: withDefaults(key, found?.config),
    };
  }

  return {
    botPresent: true as const,
    guild: {
      id: guildId,
      name: botGuild.name,
      icon: botGuild.icon,
      memberCount: botGuild.approximate_member_count ?? 0,
      onlineCount: botGuild.approximate_presence_count ?? 0,
      boostCount: botGuild.premium_subscription_count ?? 0,
      ownerId: botGuild.owner_id,
    },
    settings: settings.data ?? null,
    roles: roles
      .filter((r) => r.name !== "@everyone")
      .sort((a, b) => b.position - a.position)
      .map((r) => ({ id: r.id, name: r.name, color: r.color, managed: r.managed })),
    channels: channels
      .filter((c) => [0, 2, 4, 5, 13, 15].includes(c.type))
      .sort((a, b) => a.position - b.position)
      .map((c) => ({ id: c.id, name: c.name, type: c.type, parentId: c.parent_id })),
    modules: moduleMap,
  };
}

export async function saveModuleConfig(
  guildId: string,
  moduleKey: ModuleKey,
  enabled: boolean,
  config: Record<string, unknown>,
) {
  await assertGuildAccess(guildId);
  const botGuild = await fetchBotGuild(guildId);
  if (!botGuild) throw new Error("BOT_NOT_IN_GUILD");
  await ensureGuildRow(guildId, botGuild.name, botGuild.icon);
  const db = await admin();
  const { error } = await db.from("guild_modules").upsert(
    {
      guild_id: guildId,
      module: moduleKey,
      enabled,
      config: withDefaults(moduleKey, config) as Json,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "guild_id,module" },
  );
  if (error) throw error;
  return { ok: true };
}

export async function listGuildItems(guildId: string, kind: string) {
  await assertGuildAccess(guildId);
  const db = await admin();
  const { data } = await db
    .from("guild_items")
    .select("*")
    .eq("guild_id", guildId)
    .eq("kind", kind)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function upsertGuildItem(input: {
  guildId: string;
  kind: string;
  id?: string | undefined;
  name: string;
  enabled: boolean;
  data: Record<string, unknown>;
}) {
  await assertGuildAccess(input.guildId);
  const botGuild = await fetchBotGuild(input.guildId);
  if (botGuild) await ensureGuildRow(input.guildId, botGuild.name, botGuild.icon);
  const db = await admin();
  const payload = {
    guild_id: input.guildId,
    kind: input.kind,
    name: input.name,
    enabled: input.enabled,
    data: input.data as Json,
    updated_at: new Date().toISOString(),
  };
  if (input.id) {
    const { error } = await db
      .from("guild_items")
      .update(payload)
      .eq("id", input.id)
      .eq("guild_id", input.guildId);
    if (error) throw error;
  } else {
    const { error } = await db.from("guild_items").insert(payload);
    if (error) throw error;
  }
  return { ok: true };
}

export async function deleteGuildItem(guildId: string, id: string) {
  await assertGuildAccess(guildId);
  const db = await admin();
  await db.from("guild_items").delete().eq("id", id).eq("guild_id", guildId);
  return { ok: true };
}

export async function guildOverview(guildId: string) {
  await assertGuildAccess(guildId);
  const db = await admin();
  const [levels, cases, suggestions, items] = await Promise.all([
    db
      .from("member_levels")
      .select("user_id, username, avatar, xp, level")
      .eq("guild_id", guildId)
      .order("xp", { ascending: false })
      .limit(10),
    db
      .from("moderation_cases")
      .select("*")
      .eq("guild_id", guildId)
      .order("created_at", { ascending: false })
      .limit(10),
    db
      .from("suggestions")
      .select("id, content, status, upvotes, downvotes, author_name, created_at")
      .eq("guild_id", guildId)
      .order("created_at", { ascending: false })
      .limit(5),
    db.from("guild_items").select("kind").eq("guild_id", guildId),
  ]);
  const counts: Record<string, number> = {};
  for (const row of items.data ?? []) counts[row.kind] = (counts[row.kind] ?? 0) + 1;
  return {
    topMembers: levels.data ?? [],
    recentCases: cases.data ?? [],
    recentSuggestions: suggestions.data ?? [],
    itemCounts: counts,
  };
}
