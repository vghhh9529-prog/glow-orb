import { fetchBotGuild } from "./discord-api.server";
import { ensureGuildRow } from "./guilds.server";

const DAILY_COOLDOWN_MS = 12 * 60 * 60_000;
const DAILY_BASE = 250;
const DAILY_STREAK_BONUS = 50;
const DAILY_STREAK_CAP = 10;

export interface InteractionUser {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
}

export interface DiscordInteractionOption {
  name: string;
  value?: string | number | boolean;
  options?: DiscordInteractionOption[];
}

export interface DiscordInteractionPayload {
  type: number;
  token?: string;
  guild_id?: string;
  user?: InteractionUser;
  member?: { user?: InteractionUser };
  data?: { name?: string; options?: DiscordInteractionOption[] };
}

export function interactionUser(payload: DiscordInteractionPayload): InteractionUser | null {
  return payload.member?.user ?? payload.user ?? null;
}

export function interactionOption<T extends string | number | boolean>(
  payload: DiscordInteractionPayload,
  name: string,
): T | undefined {
  const option = payload.data?.options?.find((item) => item.name === name);
  return option?.value as T | undefined;
}

function decodeHex(value: string): Uint8Array | null {
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2 !== 0) return null;
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

export async function verifyDiscordRequest(request: Request, body: string): Promise<boolean> {
  const publicKey =
    process.env["DISCORD_PUBLIC_KEY"] ?? process.env["DISCORD_APPLICATION_PUBLIC_KEY"];
  const signature = request.headers.get("x-signature-ed25519");
  const timestamp = request.headers.get("x-signature-timestamp");
  if (!publicKey || !signature || !timestamp) return false;

  const keyBytes = decodeHex(publicKey);
  const signatureBytes = decodeHex(signature);
  if (!keyBytes || !signatureBytes || keyBytes.length !== 32 || signatureBytes.length !== 64)
    return false;

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      keyBytes as unknown as BufferSource,
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    return await crypto.subtle.verify(
      { name: "Ed25519" },
      key,
      signatureBytes as unknown as BufferSource,
      new TextEncoder().encode(`${timestamp}${body}`) as unknown as BufferSource,
    );
  } catch (error) {
    console.error("Discord interaction signature verification failed", error);
    return false;
  }
}

export function interactionResponse(content: string, options?: { ephemeral?: boolean }) {
  return Response.json({
    type: 4,
    data: {
      content,
      ...(options?.ephemeral ? { flags: 64 } : {}),
    },
  });
}

export function pingResponse() {
  return Response.json({ type: 1 });
}

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function ensureUser(user: InteractionUser) {
  const database = await db();
  await database.from("discord_users").upsert(
    {
      id: user.id,
      username: user.username,
      global_name: user.global_name ?? null,
      avatar: user.avatar ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  await database
    .from("glow_wallets")
    .upsert({ user_id: user.id }, { onConflict: "user_id", ignoreDuplicates: true });
}

async function daily(user: InteractionUser) {
  await ensureUser(user);
  const database = await db();
  const { data: wallet } = await database
    .from("glow_wallets")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  const last = wallet?.last_daily_at ? new Date(wallet.last_daily_at).getTime() : 0;
  const now = Date.now();
  if (last && now < last + DAILY_COOLDOWN_MS) {
    const remainingMinutes = Math.max(1, Math.ceil((last + DAILY_COOLDOWN_MS - now) / 60_000));
    return interactionResponse(`المكافأة القادمة متاحة بعد **${remainingMinutes} دقيقة**.`, {
      ephemeral: true,
    });
  }

  const streak =
    last && now < last + 36 * 60 * 60_000 ? Math.min(Number(wallet?.streak ?? 0) + 1, 999) : 1;
  const amount = DAILY_BASE + Math.min(streak, DAILY_STREAK_CAP) * DAILY_STREAK_BONUS;
  await database.from("glow_wallets").upsert(
    {
      user_id: user.id,
      balance: Number(wallet?.balance ?? 0) + amount,
      total_earned: Number(wallet?.total_earned ?? 0) + amount,
      streak,
      last_daily_at: new Date(now).toISOString(),
      updated_at: new Date(now).toISOString(),
    },
    { onConflict: "user_id" },
  );
  await database.from("glow_transactions").insert({
    user_id: user.id,
    amount,
    kind: "daily",
    note: `Discord daily · streak ${streak}`,
  });
  return interactionResponse(`استلمت **${amount} Glow**. الستريك الحالي: **${streak}**.`, {
    ephemeral: true,
  });
}

async function balance(user: InteractionUser, targetId = user.id) {
  await ensureUser(user);
  const database = await db();
  const { data: wallet } = await database
    .from("glow_wallets")
    .select("balance, streak, total_earned")
    .eq("user_id", targetId)
    .maybeSingle();
  const label = targetId === user.id ? "رصيدك" : "رصيد العضو";
  return interactionResponse(
    `${label}: **${Number(wallet?.balance ?? 0)} Glow** · الستريك: **${Number(wallet?.streak ?? 0)}** · المكتسب: **${Number(wallet?.total_earned ?? 0)}**.`,
  );
}

async function rank(payload: DiscordInteractionPayload, user: InteractionUser, targetId = user.id) {
  const guildId = payload.guild_id;
  if (!guildId) return interactionResponse("هذا الأمر يعمل داخل السيرفر فقط.", { ephemeral: true });
  const database = await db();
  const { data: member } = await database
    .from("member_levels")
    .select("username, xp, level")
    .eq("guild_id", guildId)
    .eq("user_id", targetId)
    .maybeSingle();
  if (!member)
    return interactionResponse("لا توجد بيانات ليفلات لهذا العضو بعد.", { ephemeral: true });
  return interactionResponse(
    `**${member.username ?? targetId}** · المستوى **${member.level}** · **${member.xp} XP**.`,
  );
}

async function leaderboard(payload: DiscordInteractionPayload) {
  const guildId = payload.guild_id;
  if (!guildId) return interactionResponse("هذا الأمر يعمل داخل السيرفر فقط.", { ephemeral: true });
  const scope = interactionOption<string>(payload, "scope") ?? "all";
  const column =
    scope === "daily"
      ? "daily_xp"
      : scope === "weekly"
        ? "weekly_xp"
        : scope === "monthly"
          ? "monthly_xp"
          : "xp";
  const database = await db();
  const { data } = await database
    .from("member_levels")
    .select("username, user_id, xp, level, daily_xp, weekly_xp, monthly_xp")
    .eq("guild_id", guildId)
    .order(column, { ascending: false })
    .limit(10);
  const rows = (data ?? [])
    .map(
      (row, index) =>
        `${index + 1}. **${row.username ?? row.user_id}** — ${Number(row[column] ?? 0)} XP · Lv.${row.level}`,
    )
    .join("\n");
  return interactionResponse(
    rows ? `**صدارة السيرفر (${scope})**\n${rows}` : "لا توجد بيانات ليفلات بعد.",
  );
}

async function suggest(payload: DiscordInteractionPayload, user: InteractionUser) {
  const guildId = payload.guild_id;
  if (!guildId) return interactionResponse("هذا الأمر يعمل داخل السيرفر فقط.", { ephemeral: true });
  const content = interactionOption<string>(payload, "content")?.trim();
  if (!content) return interactionResponse("اكتب نص الاقتراح أولاً.", { ephemeral: true });
  const guild = await fetchBotGuild(guildId);
  if (guild) await ensureGuildRow(guildId, guild.name, guild.icon);
  const database = await db();
  const anonymous = Boolean(interactionOption<boolean>(payload, "anonymous"));
  const imageUrl = interactionOption<string>(payload, "image")?.trim() || null;
  const { error } = await database.from("suggestions").insert({
    guild_id: guildId,
    author_id: user.id,
    author_name: anonymous ? "عضو مجهول" : (user.global_name ?? user.username),
    content,
    image_url: imageUrl,
    anonymous,
  });
  if (error) {
    console.error("Discord suggestion insert failed", error);
    return interactionResponse("تعذر حفظ الاقتراح حالياً.", { ephemeral: true });
  }
  return interactionResponse("تم إرسال اقتراحك للمراجعة. شكراً لمساهمتك.", { ephemeral: true });
}

export async function handleDiscordInteraction(payload: DiscordInteractionPayload, origin: string) {
  const user = interactionUser(payload);
  const command = payload.data?.name;
  if (!user || !command) return interactionResponse("تعذر قراءة الأمر.", { ephemeral: true });

  if (command === "daily") return daily(user);
  if (command === "balance")
    return balance(user, interactionOption<string>(payload, "user") ?? user.id);
  if (command === "rank")
    return rank(payload, user, interactionOption<string>(payload, "user") ?? user.id);
  if (command === "leaderboard") return leaderboard(payload);
  if (command === "suggest") return suggest(payload, user);
  if (command === "glow")
    return interactionResponse(`Glow — Better Use Glow\nلوحة التحكم: ${origin}/dashboard`);
  if (command === "profile")
    return interactionResponse(
      `ملفك في Glow: **${user.global_name ?? user.username}**\nالأوامر: /balance · /rank · /daily`,
      { ephemeral: true },
    );
  return interactionResponse("هذا الأمر غير معروف.", { ephemeral: true });
}
