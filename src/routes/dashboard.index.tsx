import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getMe, listGuilds, signOut } from "@/lib/api.functions";
import { TopBar } from "@/components/glow/shell";
import { GlowCoinIcon } from "@/components/glow/coin-icon";
import { AccountMenu } from "@/components/glow/account-menu";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import { botInviteUrl, guildIconUrl } from "@/lib/discord";
import { ArrowUpRight, CheckCircle2, Plus, Users } from "lucide-react";

export const Route = createFileRoute("/dashboard/")({
  head: () => ({
    meta: [
      { title: "Choose a server — Glow Dashboard" },
      { name: "description", content: "Choose a Discord server to manage with the Glow control center." },
      { property: "og:title", content: "Glow Dashboard" },
      { property: "og:description", content: "Pick a server to manage with Glow." },
    ],
  }),
  component: Servers,
});

function Servers() {
  const { t } = useI18n();
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  const guilds = useQuery({
    queryKey: ["guilds"],
    queryFn: () => listGuilds(),
    enabled: Boolean(me.data),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    retry: 1,
  });

  if (me.isLoading) {
    return (
      <div className="min-h-screen bg-background p-10">
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!me.data) {
    return (
      <div className="min-h-screen bg-background">
        <TopBar />
        <div className="mx-auto max-w-md px-4 py-32 text-center">
          <h1 className="text-2xl font-bold text-foreground">
            {t("سجّل الدخول أولاً", "Sign in first")}
          </h1>
          <Button asChild className="mt-6">
            <a href="/api/public/auth/discord/login">{t("دخول بديسكورد", "Login with Discord")}</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <TopBar
        notifications
        right={
          <div className="flex items-center gap-2">
            <a
              href="/dashboard/account#daily"
              className="flex items-center gap-1.5 rounded-xl border border-primary/25 bg-primary/10 px-2 py-1.5 text-xs font-semibold text-primary transition hover:border-primary/50 hover:bg-primary/15 sm:px-3"
            >
              <GlowCoinIcon className="size-5" />
              <span className="hidden sm:inline">{t("هدية Daily", "Daily gift")}</span>
            </a>
            <AccountMenu
              user={me.data}
              onSignOut={async () => {
                await signOut();
                window.location.href = "/";
              }}
            />
          </div>
        }
      />
      <div className="mx-auto max-w-6xl animate-rise-in px-4 py-12 sm:py-16">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">Glow workspace</p>
            <h1 className="mt-3 font-display text-4xl font-bold tracking-[-0.04em] text-foreground sm:text-5xl">{t("سيرفراتك", "Your servers")}</h1>
            <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
              {t(
                "أدر كل سيرفر من مكان واحد. السيرفرات التي يظهر فيها Glow جاهزة للدخول، والبقية تحتاج إضافة البوت أولاً.",
                "Manage every server from one place. Servers with Glow are ready to open; the others need the bot first.",
              )}
            </p>
          </div>
          <div className="rounded-2xl border border-primary/20 bg-primary/8 px-4 py-3 text-end">
            <p className="text-2xl font-black text-primary">{guilds.data?.length ?? 0}</p>
            <p className="text-[11px] font-semibold text-muted-foreground">{t("سيرفر متاح", "Available servers")}</p>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {guilds.isLoading &&
            [0, 1, 2].map((i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
          {guilds.data?.map((g) => (
            <Link
              key={g.id}
              to="/dashboard/$guildId"
              params={{ guildId: g.id }}
              className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Card className="glow-panel h-full overflow-hidden border-border/60 bg-card/50 transition duration-300 group-hover:-translate-y-1 group-hover:border-primary/45 group-hover:shadow-[0_26px_70px_-34px_hsl(var(--primary)/0.95)]">
                <div className="flex min-h-36 flex-row-reverse items-stretch" dir="ltr">
                  <div className="relative w-32 shrink-0 overflow-hidden bg-gradient-to-br from-primary/25 via-[#171531] to-cyan-950/50 sm:w-36">
                    {guildIconUrl(g.id, g.icon) ? (
                      <img
                        src={guildIconUrl(g.id, g.icon)!}
                        alt={t(`${g.name} — صورة السيرفر`, `${g.name} server icon`)}
                        className="absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-110"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_50%_30%,hsl(var(--primary)/0.4),transparent_55%)] text-4xl font-black text-primary/80">
                        {g.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-l from-transparent to-[#0b0a1b]/35" />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col justify-between gap-4 p-4 text-left sm:p-5">
                    <div>
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${g.botPresent ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200" : "border-amber-300/35 bg-amber-300/10 text-amber-200"}`}>
                        {g.botPresent ? <CheckCircle2 className="size-3.5" /> : <Plus className="size-3.5" />}
                        {g.botPresent ? t("Glow مضاف", "Glow installed") : t("أضف Glow", "Add Glow")}
                      </span>
                      <p dir="auto" className="mt-3 truncate text-base font-bold text-foreground">{g.name}</p>
                      {g.memberCount != null ? (
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Users className="size-3.5" /> {Number(g.memberCount).toLocaleString("en-US")} {t("عضو", "members")}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground">{t("اضغط للمتابعة داخل الداشبورد", "Click to continue in the dashboard")}</p>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-3 text-xs font-semibold text-primary">
                      <span>{g.botPresent ? t("فتح الداشبورد", "Open dashboard") : t("فتح الإعداد", "Open setup")}</span>
                      <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
        {guilds.data && guilds.data.length === 0 && (
          <p className="mt-10 text-center text-sm text-muted-foreground">
            {t("ما عندك سيرفرات بصلاحية إدارة.", "No servers where you can manage.")}
          </p>
        )}
      </div>
    </div>
  );
}
