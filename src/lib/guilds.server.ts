import {
  canManageGuild,
  fetchBotGuild,
  fetchGuildChannels,
  fetchGuildRoles,
  fetchUserGuilds,
} from "./discord-api.server";
import { MODULE_DEFAULTS, withDefaults } from "./module-defaults";
import type { ModuleKey } from "./discord";
import { requireSessionUser } from "./session.server";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export interface ManageableGuild {
  id: string;
  name: string;
  icon: string | null;
  botPresent: boolean;
  memberCount: number | null;
}

export async function listManageableGuilds(): Promise<ManageableGuild[]> {
  const user = await requireSessionUser();
  const db = await admin();
  const { data: row } = await db
    .from("discord_users")
    .select("access_token")
    .eq("id", user.id)
    .maybeSingle();
  if (!row?.access_token) return [];

  const guilds = (await fetchUserGuilds(row.access_token)).filter(canManageGuild);
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
  return results.sort((a, b) => Number(b.botPresent) - Number(a.botPresent) || a.name.localeCompare(b.name));
}

export async function assertGuildAccess(guildId: string) {
  const user = await requireSessionUser();
  const db = await admin();
  const { data: row } = await db
    .from("discord_users")
    .select("access_token")
    .eq("id", user.id)
    .maybeSingle();
  if (!row?.access_token) throw new Error("UNAUTHENTICATED");
  const guilds = await fetchUserGuilds(row.access_token);
  const match = guilds.find((g) => g.id === guildId && canManageGuild(g));
  if (!match) throw new Error("FORBIDDEN");
  return { user, guild: match };
}

export async function ensureGuildRow(guildId: string, name: string, icon: string | null) {
  const db = await admin();
  await db
    .from("guilds")
    .upsert({ id: guildId, name, icon, updated_at: new Date().toISOString() }, { onConflict: "id" });
}

export async function loadGuildWorkspace(guildId: string) {
  const { guild } = await assertGuildAccess(guildId);
  const botGuild = await fetchBotGuild(guildId);
  if (!botGuild) {
    return {
      botPresent: false as const,
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
      enabled: found?.enabled ?? false,
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
      config: withDefaults(moduleKey, config),
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
  id?: string;
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
    data: input.data,
    updated_at: new Date().toISOString(),
  };
  if (input.id) {
    const { error } = await db.from("guild_items").update(payload).eq("id", input.id).eq("guild_id", input.guildId);
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
    db.from("member_levels").select("user_id, username, avatar, xp, level").eq("guild_id", guildId).order("xp", { ascending: false }).limit(10),
    db.from("moderation_cases").select("*").eq("guild_id", guildId).order("created_at", { ascending: false }).limit(10),
    db.from("suggestions").select("id, content, status, upvotes, downvotes, author_name, created_at").eq("guild_id", guildId).order("created_at", { ascending: false }).limit(5),
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
