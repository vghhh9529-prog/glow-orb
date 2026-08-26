import { addGuildMemberRole, API, botToken, fetchDiscordUser, fetchGuildMember } from "./discord-api.server";
import { assertGuildAccess, ensureGuildRow } from "./guilds.server";
import { userAvatarUrl } from "./discord";
import type { Json } from "@/integrations/supabase/types";

export const SCAM_REVIEW_CHANNEL_ID = "1542130215713509437";
export const SCAMMER_ROLE_ID = "1542129398830866523";
export const SCAM_EVIDENCE_BUCKET = "scam-evidence";
const SCAM_REPORT_KIND = "scam_reports";
const MAX_EVIDENCE_FILES = 5;
const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;
const MAX_DESCRIPTION = 5000;
const SIGNED_URL_TTL_SECONDS = 30 * 24 * 60 * 60;
const DISCORD_ID = /^\d{15,20}$/;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

type StoredEvidence = { key: string; name: string; type: string; size: number };
type EvidenceRecord = StoredEvidence & { url: string };
type ScamStatus = "pending" | "approved" | "rejected";

type ScamReportData = {
  reporterId: string;
  reporterName: string | null;
  reportedUserId: string;
  reportedUsername: string | null;
  reportedAvatar: string | null;
  description: string;
  evidence: StoredEvidence[];
  status: ScamStatus;
  reviewMessageId: string | null;
  reviewError: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  roleAssigned: boolean;
  roleAssignmentError: string | null;
  createdAt: string;
};

type ScamReportRow = {
  id: string;
  guild_id: string;
  name: string;
  data: ScamReportData;
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
    key !== key.trim() ||
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
    return [{ key: record["key"], name: record["name"], type: record["type"], size: record["size"] }];
  });
}

function readScamReportData(value: Json): ScamReportData | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, Json | undefined>;
  const status = record["status"];
  if (
    typeof record["reporterId"] !== "string" ||
    typeof record["reportedUserId"] !== "string" ||
    typeof record["description"] !== "string" ||
    (status !== "pending" && status !== "approved" && status !== "rejected") ||
    typeof record["createdAt"] !== "string"
  ) return null;
  return {
    reporterId: record["reporterId"],
    reporterName: typeof record["reporterName"] === "string" ? record["reporterName"] : null,
    reportedUserId: record["reportedUserId"],
    reportedUsername: typeof record["reportedUsername"] === "string" ? record["reportedUsername"] : null,
    reportedAvatar: typeof record["reportedAvatar"] === "string" ? record["reportedAvatar"] : null,
    description: record["description"],
    evidence: readStoredEvidence(record["evidence"] ?? []),
    status,
    reviewMessageId: typeof record["reviewMessageId"] === "string" ? record["reviewMessageId"] : null,
    reviewError: typeof record["reviewError"] === "string" ? record["reviewError"] : null,
    reviewedBy: typeof record["reviewedBy"] === "string" ? record["reviewedBy"] : null,
    reviewedAt: typeof record["reviewedAt"] === "string" ? record["reviewedAt"] : null,
    roleAssigned: record["roleAssigned"] === true,
    roleAssignmentError: typeof record["roleAssignmentError"] === "string" ? record["roleAssignmentError"] : null,
    createdAt: record["createdAt"],
  };
}

function toJson(data: ScamReportData) {
  return data as unknown as Json;
}

async function ensureEvidenceBucket() {
  try {
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
  } catch (error) {
    console.error("[Glow Scam Reports] Storage bucket unavailable", error);
    throw new Error("STORAGE_NOT_READY");
  }
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
  if (error) {
    console.error("[Glow Scam Reports] Evidence upload failed", error);
    throw new Error("STORAGE_UPLOAD_FAILED");
  }
  return { key, name: file.name.slice(0, 120), type: file.type, size: file.size } satisfies StoredEvidence;
}

async function postReviewMessage(report: ScamReportRow, guildName: string) {
  const db = report.data.evidence.length > 0 ? await ensureEvidenceBucket() : null;
  const evidence = db
    ? (await Promise.all(report.data.evidence.slice(0, MAX_EVIDENCE_FILES).map((item) => signEvidence(db, item)))).filter((item): item is EvidenceRecord => Boolean(item))
    : [];
  const embeds: Array<Record<string, unknown>> = [
    {
      title: "Glow Scam Report · Pending Review",
      description: report.data.description.slice(0, 4000),
      color: 0xf59e0b,
      fields: [
        { name: "Reported user ID", value: `\`${report.data.reportedUserId}\``, inline: true },
        { name: "Reported account", value: report.data.reportedUsername ? `${report.data.reportedUsername}\n<@${report.data.reportedUserId}>` : `<@${report.data.reportedUserId}>`, inline: true },
        { name: "Source server", value: `${guildName}\n\`${report.guild_id}\``, inline: true },
        { name: "Reporter", value: `${report.data.reporterName ?? "Dashboard member"}\n\`${report.data.reporterId}\``, inline: true },
        { name: "Report ID", value: `\`${report.id}\``, inline: true },
        { name: "Evidence", value: evidence.length ? `${evidence.length} image(s) attached below.` : "No image evidence attached.", inline: true },
      ],
      footer: { text: "Glow Safety Review · Approve only after checking the evidence" },
      timestamp: report.data.createdAt,
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

async function getScamItem(id: string) {
  const db = await database();
  const { data, error } = await db.from("guild_items").select("id, guild_id, name, data").eq("id", id).eq("kind", SCAM_REPORT_KIND).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("SCAM_REPORT_NOT_FOUND");
  const parsed = readScamReportData(data.data);
  if (!parsed) throw new Error("SCAM_REPORT_CORRUPTED");
  return { db, row: { id: data.id, guild_id: data.guild_id, name: data.name, data: parsed } satisfies ScamReportRow };
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
  const reportData: ScamReportData = {
    reporterId: user.id,
    reporterName: user.global_name ?? user.username,
    reportedUserId: input.reportedUserId,
    reportedUsername: target?.global_name ?? target?.username ?? null,
    reportedAvatar: target?.avatar ? userAvatarUrl(input.reportedUserId, target.avatar) : null,
    description,
    evidence: storedEvidence,
    status: "pending",
    reviewMessageId: null,
    reviewError: null,
    reviewedBy: null,
    reviewedAt: null,
    roleAssigned: false,
    roleAssignmentError: null,
    createdAt: new Date().toISOString(),
  };
  const { data: inserted, error } = await db.from("guild_items").insert({
    guild_id: input.guildId,
    kind: SCAM_REPORT_KIND,
    name: `Scam report · ${reportData.reportedUsername ?? reportData.reportedUserId}`.slice(0, 100),
    enabled: true,
    data: toJson(reportData),
  }).select("id, guild_id, name, data").single();
  if (error || !inserted) throw error ?? new Error("SCAM_REPORT_INSERT_FAILED");
  const report = { id: inserted.id, guild_id: inserted.guild_id, name: inserted.name, data: reportData } satisfies ScamReportRow;
  try {
    const reviewMessageId = await postReviewMessage(report, guild.name);
    await db.from("guild_items").update({ data: toJson({ ...reportData, reviewMessageId, reviewError: null }) }).eq("id", report.id).eq("kind", SCAM_REPORT_KIND);
    return { ok: true, id: report.id, reviewQueued: true };
  } catch (error) {
    const reviewError = String(error instanceof Error ? error.message : error).slice(0, 300);
    await db.from("guild_items").update({ data: toJson({ ...reportData, reviewError }) }).eq("id", report.id).eq("kind", SCAM_REPORT_KIND);
    return { ok: true, id: report.id, reviewQueued: false };
  }
}

export async function listScammerDirectory(guildId: string, query = "") {
  await assertGuildAccess(guildId);
  const db = await database();
  const { data, error } = await db.from("guild_items").select("id, name, data, created_at").eq("guild_id", guildId).eq("kind", SCAM_REPORT_KIND).order("created_at", { ascending: false }).limit(500);
  if (error) throw error;
  const normalized = query.trim().toLowerCase();
  const groups = new Map<string, { reportedUserId: string; username: string; avatar: string | null; reportCount: number; latestReportAt: string }>();
  for (const item of data ?? []) {
    const report = readScamReportData(item.data);
    if (!report || report.status !== "approved") continue;
    const username = report.reportedUsername ?? report.reportedUserId;
    const existing = groups.get(report.reportedUserId);
    if (existing) { existing.reportCount += 1; continue; }
    groups.set(report.reportedUserId, { reportedUserId: report.reportedUserId, username, avatar: report.reportedAvatar, reportCount: 1, latestReportAt: report.createdAt });
  }
  return Array.from(groups.values()).filter((item) => !normalized || item.reportedUserId.includes(normalized) || item.username.toLowerCase().includes(normalized));
}

export async function listScammerReports(guildId: string, reportedUserId: string) {
  await assertGuildAccess(guildId);
  assertDiscordId(reportedUserId);
  const db = await database();
  const { data, error } = await db.from("guild_items").select("id, data").eq("guild_id", guildId).eq("kind", SCAM_REPORT_KIND).order("created_at", { ascending: false }).limit(500);
  if (error) throw error;
  const rows = (data ?? []).map((item) => ({ id: item.id, report: readScamReportData(item.data) })).filter((item): item is { id: string; report: ScamReportData } => {
    const report = item.report;
    return report !== null && report.status === "approved" && report.reportedUserId === reportedUserId;
  });
  const hasEvidence = rows.some((item) => item.report.evidence.length > 0);
  const storage = hasEvidence ? await ensureEvidenceBucket() : null;
  return Promise.all(rows.map(async ({ id, report }) => ({
    id,
    reportedUserId: report.reportedUserId,
    username: report.reportedUsername ?? report.reportedUserId,
    avatar: report.reportedAvatar,
    description: report.description,
    evidence: storage ? (await Promise.all(report.evidence.map((item) => signEvidence(storage, item)))).filter((item): item is EvidenceRecord => Boolean(item)) : [],
    reporterName: report.reporterName,
    createdAt: report.createdAt,
    reviewedAt: report.reviewedAt,
    roleAssigned: report.roleAssigned,
    roleAssignmentError: report.roleAssignmentError,
  })));
}

export function isScamReviewButton(customId: string) {
  return customId.startsWith("glow_scam_approve:") || customId.startsWith("glow_scam_delete:");
}

export async function reviewScamReport(reportId: string, decision: Exclude<ScamStatus, "pending">, reviewerId: string) {
  const { db, row } = await getScamItem(reportId);
  if (row.data.status !== "pending") throw new Error("SCAM_REPORT_NOT_FOUND_OR_ALREADY_REVIEWED");
  const now = new Date().toISOString();
  const nextData: ScamReportData = { ...row.data, status: decision, reviewedBy: reviewerId, reviewedAt: now };
  const { data: claimed, error: claimError } = await db.from("guild_items").update({ enabled: decision === "approved", data: toJson(nextData) }).eq("id", reportId).eq("kind", SCAM_REPORT_KIND).contains("data", { status: "pending" }).select("id, guild_id, name, data").maybeSingle();
  if (claimError) throw claimError;
  if (!claimed) throw new Error("SCAM_REPORT_NOT_FOUND_OR_ALREADY_REVIEWED");
  let roleAssigned = false;
  let roleAssignmentError: string | null = null;
  if (decision === "approved") {
    const member = await fetchGuildMember(row.guild_id, row.data.reportedUserId);
    if (!member) roleAssignmentError = "The reported user is not currently a member of the source server.";
    else {
      roleAssigned = await addGuildMemberRole(row.guild_id, row.data.reportedUserId, SCAMMER_ROLE_ID, "Glow approved scam report");
      if (!roleAssigned) roleAssignmentError = "Glow could not assign the scammer role. Check role hierarchy and Manage Roles.";
    }
  }
  const finalData: ScamReportData = { ...nextData, roleAssigned, roleAssignmentError };
  const { error: updateError } = await db.from("guild_items").update({ data: toJson(finalData) }).eq("id", reportId).eq("kind", SCAM_REPORT_KIND);
  if (updateError) throw updateError;
  return { report: { ...row, data: finalData }, decision, roleAssigned, roleAssignmentError };
}
