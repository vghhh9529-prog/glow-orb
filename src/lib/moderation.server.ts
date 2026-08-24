import {
  deleteAutoModRule,
  listAutoModRules,
  putAutoModRule,
  timeoutMember,
  unbanMember,
} from "./discord-api.server";
import { assertGuildAccess } from "./guilds.server";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function listCases(guildId: string, filter: string) {
  await assertGuildAccess(guildId);
  const db = await admin();
  let query = db
    .from("moderation_cases")
    .select("*")
    .eq("guild_id", guildId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (filter && filter !== "all") query = query.eq("action", filter);
  const { data } = await query;
  return data ?? [];
}

export async function createCase(input: {
  guildId: string;
  action: string;
  targetId: string;
  targetName?: string | undefined;
  reason: string;
  durationMinutes?: number | undefined;
}) {
  const { user } = await assertGuildAccess(input.guildId);
  const db = await admin();
  const expiresAt = input.durationMinutes
    ? new Date(Date.now() + input.durationMinutes * 60_000).toISOString()
    : null;

  let applied = false;
  if (input.action === "mute" && input.durationMinutes) {
    applied = await timeoutMember(input.guildId, input.targetId, expiresAt, input.reason);
  }

  const { error } = await db.from("moderation_cases").insert({
    guild_id: input.guildId,
    action: input.action,
    target_id: input.targetId,
    target_name: input.targetName ?? null,
    moderator_id: user.id,
    moderator_name: user.global_name || user.username,
    reason: input.reason,
    duration_minutes: input.durationMinutes ?? null,
    expires_at: expiresAt,
  });
  if (error) throw error;
  return { ok: true, applied };
}

export async function revokeCase(guildId: string, caseId: string) {
  await assertGuildAccess(guildId);
  const db = await admin();
  const { data: row } = await db
    .from("moderation_cases")
    .select("*")
    .eq("id", caseId)
    .eq("guild_id", guildId)
    .maybeSingle();
  if (!row) throw new Error("NOT_FOUND");

  let applied = false;
  if (row.action === "mute")
    applied = await timeoutMember(guildId, row.target_id, null, "Revoked from Glow dashboard");
  if (row.action === "ban")
    applied = await unbanMember(guildId, row.target_id, "Revoked from Glow dashboard");

  await db
    .from("moderation_cases")
    .update({ active: false })
    .eq("id", caseId)
    .eq("guild_id", guildId);
  return { ok: true, applied };
}

const KEYWORD_PRESETS: Record<
  string,
  { name: string; keywords?: string[]; regex?: string[]; presets?: number[] }
> = {
  invites: {
    name: "Glow · Anti Invite",
    regex: ["(discord\\.(gg|io|me|li)|discordapp\\.com\\/invite)\\/[a-zA-Z0-9]+"],
  },
  links: {
    name: "Glow · Anti Link",
    regex: ["https?:\\/\\/[^\\s]+"],
  },
  badWords: { name: "Glow · Bad Words", keywords: [] },
  profanity: { name: "Glow · Profanity", presets: [1, 2, 3] },
};

export async function syncAutoMod(guildId: string, config: Record<string, unknown>) {
  await assertGuildAccess(guildId);
  const presets = (config["presets"] ?? {}) as Record<string, Record<string, unknown>>;
  const logChannelId = (config["logChannelId"] as string) || "";
  const exemptRoles = (config["exemptRoles"] as string[]) ?? [];
  const exemptChannels = (config["exemptChannels"] as string[]) ?? [];

  const existing = await listAutoModRules(guildId);
  const results: Array<{ key: string; ok: boolean; error?: string }> = [];

  const actionsFor = (timeoutSeconds: number) => {
    const actions: Record<string, unknown>[] = [
      { type: 1, metadata: { custom_message: "🚫 تم حظر هذه الرسالة بواسطة Glow" } },
    ];
    if (logChannelId) actions.push({ type: 2, metadata: { channel_id: logChannelId } });
    if (timeoutSeconds > 0)
      actions.push({ type: 3, metadata: { duration_seconds: Math.min(timeoutSeconds, 2419200) } });
    return actions;
  };

  const ensureRule = async (
    key: string,
    name: string,
    triggerType: number,
    metadata: Record<string, unknown>,
    timeoutSeconds: number,
  ) => {
    const prior = existing.find((r) => r.name === name);
    if (prior) await deleteAutoModRule(guildId, prior.id);
    const res = await putAutoModRule(guildId, {
      name,
      event_type: 1,
      trigger_type: triggerType,
      trigger_metadata: metadata,
      actions: actionsFor(timeoutSeconds),
      enabled: true,
      exempt_roles: exemptRoles.slice(0, 20),
      exempt_channels: exemptChannels.slice(0, 50),
    });
    results.push(
      res.ok ? { key, ok: true } : { key, ok: false, error: String(res.error).slice(0, 200) },
    );
  };

  const removeRule = async (name: string) => {
    const prior = existing.find((r) => r.name === name);
    if (prior) await deleteAutoModRule(guildId, prior.id);
  };

  // Spam (trigger 3)
  if (presets["spam"]?.["enabled"]) {
    await ensureRule("spam", "Glow · Spam", 3, {}, Number(presets["spam"]["timeoutSeconds"] ?? 0));
  } else await removeRule("Glow · Spam");

  // Mention spam (trigger 5)
  if (presets["mentionSpam"]?.["enabled"]) {
    await ensureRule(
      "mentionSpam",
      "Glow · Mention Spam",
      5,
      { mention_total_limit: Math.min(Number(presets["mentionSpam"]["limit"] ?? 5), 50) },
      Number(presets["mentionSpam"]["timeoutSeconds"] ?? 0),
    );
  } else await removeRule("Glow · Mention Spam");

  // Bad words (trigger 1 keyword)
  if (presets["badWords"]?.["enabled"]) {
    const words = ((presets["badWords"]["words"] as string[]) ?? []).filter(Boolean).slice(0, 1000);
    await ensureRule(
      "badWords",
      KEYWORD_PRESETS["badWords"]!.name,
      1,
      { keyword_filter: words },
      Number(presets["badWords"]["timeoutSeconds"] ?? 0),
    );
  } else await removeRule(KEYWORD_PRESETS["badWords"]!.name);

  // Invites
  if (presets["invites"]?.["enabled"]) {
    await ensureRule(
      "invites",
      KEYWORD_PRESETS["invites"]!.name,
      1,
      { regex_patterns: KEYWORD_PRESETS["invites"]!.regex },
      Number(presets["invites"]["timeoutSeconds"] ?? 0),
    );
  } else await removeRule(KEYWORD_PRESETS["invites"]!.name);

  // Links
  if (presets["links"]?.["enabled"]) {
    await ensureRule(
      "links",
      KEYWORD_PRESETS["links"]!.name,
      1,
      {
        regex_patterns: KEYWORD_PRESETS["links"]!.regex,
        allow_list: ((presets["links"]["allowlist"] as string[]) ?? []).slice(0, 100),
      },
      0,
    );
  } else await removeRule(KEYWORD_PRESETS["links"]!.name);

  return { ok: results.every((r) => r.ok), results };
}

export async function currentAutoModRules(guildId: string) {
  await assertGuildAccess(guildId);
  return listAutoModRules(guildId);
}

export async function listSuggestions(guildId: string, status: string) {
  await assertGuildAccess(guildId);
  const db = await admin();
  let query = db
    .from("suggestions")
    .select("*")
    .eq("guild_id", guildId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (status && status !== "all") query = query.eq("status", status);
  const { data } = await query;
  return data ?? [];
}

export async function setSuggestionStatus(
  guildId: string,
  id: string,
  status: string,
  note: string,
) {
  await assertGuildAccess(guildId);
  const db = await admin();
  await db
    .from("suggestions")
    .update({ status, staff_note: note, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("guild_id", guildId);
  return { ok: true };
}

export async function guildLeaderboard(guildId: string, scope: string) {
  await assertGuildAccess(guildId);
  const db = await admin();
  const column =
    scope === "daily"
      ? "daily_xp"
      : scope === "weekly"
        ? "weekly_xp"
        : scope === "monthly"
          ? "monthly_xp"
          : "xp";
  const { data } = await db
    .from("member_levels")
    .select("user_id, username, avatar, xp, level, daily_xp, weekly_xp, monthly_xp")
    .eq("guild_id", guildId)
    .order(column, { ascending: false })
    .limit(50);
  return data ?? [];
}
