import {
  API,
  addGuildMemberRole,
  banMember,
  clearChannelMessages,
  fetchBotGuild,
  fetchDiscordUser,
  fetchGuildChannels,
  fetchGuildEmojis,
  fetchGuildInvites,
  fetchGuildMember,
  fetchGuildMembers,
  fetchGuildRoles,
  CLIENT_ID,
  getGuildBans,
  kickMember,
  removeGuildMemberRole,
  timeoutMember,
  unbanMember,
  updateGuildChannel,
  updateGuildMember,
} from "./discord-api.server";
import { ensureGuildRow } from "./guilds.server";
import {
  createGlowTransferChallenge,
  dailyRewardForStreak,
  dailyStreakForClaim,
  type GlowTransferChallenge,
} from "./glow.server";
import {
  discordAccountCreatedAt,
  renderBalanceCard,
  renderProfileCard,
  renderUserCard,
} from "./card-renderer.server";

const DAILY_COOLDOWN_MS = 12 * 60 * 60_000;

export interface InteractionUser {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
  created_at?: string;
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

const DISCORD_SIGNATURE_MAX_AGE_MS = 5 * 60_000;

export function isFreshDiscordTimestamp(timestamp: string, now = Date.now()) {
  const seconds = Number(timestamp);
  return Number.isInteger(seconds) && seconds > 0 && Math.abs(now - seconds * 1000) <= DISCORD_SIGNATURE_MAX_AGE_MS;
}

export async function verifyDiscordRequest(request: Request, body: string): Promise<boolean> {
  const publicKey =
    process.env["DISCORD_PUBLIC_KEY"] ?? process.env["DISCORD_APPLICATION_PUBLIC_KEY"];
  const signature = request.headers.get("x-signature-ed25519");
  const timestamp = request.headers.get("x-signature-timestamp");
  if (!publicKey || !signature || !timestamp || !isFreshDiscordTimestamp(timestamp)) return false;

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

export function interactionResponse(content: string, options?: { ephemeral?: boolean; title?: string; color?: number }) {
  return Response.json({
    type: 4,
    data: {
      allowed_mentions: { parse: [] },
      embeds: [
        {
          title: options?.title ?? "Glow",
          description: content,
          color: options?.color ?? 0x7c5cff,
          footer: { text: "Glow · Discord Community Control Center" },
          timestamp: new Date().toISOString(),
        },
      ],
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

async function configuredColorRoleIds(guildId: string) {
  const database = await db();
  const { data } = await database.from("guild_modules").select("config").eq("guild_id", guildId).eq("module", "commands").maybeSingle();
  const config = data?.config;
  if (!config || typeof config !== "object" || Array.isArray(config)) return new Set<string>();
  const raw = (config as Record<string, unknown>)["colorRoleIds"];
  return new Set(
    Array.isArray(raw)
      ? raw.filter((value): value is string => typeof value === "string" && /^\d{15,25}$/.test(value)).slice(0, 50)
      : [],
  );
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
    const hours = Math.floor(remainingMinutes / 60);
    const minutes = remainingMinutes % 60;
    return interactionResponse(
      `هدية Daily مستلمة مسبقاً.\nالموعد القادم بعد **${hours ? `${hours} ساعة و` : ""}${minutes} دقيقة**.\nستريكك الحالي: **${Number(wallet?.streak ?? 0)}**.`,
      { ephemeral: true, title: "Daily Gift", color: 0x22d3ee },
    );
  }

  const streak = dailyStreakForClaim(wallet?.last_daily_at ?? null, Number(wallet?.streak ?? 0), now);
  const amount = dailyRewardForStreak(streak);
  const nextLastDailyAt = new Date(now).toISOString();
  const updateQuery = database
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
  if (updateError) {
    console.error("Discord daily update failed", updateError);
    return interactionResponse("تعذر تحديث مكافأتك حالياً.", { ephemeral: true });
  }
  if (!updatedWallet) {
    return interactionResponse("المكافأة قيد المعالجة أو ما زالت في فترة الانتظار.", { ephemeral: true });
  }
  const { error: transactionError } = await database.from("glow_transactions").insert({
    user_id: user.id,
    amount,
    kind: "daily",
    note: `Discord daily · streak ${streak}`,
  });
  if (transactionError) {
    console.error("Discord daily transaction insert failed", transactionError);
    return interactionResponse("تم تحديث الرصيد، لكن تعذر حفظ سجل المكافأة.", { ephemeral: true });
  }
  const newBalance = Number(wallet?.balance ?? 0) + amount;
  const nextReward = dailyRewardForStreak(streak + 1);
  return interactionResponse(
    `تم استلام **${amount.toLocaleString("en-US")} Glow Coin**.\nرصيدك الجديد: **${newBalance.toLocaleString("en-US")} Glow Coin**.\nالستريك الحالي: **${streak}** · الهدية القادمة قد تصل إلى **${nextReward.toLocaleString("en-US")} Glow Coin**.`,
    { ephemeral: true, title: "Daily Gift Claimed", color: 0x7c5cff },
  );
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
    `${label}: **${Number(wallet?.balance ?? 0)} Glow Coin** · الستريك: **${Number(wallet?.streak ?? 0)}** · المكتسب: **${Number(wallet?.total_earned ?? 0)} Glow Coin**.`,
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

function accountAvatarUrl(user: InteractionUser) {
  if (user.avatar?.startsWith("http")) return user.avatar;
  if (user.avatar) {
    const extension = user.avatar.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${extension}?size=512`;
  }
  try {
    const index = Number((BigInt(user.id) >> 22n) % 6n);
    return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
  } catch {
    return "https://cdn.discordapp.com/embed/avatars/0.png";
  }
}

async function memberCardStats(payload: DiscordInteractionPayload, target: InteractionUser) {
  const guildId = payload.guild_id;
  const database = await db();
  const [guild, guildMember, levelResult] = await Promise.all([
    guildId ? fetchBotGuild(guildId) : Promise.resolve(null),
    guildId ? fetchGuildMember(guildId, target.id) : Promise.resolve(null),
    guildId
      ? database
          .from("member_levels")
          .select("xp, level")
          .eq("guild_id", guildId)
          .eq("user_id", target.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const levelRow = levelResult.data;
  let rank = 0;
  if (guildId && levelRow) {
    const { count } = await database
      .from("member_levels")
      .select("user_id", { count: "exact", head: true })
      .eq("guild_id", guildId)
      .gt("xp", Number(levelRow.xp ?? 0));
    rank = (count ?? 0) + 1;
  }
  return {
    username: target.username,
    displayName: target.global_name ?? target.username,
    userId: target.id,
    avatarUrl: accountAvatarUrl(target),
    serverName: guild?.name ?? null,
    level: Number(levelRow?.level ?? 0),
    xp: Number(levelRow?.xp ?? 0),
    rank,
    discordCreatedAt: discordAccountCreatedAt(target.id),
    serverJoinedAt: guildMember?.joined_at ?? null,
  };
}

export interface DiscordCardInteractionResult {
  buffer: Buffer;
  filename: string;
  title: string;
  description?: string;
}

export interface DiscordTransferInteractionResult {
  challenge: GlowTransferChallenge;
  message: string;
}

export async function sendDiscordCardFollowup(
  payload: DiscordInteractionPayload,
  card: DiscordCardInteractionResult,
) {
  if (!payload.token) throw new Error("Missing Discord interaction token");
  const form = new FormData();
  form.append(
    "payload_json",
    JSON.stringify({
      allowed_mentions: { parse: [] },
      embeds: [
        {
          title: card.title,
          description: card.description ?? "English profile card · live Discord and Glow data",
          color: 0x7c5cff,
          image: { url: `attachment://${card.filename}` },
          footer: { text: "Glow · Community progression" },
        },
      ],
    }),
  );
  form.append("files[0]", new Blob([new Uint8Array(card.buffer)], { type: "image/png" }), card.filename);
  const response = await fetch(`${API}/webhooks/${CLIENT_ID}/${payload.token}`, {
    method: "POST",
    body: form,
  });
  if (!response.ok) throw new Error(`Discord card follow-up failed: ${response.status} ${await response.text()}`);
}

export type DiscordTransferCommandResult =
  | { kind: "challenge"; result: DiscordTransferInteractionResult }
  | { kind: "error"; message: string };

export async function handleDiscordTransferCommand(payload: DiscordInteractionPayload): Promise<DiscordTransferCommandResult> {
  const sender = interactionUser(payload);
  const recipientId = interactionOption<string>(payload, "user")?.trim();
  const rawAmount = interactionOption<string | number>(payload, "amount");
  const amount = typeof rawAmount === "number" ? rawAmount : Number(rawAmount);
  if (!sender || !recipientId) return { kind: "error", message: "Choose a user and an amount to transfer." };
  if (!/^\d{15,25}$/.test(recipientId)) return { kind: "error", message: "Choose a valid Discord user." };
  const recipient = await fetchDiscordUser(recipientId);
  if (!recipient) return { kind: "error", message: "I could not find that Discord user." };
  const challenge = await createGlowTransferChallenge({
    guildId: payload.guild_id ?? "global",
    channelId: payload.channel_id ?? "global",
    sender: { id: sender.id, username: sender.username, globalName: sender.global_name ?? null, avatar: sender.avatar ?? null },
    recipient: { id: recipient.id, username: recipient.username, globalName: recipient.global_name ?? null, avatar: recipient.avatar ?? null },
    amount,
  });
  if (!challenge.ok) {
    if (challenge.reason === "self") return { kind: "error", message: "You cannot transfer Glow Coin to yourself." };
    if (challenge.reason === "invalid_amount") return { kind: "error", message: "Enter a whole Glow Coin amount between 1 and 1,000,000,000." };
    if (challenge.reason === "insufficient_funds") return { kind: "error", message: `You do not have enough Glow Coin. Your balance is ${Number(challenge.balance ?? 0).toLocaleString("en-US")}.` };
    return { kind: "error", message: "The transfer could not be started. Please try again." };
  }
  return {
    kind: "challenge",
    result: {
      challenge: challenge.challenge,
      message: challenge.challenge.code,
    },
  };
}

export async function sendDiscordTransferFollowup(
  payload: DiscordInteractionPayload,
  transfer: DiscordTransferInteractionResult,
) {
  await sendDiscordTextFollowup(payload, transfer.message);
}

export async function sendDiscordTextFollowup(payload: DiscordInteractionPayload, message: string) {
  if (!payload.token) throw new Error("Missing Discord interaction token");
  const response = await fetch(`${API}/webhooks/${CLIENT_ID}/${payload.token}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content: message, allowed_mentions: { parse: [] }, flags: 64 }),
  });
  if (!response.ok) throw new Error(`Discord text follow-up failed: ${response.status} ${await response.text()}`);
}


/** Gateway-only card path. The HTTP interaction endpoint remains JSON/Embed compatible. */
export async function handleDiscordCardCommand(
  payload: DiscordInteractionPayload,
): Promise<DiscordCardInteractionResult | null> {
  const command = payload.data?.name;
  if (command !== "user" && command !== "profile" && command !== "balance") return null;
  const caller = interactionUser(payload);
  if (!caller) throw new Error("Missing interaction user");

  if (command === "balance") {
    const targetId = interactionOption<string>(payload, "user") ?? caller.id;
    const target = targetId === caller.id ? caller : await fetchDiscordUser(targetId);
    if (!target) throw new Error("Target Discord user was not found");
    await ensureUser(target);
    const database = await db();
    const { data: wallet } = await database
      .from("glow_wallets")
      .select("balance, streak, total_earned")
      .eq("user_id", target.id)
      .maybeSingle();
    return {
      buffer: await renderBalanceCard({
        username: target.username,
        displayName: target.global_name ?? target.username,
        userId: target.id,
        avatarUrl: accountAvatarUrl(target),
        balance: Number(wallet?.balance ?? 0),
        streak: Number(wallet?.streak ?? 0),
        totalEarned: Number(wallet?.total_earned ?? 0),
      }),
      filename: "glow-balance-card.png",
      title: "Glow Coin Balance",
      description: "English Glow Coin card · live balance data",
    };
  }

  const targetId = command === "user" ? interactionOption<string>(payload, "member") ?? caller.id : caller.id;
  const target = targetId === caller.id ? caller : await fetchDiscordUser(targetId);
  if (!target) throw new Error("Target Discord user was not found");
  const stats = await memberCardStats(payload, target);
  return command === "profile"
    ? { buffer: await renderProfileCard(stats), filename: "glow-profile-card.png", title: "Glow Profile" }
    : { buffer: await renderUserCard(stats), filename: "glow-user-card.png", title: "Glow User Card" };
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
  const configured = await configuredColorRoleIds(guildId);
  const allRoles = (await fetchGuildRoles(guildId)).filter((role) => !role.managed && role.color > 0).sort((a, b) => b.position - a.position);
  const roles = configured.size ? allRoles.filter((role) => configured.has(role.id)) : allRoles;
  if (roles.length === 0) return interactionResponse("لا توجد رولات ملوّنة مهيأة في السيرفر حالياً.", { ephemeral: true });
  const rows = roles.slice(0, 20).map((role) => `• **${role.name}** · \`#${role.color.toString(16).padStart(6, "0").toUpperCase()}\``).join("\n");
  const note = configured.size ? "" : "\n\nملاحظة: هذه قائمة عرض فقط. أضف رتب الألوان في إعدادات Command Center ليبدّل Glow بينها بأمان.";
  return interactionResponse(`**ألوان الرولات (${roles.length})**\n${rows}${roles.length > 20 ? `\n… و ${roles.length - 20} لون إضافي.` : ""}${note}`);
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

async function getEmojisInfo(payload: DiscordInteractionPayload) {
  const guildId = payload.guild_id;
  if (!guildId) return interactionResponse("هذا الأمر يعمل داخل السيرفر فقط.", { ephemeral: true });
  const emojis = await fetchGuildEmojis(guildId);
  if (!emojis.length) return interactionResponse("لا توجد إيموجيات مخصصة في هذا السيرفر.", { ephemeral: true });
  const rows = emojis.slice(0, 40).map((emoji, index) => `${index + 1}. ${emoji.animated ? `<a:${emoji.name ?? "emoji"}:${emoji.id}>` : `<:${emoji.name ?? "emoji"}:${emoji.id}>`} **${emoji.name ?? "unnamed"}**`).join("\n");
  return interactionResponse(`**إيموجيات السيرفر (${emojis.length})**\n${rows}${emojis.length > 40 ? `\n… و ${emojis.length - 40} إضافي.` : ""}`);
}

async function colorSetInfo(payload: DiscordInteractionPayload, user: InteractionUser) {
  const guildId = payload.guild_id;
  const number = Number(interactionOption<number>(payload, "number") ?? 0);
  if (!guildId || !number) return interactionResponse("اختر رقم لون صحيحاً من /colors.", { ephemeral: true });
  const configured = await configuredColorRoleIds(guildId);
  const allRoles = (await fetchGuildRoles(guildId)).filter((role) => !role.managed && role.color > 0).sort((a, b) => b.position - a.position);
  const roles = configured.size ? allRoles.filter((role) => configured.has(role.id)) : allRoles;
  const selected = roles[number - 1];
  if (!selected) return interactionResponse("رقم اللون غير موجود. استخدم /colors أولاً.", { ephemeral: true });
  if (configured.size) {
    for (const role of roles) {
      if (role.id !== selected.id) await removeGuildMemberRole(guildId, user.id, role.id, "Glow color role selection").catch(() => false);
    }
  }
  const ok = await addGuildMemberRole(guildId, user.id, selected.id, "Glow color role selection");
  return ok
    ? interactionResponse(configured.size ? `تم اختيار اللون **${selected.name}** بنجاح.` : `تمت إضافة اللون **${selected.name}**. أضف رتب الألوان في Command Center ليبدّل Glow بينها تلقائياً.`)
    : interactionResponse("تعذر إضافة اللون. تأكد أن رتبة Glow أعلى من رتبة اللون.", { ephemeral: true });
}

async function invitesInfo(payload: DiscordInteractionPayload) {
  const guildId = payload.guild_id;
  if (!guildId) return interactionResponse("هذا الأمر يعمل داخل السيرفر فقط.", { ephemeral: true });
  if (!hasPermission(payload, 0x20n)) return permissionDenied();
  const invites = await fetchGuildInvites(guildId);
  if (!invites.length) return interactionResponse("لا توجد دعوات يمكن عرضها أو لا يملك Glow صلاحية قراءتها.", { ephemeral: true });
  const rows = invites.slice(0, 20).map((invite) => `• ${invite.code} · ${invite.uses ?? 0} استخدام · ${invite.channel?.name ?? "قناة غير معروفة"}`).join("\n");
  return interactionResponse(`**دعوات السيرفر (${invites.length})**\n${rows}${invites.length > 20 ? `\n… و ${invites.length - 20} دعوة إضافية.` : ""}`);
}

function levelFromXpValue(xp: number, curve = 100) {
  return Math.max(0, Math.floor(Math.sqrt(Math.max(0, xp) / Math.max(1, curve))));
}

async function resetLevelInfo(payload: DiscordInteractionPayload) {
  const guildId = payload.guild_id;
  if (!guildId) return interactionResponse("هذا الأمر يعمل داخل السيرفر فقط.", { ephemeral: true });
  if (!hasPermission(payload, 0x20n)) return permissionDenied();
  const targetId = interactionOption<string>(payload, "member");
  const database = await db();
  let query = database.from("member_levels").update({ xp: 0, level: 0, daily_xp: 0, weekly_xp: 0, monthly_xp: 0, voice_minutes: 0, updated_at: new Date().toISOString() }).eq("guild_id", guildId);
  if (targetId) query = query.eq("user_id", targetId);
  const { error } = await query;
  if (error) return interactionResponse("تعذر إعادة تعيين نقاط XP حالياً.", { ephemeral: true });
  return interactionResponse(targetId ? `تمت إعادة تعيين XP للعضو <@${targetId}>.` : "تمت إعادة تعيين XP لكل أعضاء السيرفر.");
}

async function setLevelInfo(payload: DiscordInteractionPayload) {
  const guildId = payload.guild_id;
  const targetId = interactionOption<string>(payload, "member");
  const level = Math.max(0, Math.min(10_000, Number(interactionOption<number>(payload, "level") ?? 0)));
  if (!guildId || !targetId) return interactionResponse("اختر عضواً داخل السيرفر.", { ephemeral: true });
  if (!hasPermission(payload, 0x20n)) return permissionDenied();
  const database = await db();
  const { error } = await database.from("member_levels").upsert({ guild_id: guildId, user_id: targetId, username: `<@${targetId}>`, xp: level * 100 * level, level, updated_at: new Date().toISOString() }, { onConflict: "guild_id,user_id" });
  return error ? interactionResponse("تعذر تعيين المستوى.", { ephemeral: true }) : interactionResponse(`تم تعيين مستوى <@${targetId}> إلى **${level}**.`);
}

async function setXpInfo(payload: DiscordInteractionPayload) {
  const guildId = payload.guild_id;
  const targetId = interactionOption<string>(payload, "member");
  const xp = Math.max(0, Math.min(1_000_000_000, Number(interactionOption<number>(payload, "xp") ?? 0)));
  if (!guildId || !targetId) return interactionResponse("اختر عضواً داخل السيرفر.", { ephemeral: true });
  if (!hasPermission(payload, 0x20n)) return permissionDenied();
  const database = await db();
  const { error } = await database.from("member_levels").upsert({ guild_id: guildId, user_id: targetId, username: `<@${targetId}>`, xp, level: levelFromXpValue(xp), updated_at: new Date().toISOString() }, { onConflict: "guild_id,user_id" });
  return error ? interactionResponse("تعذر تعيين XP.", { ephemeral: true }) : interactionResponse(`تم تعيين XP للعضو <@${targetId}> إلى **${xp}**.`);
}

function channelOption(payload: DiscordInteractionPayload) {
  return interactionOption<string>(payload, "channel") ?? payload.channel_id;
}

async function channelVisibilityInfo(payload: DiscordInteractionPayload, mode: "hide" | "show" | "lock" | "unlock") {
  const guildId = payload.guild_id;
  const channelId = channelOption(payload);
  if (!guildId || !channelId) return interactionResponse("اختر قناة داخل السيرفر.", { ephemeral: true });
  if (!hasPermission(payload, 0x10n)) return permissionDenied();
  const channels = await fetchGuildChannels(guildId);
  const channel = channels.find((item) => item.id === channelId && item.guild_id === guildId);
  if (!channel) return interactionResponse("القناة غير موجودة في هذا السيرفر.", { ephemeral: true });
  const existing = channel.permission_overwrites?.find((overwrite) => overwrite.id === guildId && overwrite.type === 0);
  const currentAllow = BigInt(existing?.allow ?? "0");
  const currentDeny = BigInt(existing?.deny ?? "0");
  const viewBit = 1024n;
  const sendBit = 2048n;
  const bit = mode === "hide" || mode === "show" ? viewBit : sendBit;
  const enable = mode === "show" || mode === "unlock";
  const allow = enable ? currentAllow | bit : currentAllow & ~bit;
  const deny = enable ? currentDeny & ~bit : currentDeny | bit;
  const ok = await updateGuildChannel(channelId, { permission_overwrites: [{ id: guildId, type: 0, allow: allow.toString(), deny: deny.toString() }] }, `Glow ${mode} command`);
  return ok ? interactionResponse(`تم تنفيذ **/${mode}** على <#${channelId}>.`) : interactionResponse("تعذر تعديل صلاحيات القناة. تحقق من رتبة Glow.", { ephemeral: true });
}

async function slowmodeInfo(payload: DiscordInteractionPayload) {
  const guildId = payload.guild_id;
  const channelId = payload.channel_id;
  const seconds = Math.max(0, Math.min(21_600, Number(interactionOption<number>(payload, "seconds") ?? 0)));
  if (!guildId || !channelId) return interactionResponse("هذا الأمر يعمل داخل قناة السيرفر فقط.", { ephemeral: true });
  if (!hasPermission(payload, 0x2000n)) return permissionDenied();
  const ok = await updateGuildChannel(channelId, { rate_limit_per_user: seconds }, "Glow slowmode command");
  return ok ? interactionResponse(seconds ? `تم تفعيل Slowmode لمدة **${seconds} ثانية**.` : "تم تعطيل Slowmode.") : interactionResponse("تعذر تعديل Slowmode.", { ephemeral: true });
}

async function inRoleInfo(payload: DiscordInteractionPayload) {
  const guildId = payload.guild_id;
  const roleId = interactionOption<string>(payload, "role");
  if (!guildId || !roleId) return interactionResponse("اختر رولاً داخل السيرفر.", { ephemeral: true });
  const members = (await fetchGuildMembers(guildId)).filter((member) => member.roles?.includes(roleId));
  if (!members.length) return interactionResponse("لا يوجد أعضاء بهذا الرول حالياً.", { ephemeral: true });
  const rows = members.slice(0, 30).map((member) => `• <@${member.user.id}>`).join("\n");
  return interactionResponse(`**أعضاء الرول (${members.length})**\n${rows}${members.length > 30 ? `\n… و ${members.length - 30} عضو إضافي.` : ""}`);
}

async function moveInfo(payload: DiscordInteractionPayload, user: InteractionUser) {
  const guildId = payload.guild_id;
  const targetId = interactionOption<string>(payload, "member");
  const channelId = interactionOption<string>(payload, "channel");
  if (!guildId || !targetId || !channelId) return interactionResponse("اختر العضو والروم الصوتي.", { ephemeral: true });
  if (!hasPermission(payload, 0x1000000n)) return permissionDenied();
  const channel = (await fetchGuildChannels(guildId)).find((item) => item.id === channelId && (item.type === 2 || item.type === 13));
  if (!channel) return interactionResponse("اختر رومًا صوتيًا صالحًا.", { ephemeral: true });
  const ok = await updateGuildMember(guildId, targetId, { channel_id: channelId }, `Glow move by ${user.id}`);
  return ok ? interactionResponse(`تم نقل <@${targetId}> إلى <#${channelId}>.`) : interactionResponse("تعذر نقل العضو. تأكد من وجوده في روم صوتي وصلاحيات Glow.", { ephemeral: true });
}

async function muteCheckInfo(payload: DiscordInteractionPayload) {
  const guildId = payload.guild_id;
  const targetId = interactionOption<string>(payload, "member");
  if (!guildId || !targetId) return interactionResponse("اختر عضواً داخل السيرفر.", { ephemeral: true });
  const member = await fetchGuildMember(guildId, targetId);
  if (!member) return interactionResponse("تعذر العثور على العضو.", { ephemeral: true });
  const until = member.communication_disabled_until ? new Date(member.communication_disabled_until) : null;
  return interactionResponse(until && until.getTime() > Date.now() ? `العضو <@${targetId}> عليه Timeout حتى <t:${Math.floor(until.getTime() / 1000)}:F>.` : `العضو <@${targetId}> ليس عليه Timeout حالياً.`);
}

async function roleInfo(payload: DiscordInteractionPayload, user: InteractionUser) {
  const guildId = payload.guild_id;
  const targetId = interactionOption<string>(payload, "member");
  const roleId = interactionOption<string>(payload, "role");
  const action = interactionOption<string>(payload, "action") === "remove" ? "remove" : "add";
  if (!guildId || !targetId || !roleId) return interactionResponse("اختر العضو والرول.", { ephemeral: true });
  if (!hasPermission(payload, 0x10000000n)) return permissionDenied();
  const role = (await fetchGuildRoles(guildId)).find((item) => item.id === roleId && !item.managed && item.id !== guildId);
  if (!role) return interactionResponse("الرول غير صالح أو مُدار من Discord.", { ephemeral: true });
  const ok = action === "add" ? await addGuildMemberRole(guildId, targetId, roleId, `Glow role add by ${user.id}`) : await removeGuildMemberRole(guildId, targetId, roleId, `Glow role remove by ${user.id}`);
  return ok ? interactionResponse(`${action === "add" ? "تمت إضافة" : "تمت إزالة"} الرول **${role.name}** ${action === "add" ? "إلى" : "من"} <@${targetId}>.`) : interactionResponse("تعذر تعديل الرول. تحقق من ترتيب الرتب.", { ephemeral: true });
}

async function rarInfo(payload: DiscordInteractionPayload, user: InteractionUser) {
  const guildId = payload.guild_id;
  const targetId = interactionOption<string>(payload, "member");
  if (!guildId || !targetId) return interactionResponse("اختر عضواً داخل السيرفر.", { ephemeral: true });
  if (!hasPermission(payload, 0x10000000n)) return permissionDenied();
  const member = await fetchGuildMember(guildId, targetId);
  if (!member) return interactionResponse("تعذر العثور على العضو.", { ephemeral: true });
  const roles = await fetchGuildRoles(guildId);
  const removable = roles.filter((role) => !role.managed && role.id !== guildId && member.roles?.includes(role.id));
  let removed = 0;
  for (const role of removable) if (await removeGuildMemberRole(guildId, targetId, role.id, `Glow rar by ${user.id}`)) removed += 1;
  return interactionResponse(`تمت إزالة **${removed}** رول من <@${targetId}>.`);
}

async function setNickInfo(payload: DiscordInteractionPayload, user: InteractionUser) {
  const guildId = payload.guild_id;
  const targetId = interactionOption<string>(payload, "member");
  const nickname = interactionOption<string>(payload, "nickname")?.trim() || null;
  if (!guildId || !targetId) return interactionResponse("اختر عضواً داخل السيرفر.", { ephemeral: true });
  if (!hasPermission(payload, 0x8000000n)) return permissionDenied();
  const ok = await updateGuildMember(guildId, targetId, { nick: nickname }, `Glow setnick by ${user.id}`);
  return ok ? interactionResponse(nickname ? `تم تغيير اسم <@${targetId}> إلى **${nickname}**.` : `تمت إزالة الاسم المستعار من <@${targetId}>.`) : interactionResponse("تعذر تغيير الاسم المستعار. تحقق من ترتيب الرتب.", { ephemeral: true });
}

async function voiceKickInfo(payload: DiscordInteractionPayload, user: InteractionUser) {
  const guildId = payload.guild_id;
  const targetId = interactionOption<string>(payload, "member");
  if (!guildId || !targetId) return interactionResponse("اختر عضواً داخل السيرفر.", { ephemeral: true });
  if (!hasPermission(payload, 0x1000000n)) return permissionDenied();
  const ok = await updateGuildMember(guildId, targetId, { channel_id: null }, `Glow vkick by ${user.id}`);
  return ok ? interactionResponse(`تم فصل <@${targetId}> من الروم الصوتي.`) : interactionResponse("تعذر فصل العضو أو أنه غير متصل صوتياً.", { ephemeral: true });
}

async function warnRemoveInfo(payload: DiscordInteractionPayload) {
  const guildId = payload.guild_id;
  const targetId = interactionOption<string>(payload, "member");
  if (!guildId) return interactionResponse("هذا الأمر يعمل داخل السيرفر فقط.", { ephemeral: true });
  if (!hasPermission(payload, 0x20n)) return permissionDenied();
  const database = await db();
  let query = database.from("moderation_cases").delete().eq("guild_id", guildId).eq("action", "warn");
  if (targetId) query = query.eq("target_id", targetId);
  const { error } = await query;
  return error ? interactionResponse("تعذر إزالة التحذيرات.", { ephemeral: true }) : interactionResponse(targetId ? `تمت إزالة تحذيرات <@${targetId}>.` : "تمت إزالة تحذيرات السيرفر بالكامل.");
}

async function pointsInfo(payload: DiscordInteractionPayload, user: InteractionUser) {
  const targetId = interactionOption<string>(payload, "member");
  const amount = Math.max(0, Math.min(1_000_000_000, Number(interactionOption<number>(payload, "amount") ?? 0)));
  const action = interactionOption<string>(payload, "action") ?? "add";
  if (!payload.guild_id || !targetId) return interactionResponse("اختر عضواً داخل السيرفر.", { ephemeral: true });
  if (!hasPermission(payload, 0x20n)) return permissionDenied();
  const database = await db();
  const { data: wallet } = await database.from("glow_wallets").select("balance, total_earned").eq("user_id", targetId).maybeSingle();
  const current = Number(wallet?.balance ?? 0);
  const next = action === "set" ? amount : action === "remove" ? Math.max(0, current - amount) : current + amount;
  const { error } = await database.from("glow_wallets").upsert({ user_id: targetId, balance: next, total_earned: Number(wallet?.total_earned ?? 0), updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) return interactionResponse("تعذر تحديث الرصيد.", { ephemeral: true });
  await database.from("glow_transactions").insert({ user_id: targetId, amount: next - current, kind: "admin_adjustment", note: `Glow points adjustment by ${user.id}` });
  return interactionResponse(`تم تحديث رصيد <@${targetId}> إلى **${next} Glow Coin**.`);
}

async function pointsResetInfo(payload: DiscordInteractionPayload) {
  const targetId = interactionOption<string>(payload, "member");
  if (!payload.guild_id) return interactionResponse("هذا الأمر يعمل داخل السيرفر فقط.", { ephemeral: true });
  if (!targetId) return interactionResponse("اختر عضواً محدداً؛ أرصدة Glow مشتركة وليست معزولة حسب السيرفر.", { ephemeral: true });
  if (!hasPermission(payload, 0x20n)) return permissionDenied();
  const database = await db();
  const { error } = await database
    .from("glow_wallets")
    .update({ balance: 0, total_earned: 0, streak: 0, last_daily_at: null, updated_at: new Date().toISOString() })
    .eq("user_id", targetId);
  return error
    ? interactionResponse("تعذر إعادة تعيين الرصيد.", { ephemeral: true })
    : interactionResponse(`تمت إعادة تعيين رصيد <@${targetId}>.`);
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

  if (command === "get-emojis") return getEmojisInfo(payload);
  if (command === "color-set") return colorSetInfo(payload, user);
  if (command === "invites") return invitesInfo(payload);
  if (command === "reset") return resetLevelInfo(payload);
  if (command === "setlevel") return setLevelInfo(payload);
  if (command === "setxp") return setXpInfo(payload);
  if (command === "hide") return channelVisibilityInfo(payload, "hide");
  if (command === "show") return channelVisibilityInfo(payload, "show");
  if (command === "lock") return channelVisibilityInfo(payload, "lock");
  if (command === "unlock") return channelVisibilityInfo(payload, "unlock");
  if (command === "slowmode") return slowmodeInfo(payload);
  if (command === "inrole") return inRoleInfo(payload);
  if (command === "move") return moveInfo(payload, user);
  if (command === "mute-check") return muteCheckInfo(payload);
  if (command === "role") return roleInfo(payload, user);
  if (command === "rar") return rarInfo(payload, user);
  if (command === "setnick") return setNickInfo(payload, user);
  if (command === "vkick") return voiceKickInfo(payload, user);
  if (command === "warn-remove") return warnRemoveInfo(payload);
  if (command === "points") return pointsInfo(payload, user);
  if (command === "points-reset") return pointsResetInfo(payload);
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
