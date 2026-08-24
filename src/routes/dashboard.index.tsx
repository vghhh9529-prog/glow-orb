import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getMe, listGuilds } from "@/lib/api.functions";
import { TopBar } from "@/components/glow/shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import { botInviteUrl, guildIconUrl, userAvatarUrl } from "@/lib/discord";
import { Plus, Settings2, Users } from "lucide-react";

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
        right={
          <Link to="/dashboard/account" className="flex items-center gap-2">
            <img
              src={userAvatarUrl(me.data.id, me.data.avatar)}
              alt=""
              className="size-8 rounded-full ring-2 ring-primary/50"
            />
          </Link>
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
            [0, 1, 2].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
          {guilds.data?.map((g) => (
            <Card key={g.id} className="glow-panel group relative overflow-hidden border-border/60 bg-card/50 p-5 transition duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_24px_60px_-34px_hsl(var(--primary)/0.9)]">
              <div className="flex items-center gap-3">
                {guildIconUrl(g.id, g.icon) ? (
                  <img src={guildIconUrl(g.id, g.icon)!} alt="" className="size-12 rounded-xl" />
                ) : (
                  <div className="flex size-12 items-center justify-center rounded-xl bg-primary/15 font-bold text-primary">
                    {g.name.slice(0, 2)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">{g.name}</p>
                  {g.memberCount != null && (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="size-3" /> {g.memberCount}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-4">
                {g.botPresent ? (
                  <Button asChild className="w-full" size="sm">
                    <Link to="/dashboard/$guildId" params={{ guildId: g.id }}>
                      <Settings2 className="size-4" />
                      {t("إدارة", "Manage")}
                    </Link>
                  </Button>
                ) : (
                  <Button asChild className="w-full" size="sm" variant="outline">
                    <a href={botInviteUrl(g.id)} target="_blank" rel="noreferrer">
                      <Plus className="size-4" />
                      {t("أضف البوت", "Add bot")}
                    </a>
                  </Button>
                )}
              </div>
            </Card>
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
