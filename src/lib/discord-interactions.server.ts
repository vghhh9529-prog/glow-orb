import {
  banMember,
  clearChannelMessages,
  fetchBotGuild,
  fetchDiscordUser,
  fetchGuildRoles,
  kickMember,
  timeoutMember,
  unbanMember,
} from "./discord-api.server";
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
  member?: { user?: InteractionUser; permissions?: string };
  channel_id?: string;
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

function hasPermission(payload: DiscordInteractionPayload, permission: bigint) {
  const raw = payload.member?.permissions;
  if (!raw) return false;
  try {
    const value = BigInt(raw);
    return (value & 0x8n) === 0x8n || (value & permission) === permission;
  } catch {
    return false;
  }
}

function permissionDenied() {
  return interactionResponse("تحتاج صلاحية مناسبة لتنفيذ هذا الأمر.", { ephemeral: true });
}

async function recordModerationCase(
  payload: DiscordInteractionPayload,
  moderator: InteractionUser,
  action: string,
  targetId: string,
  reason: string,
  durationMinutes?: number,
) {
  const guildId = payload.guild_id;
  if (!guildId) return;
  const guild = await fetchBotGuild(guildId);
  if (guild) await ensureGuildRow(guildId, guild.name, guild.icon);
  const database = await db();
  await database.from("moderation_cases").insert({
    guild_id: guildId,
    action,
    target_id: targetId,
    target_name: `<@${targetId}>`,
    moderator_id: moderator.id,
    moderator_name: moderator.global_name ?? moderator.username,
    reason: reason.slice(0, 500),
    duration_minutes: durationMinutes ?? null,
    expires_at: durationMinutes
      ? new Date(Date.now() + durationMinutes * 60_000).toISOString()
      : null,
  });
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

async function serverInfo(payload: DiscordInteractionPayload) {
  const guildId = payload.guild_id;
  if (!guildId) return interactionResponse("هذا الأمر يعمل داخل السيرفر فقط.", { ephemeral: true });
  const guild = await fetchBotGuild(guildId);
  if (!guild) return interactionResponse("تعذر قراءة معلومات السيرفر حالياً.", { ephemeral: true });
  return interactionResponse(
    `**${guild.name}**\nالأعضاء: **${Number(guild.approximate_member_count ?? 0).toLocaleString("ar-SA")}** · المتصلون: **${Number(guild.approximate_presence_count ?? 0).toLocaleString("ar-SA")}**\nالمالك: <@${guild.owner_id}>\nمعرّف السيرفر: \`${guild.id}\``,
  );
}

async function userInfo(payload: DiscordInteractionPayload, user: InteractionUser) {
  const targetId = interactionOption<string>(payload, "member") ?? user.id;
  const target = targetId === user.id ? user : await fetchDiscordUser(targetId);
  if (!target) return interactionResponse("تعذر العثور على هذا العضو.", { ephemeral: true });
  const displayName = target.global_name ?? target.username;
  return interactionResponse(
    `**${displayName}**\nاسم الحساب: \`${target.username}\`\nالمعرّف: \`${target.id}\`\nالصورة: ${target.avatar ? target.avatar : "لا توجد صورة"}`,
  );
}

async function avatarInfo(payload: DiscordInteractionPayload, user: InteractionUser) {
  const targetId = interactionOption<string>(payload, "member") ?? user.id;
  const target = targetId === user.id ? user : await fetchDiscordUser(targetId);
  if (!target) return interactionResponse("تعذر العثور على هذا العضو.", { ephemeral: true });
  return interactionResponse(
    `صورة **${target.global_name ?? target.username}**:\n${target.avatar ?? "لا توجد صورة متاحة."}`,
  );
}

async function rolesInfo(payload: DiscordInteractionPayload) {
  const guildId = payload.guild_id;
  if (!guildId) return interactionResponse("هذا الأمر يعمل داخل السيرفر فقط.", { ephemeral: true });
  const roles = (await fetchGuildRoles(guildId)).filter((role) => !role.managed).sort((a, b) => b.position - a.position);
  if (roles.length === 0) return interactionResponse("لا توجد رولات قابلة للعرض حالياً.", { ephemeral: true });
  const visible = roles.slice(0, 20).map((role) => `• **${role.name}** · \`${role.id}\``).join("\n");
  const suffix = roles.length > 20 ? `\n… و ${roles.length - 20} رول إضافي.` : "";
  return interactionResponse(`**رولات السيرفر (${roles.length})**\n${visible}${suffix}`);
}

function discordAssetUrl(base: string, id: string, hash: string | null | undefined, size = 1024) {
  if (!hash) return null;
  const extension = hash.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/${base}/${id}/${hash}.${extension}?size=${size}`;
}

async function colorsInfo(payload: DiscordInteractionPayload) {
  const guildId = payload.guild_id;
  if (!guildId) return interactionResponse("هذا الأمر يعمل داخل السيرفر فقط.", { ephemeral: true });
  const roles = (await fetchGuildRoles(guildId)).filter((role) => !role.managed && role.color > 0).sort((a, b) => b.position - a.position);
  if (roles.length === 0) return interactionResponse("لا توجد رولات ملوّنة في السيرفر حالياً.", { ephemeral: true });
  const rows = roles.slice(0, 20).map((role) => `• **${role.name}** · \`#${role.color.toString(16).padStart(6, "0").toUpperCase()}\``).join("\n");
  return interactionResponse(`**ألوان الرولات (${roles.length})**\n${rows}${roles.length > 20 ? `\n… و ${roles.length - 20} لون إضافي.` : ""}`);
}

async function rollInfo() {
  const result = Math.floor(Math.random() * 6) + 1;
  return interactionResponse(`🎲 النتيجة: **${result}** من 6.`);
}

async function bannerInfo(payload: DiscordInteractionPayload, user: InteractionUser) {
  const targetId = interactionOption<string>(payload, "member") ?? user.id;
  const target = (await fetchDiscordUser(targetId)) ?? (targetId === user.id ? user : null);
  if (!target) return interactionResponse("تعذر العثور على هذا العضو.", { ephemeral: true });
  const banner = "banner" in target && typeof target.banner === "string" ? target.banner : null;
  const url = discordAssetUrl("banners", target.id, banner, 1024);
  return interactionResponse(url ? `بانر **${target.global_name ?? target.username}**:\n${url}` : "هذا العضو لا يملك بانراً متاحاً.", { ephemeral: true });
}

async function serverAvatarInfo(payload: DiscordInteractionPayload) {
  const guildId = payload.guild_id;
  if (!guildId) return interactionResponse("هذا الأمر يعمل داخل السيرفر فقط.", { ephemeral: true });
  const guild = await fetchBotGuild(guildId);
  if (!guild) return interactionResponse("تعذر قراءة السيرفر حالياً.", { ephemeral: true });
  const url = discordAssetUrl("icons", guild.id, guild.icon, 1024);
  return interactionResponse(url ? `صورة **${guild.name}**:\n${url}` : "السيرفر لا يملك صورة حالياً.", { ephemeral: true });
}

async function serverBannerInfo(payload: DiscordInteractionPayload) {
  const guildId = payload.guild_id;
  if (!guildId) return interactionResponse("هذا الأمر يعمل داخل السيرفر فقط.", { ephemeral: true });
  const guild = await fetchBotGuild(guildId);
  if (!guild) return interactionResponse("تعذر قراءة السيرفر حالياً.", { ephemeral: true });
  const url = discordAssetUrl("banners", guild.id, guild.banner, 1024);
  return interactionResponse(url ? `بانر **${guild.name}**:\n${url}` : "السيرفر لا يملك بانراً حالياً.", { ephemeral: true });
}

async function clearInfo(payload: DiscordInteractionPayload, user: InteractionUser) {
  const channelId = payload.channel_id;
  const amount = Math.min(100, Math.max(1, Number(interactionOption<number>(payload, "amount") ?? 1)));
  if (!payload.guild_id || !channelId) return interactionResponse("هذا الأمر يعمل داخل قناة السيرفر فقط.", { ephemeral: true });
  if (!hasPermission(payload, 0x2000n)) return permissionDenied();
  const result = await clearChannelMessages(channelId, amount, `Glow clear by ${user.id}`);
  return result.ok
    ? interactionResponse(`تم تنظيف **${result.deleted}** رسالة.`, { ephemeral: true })
    : interactionResponse("تعذر تنظيف الرسائل. تأكد من صلاحيات Glow.", { ephemeral: true });
}

async function kickInfo(payload: DiscordInteractionPayload, user: InteractionUser) {
  const guildId = payload.guild_id;
  const targetId = interactionOption<string>(payload, "member");
  if (!guildId || !targetId) return interactionResponse("اختر عضواً داخل السيرفر.", { ephemeral: true });
  if (!hasPermission(payload, 0x2n)) return permissionDenied();
  const reason = interactionOption<string>(payload, "reason")?.trim() || "Glow moderation";
  const ok = await kickMember(guildId, targetId, reason);
  if (!ok) return interactionResponse("تعذر طرد العضو. تحقق من ترتيب الرولات والصلاحيات.", { ephemeral: true });
  await recordModerationCase(payload, user, "kick", targetId, reason);
  return interactionResponse(`تم طرد <@${targetId}>. السبب: ${reason}`);
}

async function banInfo(payload: DiscordInteractionPayload, user: InteractionUser) {
  const guildId = payload.guild_id;
  const targetId = interactionOption<string>(payload, "member");
  if (!guildId || !targetId) return interactionResponse("اختر عضواً داخل السيرفر.", { ephemeral: true });
  if (!hasPermission(payload, 0x4n)) return permissionDenied();
  const reason = interactionOption<string>(payload, "reason")?.trim() || "Glow moderation";
  const ok = await banMember(guildId, targetId, reason);
  if (!ok) return interactionResponse("تعذر حظر العضو. تحقق من ترتيب الرولات والصلاحيات.", { ephemeral: true });
  await recordModerationCase(payload, user, "ban", targetId, reason);
  return interactionResponse(`تم حظر <@${targetId}>. السبب: ${reason}`);
}

async function unbanInfo(payload: DiscordInteractionPayload, user: InteractionUser) {
  const guildId = payload.guild_id;
  const targetId = interactionOption<string>(payload, "user_id")?.trim();
  if (!guildId || !targetId) return interactionResponse("اكتب معرّف المستخدم المحظور.", { ephemeral: true });
  if (!hasPermission(payload, 0x4n)) return permissionDenied();
  const reason = interactionOption<string>(payload, "reason")?.trim() || "Glow moderation";
  const ok = await unbanMember(guildId, targetId, reason);
  if (!ok) return interactionResponse("تعذر رفع الحظر. تأكد من أن المستخدم محظور وصلاحيات Glow.", { ephemeral: true });
  await recordModerationCase(payload, user, "unban", targetId, reason);
  return interactionResponse(`تم رفع الحظر عن المستخدم \`${targetId}\`.`);
}

async function timeoutInfo(payload: DiscordInteractionPayload, user: InteractionUser, clear = false) {
  const guildId = payload.guild_id;
  const targetId = interactionOption<string>(payload, "member");
  if (!guildId || !targetId) return interactionResponse("اختر عضواً داخل السيرفر.", { ephemeral: true });
  if (!hasPermission(payload, 0x100000000000n)) return permissionDenied();
  const minutes = clear ? undefined : Math.min(40320, Math.max(1, Number(interactionOption<number>(payload, "minutes") ?? 1)));
  const reason = interactionOption<string>(payload, "reason")?.trim() || "Glow moderation";
  const until = minutes ? new Date(Date.now() + minutes * 60_000).toISOString() : null;
  const ok = await timeoutMember(guildId, targetId, until, reason);
  if (!ok) return interactionResponse("تعذر تحديث الـtimeout. تحقق من صلاحيات Glow وترتيب الرولات.", { ephemeral: true });
  await recordModerationCase(payload, user, clear ? "untimeout" : "timeout", targetId, reason, minutes);
  return interactionResponse(clear ? `تم إلغاء الـtimeout عن <@${targetId}>.` : `تم إعطاء <@${targetId}> timeout لمدة **${minutes} دقيقة**.`);
}

async function warningInfo(payload: DiscordInteractionPayload, user: InteractionUser, list = false) {
  const guildId = payload.guild_id;
  if (!guildId) return interactionResponse("هذا الأمر يعمل داخل السيرفر فقط.", { ephemeral: true });
  const targetId = interactionOption<string>(payload, "member");
  const database = await db();
  if (list) {
    let query = database.from("moderation_cases").select("target_id, target_name, reason, created_at, active").eq("guild_id", guildId).eq("action", "warn").order("created_at", { ascending: false }).limit(15);
    if (targetId) query = query.eq("target_id", targetId);
    const { data } = await query;
    if (!data?.length) return interactionResponse("لا توجد تحذيرات مسجلة.", { ephemeral: true });
    const rows = data.map((item, index) => `${index + 1}. ${item.target_name ?? `<@${item.target_id}>`} — ${item.reason ?? "بدون سبب"}`).join("\n");
    return interactionResponse(`**التحذيرات (${data.length})**\n${rows}`, { ephemeral: true });
  }
  if (!targetId) return interactionResponse("اختر عضواً وأدخل سبب التحذير.", { ephemeral: true });
  if (!hasPermission(payload, 0x200000000n)) return permissionDenied();
  const reason = interactionOption<string>(payload, "reason")?.trim();
  if (!reason) return interactionResponse("اكتب سبب التحذير.", { ephemeral: true });
  await recordModerationCase(payload, user, "warn", targetId, reason);
  return interactionResponse(`تم تسجيل تحذير على <@${targetId}>. السبب: ${reason}`);
}

async function pingInfo() {
  return interactionResponse("**Glow is online.** الاتصال بالـGateway والداشبورد يعملان.");
}

async function helpInfo() {
  return interactionResponse(
    "**أوامر Glow**\n`/server` معلومات السيرفر · `/roles` رولات السيرفر · `/colors` ألوان الرولات · `/server-avatar` صورة السيرفر · `/server-banner` بانر السيرفر · `/user` معلومات عضو · `/avatar` صورة عضو · `/banner` بانر عضو\n`/rank` اللفل وXP · `/top` الصدارة · `/leaderboard` الصدارة · `/suggest` اقتراح\n`/clear` تنظيف · `/kick` طرد · `/ban` حظر · `/unban` رفع حظر · `/timeout` تايم أوت · `/untimeout` إلغاء تايم أوت · `/warn-add` تحذير · `/warnings` التحذيرات\n`/daily` مكافأة Glow · `/balance` الرصيد · `/points-list` النقاط · `/roll` نرد · `/profile` الملف · `/ping` حالة Glow · `/glow` رابط الداشبورد",
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
  if (command === "server") return serverInfo(payload);
  if (command === "roles") return rolesInfo(payload);
  if (command === "colors") return colorsInfo(payload);
  if (command === "points-list") return balance(user);
  if (command === "roll") return rollInfo();
  if (command === "top") return leaderboard(payload);
  if (command === "banner") return bannerInfo(payload, user);
  if (command === "server-avatar") return serverAvatarInfo(payload);
  if (command === "server-banner") return serverBannerInfo(payload);
  if (command === "clear") return clearInfo(payload, user);
  if (command === "kick") return kickInfo(payload, user);
  if (command === "ban") return banInfo(payload, user);
  if (command === "unban") return unbanInfo(payload, user);
  if (command === "timeout") return timeoutInfo(payload, user);
  if (command === "untimeout") return timeoutInfo(payload, user, true);
  if (command === "warn-add") return warningInfo(payload, user);
  if (command === "warnings") return warningInfo(payload, user, true);
  if (command === "ping") return pingInfo();
  if (command === "user") return userInfo(payload, user);
  if (command === "avatar") return avatarInfo(payload, user);
  if (command === "help") return helpInfo();
  return interactionResponse("هذا الأمر غير معروف.", { ephemeral: true });
}
