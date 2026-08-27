import { requireSessionUser } from "./session.server";

export const DAILY_COOLDOWN_HOURS = 12;
export const DAILY_BASE = 250;
export const DAILY_STREAK_BONUS = 50;
export const DAILY_STREAK_CAP = 10;

export function dailyRewardForStreak(streak: number) {
  const safeStreak = Number.isFinite(streak) ? Math.max(1, Math.floor(streak)) : 1;
  return DAILY_BASE + Math.min(safeStreak, DAILY_STREAK_CAP) * DAILY_STREAK_BONUS;
}

export function dailyStreakForClaim(lastDailyAt: string | null | undefined, currentStreak: number, now = Date.now()) {
  if (!lastDailyAt) return 1;
  const last = new Date(lastDailyAt).getTime();
  if (!Number.isFinite(last) || now >= last + 36 * 3600_000) return 1;
  return Math.min(Math.max(0, Math.floor(currentStreak)) + 1, 999);
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function loadWallet() {
  const user = await requireSessionUser();
  const db = await admin();
  await db.from("glow_wallets").upsert({ user_id: user.id }, { onConflict: "user_id", ignoreDuplicates: true });
  const { data: wallet } = await db.from("glow_wallets").select("*").eq("user_id", user.id).maybeSingle();
  const { data: history } = await db
    .from("glow_transactions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(15);

  const last = wallet?.last_daily_at ? new Date(wallet.last_daily_at).getTime() : 0;
  const nextAt = last + DAILY_COOLDOWN_HOURS * 3600_000;
  const nextStreak = dailyStreakForClaim(wallet?.last_daily_at ?? null, Number(wallet?.streak ?? 0));
  const nextReward = dailyRewardForStreak(nextStreak);
  return {
    balance: Number(wallet?.balance ?? 0),
    streak: wallet?.streak ?? 0,
    totalEarned: Number(wallet?.total_earned ?? 0),
    lastDailyAt: wallet?.last_daily_at ?? null,
    nextDailyAt: last ? new Date(nextAt).toISOString() : null,
    nextReward,
    canClaim: Date.now() >= nextAt,
    history: history ?? [],
  };
}

export async function claimDaily() {
  const user = await requireSessionUser();
  const db = await admin();
  await db.from("glow_wallets").upsert({ user_id: user.id }, { onConflict: "user_id", ignoreDuplicates: true });
  const { data: wallet } = await db.from("glow_wallets").select("*").eq("user_id", user.id).maybeSingle();

  const last = wallet?.last_daily_at ? new Date(wallet.last_daily_at).getTime() : 0;
  const now = Date.now();
  if (last && now < last + DAILY_COOLDOWN_HOURS * 3600_000) {
    return { ok: false as const, reason: "cooldown", nextAt: new Date(last + DAILY_COOLDOWN_HOURS * 3600_000).toISOString() };
  }

  // Streak continues when claimed within 36h of the last claim. The conditional
  // update below makes the cooldown check atomic across concurrent requests.
  const streak = dailyStreakForClaim(wallet?.last_daily_at ?? null, Number(wallet?.streak ?? 0), now);
  const amount = dailyRewardForStreak(streak);
  const nextLastDailyAt = new Date(now).toISOString();
  const updateQuery = db
    .from("glow_wallets")
    .update({
      balance: Number(wallet?.balance ?? 0) + amount,
      total_earned: Number(wallet?.total_earned ?? 0) + amount,
      streak,
      last_daily_at: nextLastDailyAt,
      updated_at: nextLastDailyAt,
    })
    .eq("user_id", user.id);
  const { data: updatedWallet, error: updateError } = wallet?.last_daily_at
    ? await updateQuery.eq("last_daily_at", wallet.last_daily_at).select("user_id").maybeSingle()
    : await updateQuery.is("last_daily_at", null).select("user_id").maybeSingle();
  if (updateError) throw updateError;
  if (!updatedWallet) {
    return {
      ok: false as const,
      reason: "cooldown",
      nextAt: new Date(Date.now() + DAILY_COOLDOWN_HOURS * 3600_000).toISOString(),
    };
  }

  const { error: transactionError } = await db.from("glow_transactions").insert({
    user_id: user.id,
    amount,
    kind: "daily",
    note: `Daily reward · streak ${streak}`,
  });
  if (transactionError) throw transactionError;

  return {
    ok: true as const,
    amount,
    streak,
    balance: Number(wallet?.balance ?? 0) + amount,
    nextAt: new Date(now + DAILY_COOLDOWN_HOURS * 3600_000).toISOString(),
  };
}

export async function glowLeaderboard() {
  await requireSessionUser();
  const db = await admin();
  const { data } = await db
    .from("glow_wallets")
    .select("user_id, balance, streak")
    .order("balance", { ascending: false })
    .limit(20);
  if (!data?.length) return [];
  const { data: users } = await db
    .from("discord_users")
    .select("id, username, global_name, avatar")
    .in("id", data.map((w) => w.user_id));
  return data.map((w) => {
    const u = users?.find((x) => x.id === w.user_id);
    return {
      userId: w.user_id,
      balance: Number(w.balance),
      streak: w.streak,
      username: u?.global_name || u?.username || "Unknown",
      avatar: u?.avatar ?? null,
    };
  });
}
