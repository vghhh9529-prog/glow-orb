import { addGuildMemberRole, API, botToken, fetchDiscordUser, fetchGuildMember } from "./discord-api.server";
import { assertGuildAccess, ensureGuildRow } from "./guilds.server";
import { userAvatarUrl } from "./discord";
import type { Json } from "@/integrations/supabase/types";

export const SCAM_REVIEW_CHANNEL_ID = "1542130215713509437";
export const SCAMMER_ROLE_ID = "1542129398830866523";
export const SCAM_EVIDENCE_BUCKET = "scam-evidence";
const MAX_EVIDENCE_FILES = 5;
const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;
const MAX_DESCRIPTION = 5000;
const SIGNED_URL_TTL_SECONDS = 30 * 24 * 60 * 60;
const DISCORD_ID = /^\d{15,20}$/;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

type StoredEvidence = { key: string; name: string; type: string; size: number };
type EvidenceRecord = StoredEvidence & { url: string };

type ScamReportRow = {
  id: string;
  guild_id: string;
  reporter_id: string;
  reporter_name: string | null;
  reported_user_id: string;
  reported_username: string | null;
  reported_avatar: string | null;
  description: string;
  evidence_urls: Json;
  status: string;
  review_message_id: string | null;
  review_error: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  role_assigned: boolean;
  role_assignment_error: string | null;
  created_at: string;
  updated_at: string;
};

async function database() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function assertDiscordId(value: string) {
  if (!DISCORD_ID.test(value)) throw new Error("INVALID_DISCORD_ID");
}

function assertEvidenceKey(key: string, guildId: string) {
  if (
    key.length > 220 ||
    !key.startsWith(`${guildId}/`) ||
    !/^[0-9]{15,20}\/[a-f0-9-]{36}\.(jpg|jpeg|png|gif|webp)$/i.test(key)
  ) {
    throw new Error("INVALID_EVIDENCE_KEY");
  }
}

function readStoredEvidence(value: Json): StoredEvidence[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const record = item as Record<string, Json | undefined>;
    if (
      typeof record["key"] !== "string" ||
      typeof record["name"] !== "string" ||
      typeof record["type"] !== "string" ||
      typeof record["size"] !== "number"
    ) return [];
    return [{
      key: record["key"],
      name: record["name"],
      type: record["type"],
      size: record["size"],
    }];
  });
}

async function ensureEvidenceBucket() {
  const db = await database();
  const { data: buckets, error: listError } = await db.storage.listBuckets();
  if (listError) throw listError;
  const current = buckets?.find((bucket) => bucket.id === SCAM_EVIDENCE_BUCKET);
  if (!current) {
    const { error } = await db.storage.createBucket(SCAM_EVIDENCE_BUCKET, {
      public: false,
      fileSizeLimit: MAX_EVIDENCE_BYTES,
      allowedMimeTypes: Array.from(ALLOWED_IMAGE_TYPES),
    });
    if (error && !/already exists/i.test(error.message)) throw error;
  } else if (current.public) {
    const { error } = await db.storage.updateBucket(SCAM_EVIDENCE_BUCKET, { public: false });
    if (error) throw error;
  }
  return db;
}

async function signEvidence(db: Awaited<ReturnType<typeof database>>, item: StoredEvidence): Promise<EvidenceRecord | null> {
  const { data, error } = await db.storage.from(SCAM_EVIDENCE_BUCKET).createSignedUrl(item.key, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return { ...item, url: data.signedUrl };
}

export async function uploadScamEvidence(guildId: string, file: File) {
  await assertGuildAccess(guildId);
  assertDiscordId(guildId);
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) throw new Error("INVALID_IMAGE_TYPE");
  if (file.size <= 0 || file.size > MAX_EVIDENCE_BYTES) throw new Error("IMAGE_TOO_LARGE");
  const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1] ?? "png";
  const key = `${guildId}/${crypto.randomUUID()}.${extension}`;
  const db = await ensureEvidenceBucket();
  const { error } = await db.storage.from(SCAM_EVIDENCE_BUCKET).upload(key, new Uint8Array(await file.arrayBuffer()), {
    contentType: file.type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw error;
  return { key, name: file.name.slice(0, 120), type: file.type, size: file.size } satisfies StoredEvidence;
}

async function postReviewMessage(report: ScamReportRow, guildName: string) {
  const db = await ensureEvidenceBucket();
  const storedEvidence = readStoredEvidence(report.evidence_urls);
  const evidence = (await Promise.all(storedEvidence.slice(0, MAX_EVIDENCE_FILES).map((item) => signEvidence(db, item)))).filter((item): item is EvidenceRecord => Boolean(item));
  const embeds: Array<Record<string, unknown>> = [
    {
      title: "Glow Scam Report · Pending Review",
      description: report.description.slice(0, 4000),
      color: 0xf59e0b,
      fields: [
        { name: "Reported user ID", value: `\`${report.reported_user_id}\``, inline: true },
        { name: "Reported account", value: report.reported_username ? `${report.reported_username}\n<@${report.reported_user_id}>` : `<@${report.reported_user_id}>`, inline: true },
        { name: "Source server", value: `${guildName}\n\`${report.guild_id}\``, inline: true },
        { name: "Reporter", value: `${report.reporter_name ?? "Dashboard member"}\n\`${report.reporter_id}\``, inline: true },
        { name: "Report ID", value: `\`${report.id}\``, inline: true },
        { name: "Evidence", value: evidence.length ? `${evidence.length} image(s) attached below.` : "No image evidence attached.", inline: true },
      ],
      footer: { text: "Glow Safety Review · Approve only after checking the evidence" },
      timestamp: report.created_at,
    },
    ...evidence.slice(0, 9).map((item) => ({ title: item.name || "Evidence", image: { url: item.url }, color: 0x334155 })),
  ];
  const response = await fetch(`${API}/channels/${SCAM_REVIEW_CHANNEL_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${botToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      allowed_mentions: { parse: [] },
      embeds,
      components: [{
        type: 1,
        components: [
          { type: 2, style: 3, label: "Approve report", custom_id: `glow_scam_approve:${report.id}` },
          { type: 2, style: 4, label: "Delete report", custom_id: `glow_scam_delete:${report.id}` },
        ],
      }],
    }),
  });
  if (!response.ok) throw new Error(`SCAM_REVIEW_POST_FAILED:${response.status}`);
  const body = (await response.json()) as { id?: string };
  if (!body.id) throw new Error("SCAM_REVIEW_MESSAGE_MISSING");
  return body.id;
}

export async function submitScamReport(input: { guildId: string; reportedUserId: string; description: string; evidenceKeys: string[] }) {
  const { user, guild } = await assertGuildAccess(input.guildId);
  assertDiscordId(input.guildId);
  assertDiscordId(input.reportedUserId);
  const description = input.description.trim();
  if (description.length < 20 || description.length > MAX_DESCRIPTION) throw new Error("INVALID_DESCRIPTION");
  const keys = Array.from(new Set(input.evidenceKeys)).slice(0, MAX_EVIDENCE_FILES);
  keys.forEach((key) => assertEvidenceKey(key, input.guildId));
  const storedEvidence = keys.map((key) => ({ key, name: key.split("/").pop() ?? "evidence", type: `image/${key.split(".").pop() ?? "png"}`, size: 0 })) satisfies StoredEvidence[];
  const db = await database();
  if (storedEvidence.length > 0) {
    const storage = await ensureEvidenceBucket();
    const verified = await Promise.all(storedEvidence.map((item) => signEvidence(storage, item)));
    if (verified.some((item) => !item)) throw new Error("EVIDENCE_NOT_FOUND");
  }
  const target = await fetchDiscordUser(input.reportedUserId);
  await ensureGuildRow(input.guildId, guild.name, guild.icon);
  const { data: inserted, error } = await db.from("scam_reports").insert({
    guild_id: input.guildId,
    reporter_id: user.id,
    reporter_name: user.global_name ?? user.username,
    reported_user_id: input.reportedUserId,
    reported_username: target?.global_name ?? target?.username ?? null,
    reported_avatar: target?.avatar ? userAvatarUrl(input.reportedUserId, target.avatar) : null,
    description,
    evidence_urls: storedEvidence as unknown as Json,
  }).select("*").single();
  if (error || !inserted) throw error ?? new Error("SCAM_REPORT_INSERT_FAILED");
  const report = inserted as ScamReportRow;
  try {
    const reviewMessageId = await postReviewMessage(report, guild.name);
    await db.from("scam_reports").update({ review_message_id: reviewMessageId, review_error: null }).eq("id", report.id);
    return { ok: true, id: report.id, reviewQueued: true };
  } catch (error) {
    const reviewError = String(error instanceof Error ? error.message : error).slice(0, 300);
    await db.from("scam_reports").update({ review_error: reviewError }).eq("id", report.id);
    return { ok: true, id: report.id, reviewQueued: false };
  }
}

export async function listScammerDirectory(guildId: string, query = "") {
  await assertGuildAccess(guildId);
  const db = await database();
  const { data, error } = await db.from("scam_reports").select("id, reported_user_id, reported_username, reported_avatar, description, evidence_urls, status, reporter_name, created_at, reviewed_at, role_assigned, role_assignment_error").eq("guild_id", guildId).eq("status", "approved").order("created_at", { ascending: false }).limit(500);
  if (error) throw error;
  const normalized = query.trim().toLowerCase();
  const groups = new Map<string, { reportedUserId: string; username: string; avatar: string | null; reportCount: number; latestReportAt: string }>();
  for (const row of data ?? []) {
    const username = row.reported_username ?? row.reported_user_id;
    const existing = groups.get(row.reported_user_id);
    if (existing) { existing.reportCount += 1; continue; }
    groups.set(row.reported_user_id, { reportedUserId: row.reported_user_id, username, avatar: row.reported_avatar, reportCount: 1, latestReportAt: row.created_at });
  }
  return Array.from(groups.values()).filter((item) => !normalized || item.reportedUserId.includes(normalized) || item.username.toLowerCase().includes(normalized));
}

export async function listScammerReports(guildId: string, reportedUserId: string) {
  await assertGuildAccess(guildId);
  assertDiscordId(reportedUserId);
  const db = await database();
  const { data, error } = await db.from("scam_reports").select("id, reported_user_id, reported_username, reported_avatar, description, evidence_urls, status, reporter_name, created_at, reviewed_at, role_assigned, role_assignment_error").eq("guild_id", guildId).eq("reported_user_id", reportedUserId).eq("status", "approved").order("created_at", { ascending: false });
  if (error) throw error;
  const hasEvidence = (data ?? []).some((row) => readStoredEvidence(row.evidence_urls).length > 0);
  const storage = hasEvidence ? await ensureEvidenceBucket() : null;
  return Promise.all((data ?? []).map(async (row) => ({
    id: row.id,
    reportedUserId: row.reported_user_id,
    username: row.reported_username ?? row.reported_user_id,
    avatar: row.reported_avatar,
    description: row.description,
    evidence: storage ? (await Promise.all(readStoredEvidence(row.evidence_urls).map((item) => signEvidence(storage, item)))).filter((item): item is EvidenceRecord => Boolean(item)) : [],
    reporterName: row.reporter_name,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
    roleAssigned: row.role_assigned,
    roleAssignmentError: row.role_assignment_error,
  })));
}

export function isScamReviewButton(customId: string) {
  return customId.startsWith("glow_scam_approve:") || customId.startsWith("glow_scam_delete:");
}

export async function reviewScamReport(reportId: string, decision: "approved" | "rejected", reviewerId: string) {
  const db = await database();
  const now = new Date().toISOString();
  const { data: report, error: claimError } = await db.from("scam_reports").update({ status: decision, reviewed_by: reviewerId, reviewed_at: now }).eq("id", reportId).eq("status", "pending").select("*").maybeSingle();
  if (claimError) throw claimError;
  if (!report) throw new Error("SCAM_REPORT_NOT_FOUND_OR_ALREADY_REVIEWED");
  let roleAssigned = false;
  let roleAssignmentError: string | null = null;
  if (decision === "approved") {
    const member = await fetchGuildMember(report.guild_id, report.reported_user_id);
    if (!member) roleAssignmentError = "The reported user is not currently a member of the source server.";
    else {
      roleAssigned = await addGuildMemberRole(report.guild_id, report.reported_user_id, SCAMMER_ROLE_ID, "Glow approved scam report");
      if (!roleAssigned) roleAssignmentError = "Glow could not assign the scammer role. Check role hierarchy and Manage Roles.";
    }
  }
  const { error: updateError } = await db.from("scam_reports").update({ role_assigned: roleAssigned, role_assignment_error: roleAssignmentError }).eq("id", reportId).eq("status", decision);
  if (updateError) throw updateError;
  return { report: report as ScamReportRow, decision, roleAssigned, roleAssignmentError };
}
