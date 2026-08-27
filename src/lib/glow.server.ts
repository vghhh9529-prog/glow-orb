import { randomInt } from "node:crypto";
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

export interface GlowTransferResult {
  ok: boolean;
  reason?: "self" | "invalid_amount" | "insufficient_funds" | "conflict" | "storage";
  amount?: number;
  senderBalance?: number;
  recipientBalance?: number;
}

async function ensureWalletForUser(db: Awaited<ReturnType<typeof admin>>, userId: string) {
  await db.from("glow_wallets").upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
}

/**
 * Calls the Supabase transaction that locks both wallets in a stable order,
 * changes both balances, and inserts both ledger rows atomically.
 */
export async function transferGlowCoin(senderId: string, recipientId: string, amount: number): Promise<GlowTransferResult> {
  if (senderId === recipientId) return { ok: false, reason: "self" };
  if (!Number.isInteger(amount) || amount < 1 || amount > 1_000_000_000) return { ok: false, reason: "invalid_amount" };
  const db = await admin();
  await ensureWalletForUser(db, senderId);
  await ensureWalletForUser(db, recipientId);
  const { data, error } = await db.rpc("transfer_glow_coin", {
    p_sender_id: senderId,
    p_recipient_id: recipientId,
    p_amount: amount,
  });
  if (error) {
    console.error("Glow Coin transfer RPC failed", error);
    return { ok: false, reason: "storage" };
  }
  const result = typeof data === "object" && data !== null && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : {};
  if (result["ok"] === true) {
    return {
      ok: true,
      amount: Number(result["amount"] ?? amount),
      senderBalance: Number(result["sender_balance"] ?? 0),
      recipientBalance: Number(result["recipient_balance"] ?? 0),
    };
  }
  const reason = result["reason"];
  if (reason === "self" || reason === "invalid_amount" || reason === "insufficient_funds" || reason === "conflict") {
    return { ok: false, reason, senderBalance: Number(result["sender_balance"] ?? 0) };
  }
  return { ok: false, reason: "storage" };
}

export interface GlowTransferParty {
  id: string;
  username: string;
  globalName?: string | null;
  avatar?: string | null;
}

export interface GlowTransferChallenge {
  id: string;
  guildId: string;
  channelId: string;
  senderId: string;
  recipientId: string;
  senderName: string;
  recipientName: string;
  amount: number;
  code: string;
  expiresAt: string;
  attempts?: number;
}

export type GlowTransferChallengeResult =
  | { ok: true; challenge: GlowTransferChallenge }
  | { ok: false; reason: "self" | "invalid_amount" | "insufficient_funds" | "storage"; balance?: number };

async function ensureGlowParty(db: Awaited<ReturnType<typeof admin>>, party: GlowTransferParty) {
  const { error: userError } = await db.from("discord_users").upsert(
    {
      id: party.id,
      username: party.username,
      global_name: party.globalName ?? null,
      avatar: party.avatar ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (userError) {
    console.error(`Glow Coin transfer user upsert failed for ${party.id}`, userError);
    return false;
  }
  const { error: walletError } = await db.from("glow_wallets").upsert({ user_id: party.id }, { onConflict: "user_id", ignoreDuplicates: true });
  if (walletError) {
    console.error(`Glow Coin transfer wallet upsert failed for ${party.id}`, walletError);
    return false;
  }
  return true;
}

export async function createGlowTransferChallenge(input: {
  guildId: string;
  channelId: string;
  sender: GlowTransferParty;
  recipient: GlowTransferParty;
  amount: number;
}): Promise<GlowTransferChallengeResult> {
  if (input.sender.id === input.recipient.id) return { ok: false, reason: "self" };
  if (!Number.isInteger(input.amount) || input.amount < 1 || input.amount > 1_000_000_000) return { ok: false, reason: "invalid_amount" };
  const db = await admin();
  if (!(await ensureGlowParty(db, input.sender)) || !(await ensureGlowParty(db, input.recipient))) {
    return { ok: false, reason: "storage" };
  }
  const { data: senderWallet } = await db.from("glow_wallets").select("balance").eq("user_id", input.sender.id).maybeSingle();
  const balance = Number(senderWallet?.balance ?? 0);
  if (balance < input.amount) return { ok: false, reason: "insufficient_funds", balance };

  const { data: previousChallenges } = await db
    .from("guild_items")
    .select("id, data")
    .eq("guild_id", input.guildId)
    .eq("kind", "glow_transfer_challenge")
    .eq("enabled", true)
    .limit(25);
  for (const previous of previousChallenges ?? []) {
    const previousData = (previous.data ?? {}) as Record<string, unknown>;
    if (previousData["senderId"] === input.sender.id && previousData["channelId"] === input.channelId) {
      await db.from("guild_items").delete().eq("id", previous.id).eq("guild_id", input.guildId);
    }
  }

  const challenge: Omit<GlowTransferChallenge, "id"> = {
    guildId: input.guildId,
    channelId: input.channelId,
    senderId: input.sender.id,
    recipientId: input.recipient.id,
    senderName: input.sender.globalName ?? input.sender.username,
    recipientName: input.recipient.globalName ?? input.recipient.username,
    amount: input.amount,
    code: String(randomInt(1000, 10000)),
    expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    attempts: 0,
  };
  const { data: saved, error } = await db
    .from("guild_items")
    .insert({
      guild_id: input.guildId,
      kind: "glow_transfer_challenge",
      name: `transfer-${input.sender.id}-${input.recipient.id}`,
      enabled: true,
      data: challenge,
    })
    .select("id")
    .maybeSingle();
  if (error || !saved?.id) {
    if (error) console.error("Glow Coin transfer challenge insert failed", error);
    return { ok: false, reason: "storage" };
  }
  return { ok: true, challenge: { ...challenge, id: saved.id } };
}

export type GlowTransferConfirmationResult =
  | { ok: true; amount: number; senderName: string; recipientName: string }
  | { ok: false; reason: "none" | "expired" | "invalid_code" | "too_many_attempts" | "self" | "invalid_amount" | "insufficient_funds" | "conflict" | "storage"; balance?: number };

export async function confirmGlowTransfer(input: {
  guildId: string;
  channelId: string;
  senderId: string;
  code: string;
}): Promise<GlowTransferConfirmationResult> {
  const db = await admin();
  const { data: rows } = await db
    .from("guild_items")
    .select("id, data")
    .eq("guild_id", input.guildId)
    .eq("kind", "glow_transfer_challenge")
    .eq("enabled", true)
    .limit(25);
  const match = (rows ?? []).find((row) => {
    const data = (row.data ?? {}) as Record<string, unknown>;
    return data["senderId"] === input.senderId && data["channelId"] === input.channelId;
  });
  if (!match) return { ok: false, reason: "none" };
  const data = (match.data ?? {}) as Record<string, unknown>;
  const expiresAt = String(data["expiresAt"] ?? "");
  if (!expiresAt || Date.now() >= new Date(expiresAt).getTime()) {
    await db.from("guild_items").delete().eq("id", match.id).eq("guild_id", input.guildId);
    return { ok: false, reason: "expired" };
  }
  if (!/^\d{4}$/.test(input.code) || input.code !== String(data["code"] ?? "")) {
    const attempts = Number(data["attempts"] ?? 0) + 1;
    if (attempts >= 5) {
      await db.from("guild_items").delete().eq("id", match.id).eq("guild_id", input.guildId);
      return { ok: false, reason: "too_many_attempts" };
    }
    await db.from("guild_items").update({ data: { ...data, attempts } }).eq("id", match.id).eq("guild_id", input.guildId).eq("enabled", true);
    return { ok: false, reason: "invalid_code" };
  }

  const { data: claimedChallenge } = await db
    .from("guild_items")
    .update({ enabled: false })
    .eq("id", match.id)
    .eq("guild_id", input.guildId)
    .eq("enabled", true)
    .select("id")
    .maybeSingle();
  if (!claimedChallenge) return { ok: false, reason: "none" };

  const transfer = await transferGlowCoin(String(data["senderId"]), String(data["recipientId"]), Number(data["amount"]));
  if (!transfer.ok) {
    if (transfer.reason === "storage") {
      // Keep the challenge available when the database/RPC is temporarily unavailable.
      // The code can be retried after the deployment or migration is repaired.
      await db.from("guild_items").update({ enabled: true }).eq("id", match.id).eq("guild_id", input.guildId);
    } else {
      await db.from("guild_items").delete().eq("id", match.id).eq("guild_id", input.guildId);
    }
    const reason = transfer.reason ?? "storage";
    return transfer.senderBalance === undefined
      ? { ok: false, reason }
      : { ok: false, reason, balance: transfer.senderBalance };
  }
  await db.from("guild_items").delete().eq("id", match.id).eq("guild_id", input.guildId);
  return {
    ok: true,
    amount: transfer.amount ?? Number(data["amount"]),
    senderName: String(data["senderName"] ?? "Sender"),
    recipientName: String(data["recipientName"] ?? "Recipient"),
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
