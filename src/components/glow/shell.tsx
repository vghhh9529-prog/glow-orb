import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, Globe } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getNotifications, markAllNotificationsRead, markNotificationRead } from "@/lib/api.functions";
import logo from "@/assets/glow-brand-mark.png";
import { SUPPORT_SERVER_URL } from "@/lib/discord";

export function GlowMark({ size = 36 }: { size?: number }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <img
        src={logo}
        alt="Glow"
        width={size}
        height={size}
        className="rounded-xl object-cover shadow-[0_0_22px_hsl(var(--primary)/0.25)]"
      />
      <span className="truncate text-lg font-bold tracking-wide text-foreground">Glow</span>
    </span>
  );
}

export function LangToggle() {
  const { toggle, lang } = useI18n();
  return (
    <Button variant="ghost" size="sm" onClick={toggle} className="size-9 shrink-0 gap-1.5 border border-border/50 bg-background/35 px-0 shadow-sm hover:border-primary/30 hover:bg-primary/10 sm:h-9 sm:w-auto sm:px-3">
      <Globe className="size-4" />
      <span className="hidden sm:inline">{lang === "ar" ? "EN" : "ع"}</span>
      <span className="sm:hidden">{lang === "ar" ? "EN" : "ع"}</span>
    </Button>
  );
}

export function NotificationBell() {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const notifications = useQuery({
    queryKey: ["site-notifications"],
    queryFn: () => getNotifications(),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
  const markRead = useMutation({
    mutationFn: (notificationId: string) => markNotificationRead({ data: { notificationId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["site-notifications"] }),
  });
  const markAllRead = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["site-notifications"] }),
  });
  const items = notifications.data?.notifications ?? [];
  const unreadCount = notifications.data?.unreadCount ?? 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={t("الإشعارات", "Notifications")} className="relative size-9 shrink-0 rounded-xl border border-border/50 bg-background/35 p-0 hover:border-primary/30 hover:bg-primary/10">
          <Bell className="size-4" />
          {unreadCount > 0 && <span className="absolute -end-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-black leading-4 text-primary-foreground">{unreadCount > 9 ? "9+" : unreadCount}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl p-2">
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="p-0 text-sm">{t("إشعارات Glow", "Glow notifications")}</DropdownMenuLabel>
          {unreadCount > 0 && <button type="button" onClick={() => markAllRead.mutate()} className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:text-foreground"><CheckCheck className="size-3.5" />{t("قراءة الكل", "Mark all read")}</button>}
        </div>
        <DropdownMenuSeparator />
        {items.length === 0 ? <div className="px-3 py-8 text-center text-xs leading-6 text-muted-foreground">{t("ما عندك إشعارات جديدة حالياً.", "You have no notifications yet.")}</div> : items.map((notification) => (
          <DropdownMenuItem key={notification.id} asChild className={`mb-1 items-start gap-3 rounded-xl p-0 ${notification.read ? "opacity-65" : "bg-primary/7"}`}>
            <a href={notification.href ?? "/dashboard"} onClick={() => { if (!notification.read) markRead.mutate(notification.id); }} className="flex w-full items-start gap-3 rounded-xl p-3">
              <span className={`mt-1 size-2 shrink-0 rounded-full ${notification.read ? "bg-muted-foreground/30" : "bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.8)]"}`} />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold text-foreground">{lang === "ar" ? notification.titleAr : notification.titleEn}</span>
                <span className="mt-1 block whitespace-normal text-[11px] leading-5 text-muted-foreground">{lang === "ar" ? notification.bodyAr : notification.bodyEn}</span>
              </span>
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TopBar({ right, nav = false, notifications = false }: { right?: ReactNode; nav?: boolean; notifications?: boolean }) {
  const { t } = useI18n();
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-2 px-3 sm:h-16 sm:px-4">
        <div className="min-w-0 flex-1 flex items-center gap-3 sm:gap-6">
          <Link to="/" className="min-w-0">
            <GlowMark />
          </Link>
          {nav && (
            <nav className="hidden items-center gap-1 md:flex" aria-label={t("التنقل الرئيسي", "Primary navigation")}>
              <a href="#features" className="rounded-xl border border-transparent px-3 py-2 text-xs font-semibold text-muted-foreground transition-[transform,background-color,border-color,box-shadow,color] duration-200 hover:-translate-y-0.5 hover:border-primary/15 hover:bg-gradient-to-r hover:from-primary/12 hover:to-accent/10 hover:text-foreground hover:shadow-[0_10px_24px_-18px_hsl(var(--primary)/0.9)]">
                {t("المزايا", "Features")}
              </a>
              <a href="#systems" className="rounded-xl border border-transparent px-3 py-2 text-xs font-semibold text-muted-foreground transition-[transform,background-color,border-color,box-shadow,color] duration-200 hover:-translate-y-0.5 hover:border-primary/15 hover:bg-gradient-to-r hover:from-primary/12 hover:to-accent/10 hover:text-foreground hover:shadow-[0_10px_24px_-18px_hsl(var(--primary)/0.9)]">
                {t("الأنظمة", "Systems")}
              </a>
              <a href="#commands" className="rounded-xl border border-transparent px-3 py-2 text-xs font-semibold text-muted-foreground transition-[transform,background-color,border-color,box-shadow,color] duration-200 hover:-translate-y-0.5 hover:border-primary/15 hover:bg-gradient-to-r hover:from-primary/12 hover:to-accent/10 hover:text-foreground hover:shadow-[0_10px_24px_-18px_hsl(var(--primary)/0.9)]">
                {t("الأوامر", "Commands")}
              </a>
            </nav>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <a
            href={SUPPORT_SERVER_URL}
            target="_blank"
            rel="noreferrer"
            className="hidden rounded-xl border border-transparent px-3 py-2 text-sm text-muted-foreground transition-[transform,background-color,border-color,color] duration-200 hover:-translate-y-0.5 hover:border-primary/15 hover:bg-primary/10 hover:text-primary md:block"
          >
            {t("سيرفر الدعم", "Support")}
          </a>
          {notifications && <NotificationBell />}
          <LangToggle />
          {right}
        </div>
      </div>
    </header>
  );
}
