import { requireSessionUser } from "./session.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const CURRENT_NOTIFICATIONS = [
  {
    notification_key: "glow-launch-2026-08",
    title_ar: "Glow انطلق",
    title_en: "Glow is live",
    body_ar: "لوحة تحكم أوضح، أنظمة أقوى، وتجربة Discord مصممة لمجتمعك.",
    body_en: "A clearer dashboard, stronger systems and a Discord experience built for your community.",
    href: "/dashboard",
    tone: "success",
  },
  {
    notification_key: "glow-coin-daily-2026-08",
    title_ar: "Glow Coin وصل",
    title_en: "Glow Coin is here",
    body_ar: "استلم هديتك اليومية وابنِ الستريك من صفحة حسابك.",
    body_en: "Claim your daily reward and build your streak from your account page.",
    href: "/dashboard/account",
    tone: "coin",
  },
  {
    notification_key: "ticket-workflow-2026-08",
    title_ar: "تحسينات التيكيت جاهزة",
    title_en: "Ticket workflow improved",
    body_ar: "أولوية بقائمة اختيار، إغلاق أسرع، وترانسكربت HTML مرتب لفريق الإدارة.",
    body_en: "Selectable priorities, faster closes and clean HTML transcripts for your staff.",
    href: "/dashboard",
    tone: "info",
  },
];

export type SiteNotification = {
  id: string;
  notificationKey: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  href: string | null;
  tone: string;
  createdAt: string;
  read: boolean;
};

async function ensureCurrentNotifications() {
  const { error } = await supabaseAdmin.from("site_notifications").upsert(CURRENT_NOTIFICATIONS, { onConflict: "notification_key" });
  if (error) console.error("Site notification sync failed", error);
}

export async function listMyNotifications() {
  const user = await requireSessionUser();
  await ensureCurrentNotifications();
  const [{ data: rows, error }, { data: reads, error: readsError }] = await Promise.all([
    supabaseAdmin
      .from("site_notifications")
      .select("id, notification_key, title_ar, title_en, body_ar, body_en, href, tone, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
    supabaseAdmin.from("site_notification_reads").select("notification_id").eq("user_id", user.id),
  ]);
  if (error) console.error("Site notifications load failed", error);
  if (readsError) console.error("Site notification reads load failed", readsError);
  const readIds = new Set((reads ?? []).map((read) => read.notification_id));
  const notifications: SiteNotification[] = (rows ?? []).map((row) => ({
    id: row.id,
    notificationKey: row.notification_key,
    titleAr: row.title_ar,
    titleEn: row.title_en,
    bodyAr: row.body_ar,
    bodyEn: row.body_en,
    href: row.href,
    tone: row.tone,
    createdAt: row.created_at,
    read: readIds.has(row.id),
  }));
  return { notifications, unreadCount: notifications.filter((notification) => !notification.read).length };
}

export async function markNotificationRead(notificationId: string) {
  const user = await requireSessionUser();
  const { error } = await supabaseAdmin.from("site_notification_reads").upsert({ notification_id: notificationId, user_id: user.id }, { onConflict: "notification_id,user_id" });
  if (error) throw new Error("Could not mark notification as read");
  return { ok: true };
}

export async function markAllNotificationsRead() {
  const user = await requireSessionUser();
  await ensureCurrentNotifications();
  const { data: rows } = await supabaseAdmin.from("site_notifications").select("id");
  const unread = (rows ?? []).map((row) => ({ notification_id: row.id, user_id: user.id }));
  if (unread.length > 0) {
    const { error } = await supabaseAdmin.from("site_notification_reads").upsert(unread, { onConflict: "notification_id,user_id" });
    if (error) throw new Error("Could not mark notifications as read");
  }
  return { ok: true };
}
