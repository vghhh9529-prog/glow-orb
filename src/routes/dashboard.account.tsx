import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { claimGlowDaily, getGlowLeaderboard, getMe, getMyProfile, getWallet, signOut } from "@/lib/api.functions";
import { TopBar } from "@/components/glow/shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import { userAvatarUrl } from "@/lib/discord";
import { toast } from "sonner";
import { Coins, Flame, LogOut, Gift, ArrowLeft, Trophy, Sparkles, Server, Zap } from "lucide-react";

export const Route = createFileRoute("/dashboard/account")({
  head: () => ({
    meta: [
      { title: "ملفي الشخصي وعملة Glow" },
      {
        name: "description",
        content: "رصيدك من عملة Glow، المكافأة اليومية كل 12 ساعة، والصدارة.",
      },
      { property: "og:title", content: "Glow profile & currency" },
      { property: "og:description", content: "Your Glow balance, daily reward and leaderboard." },
    ],
  }),
  component: Account,
});

function Account() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  const wallet = useQuery({
    queryKey: ["wallet"],
    queryFn: () => getWallet(),
    enabled: Boolean(me.data),
  });
  const board = useQuery({ queryKey: ["glow-board"], queryFn: () => getGlowLeaderboard() });
  const profile = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => getMyProfile(),
    enabled: Boolean(me.data),
  });

  const claim = useMutation({
    mutationFn: () => claimGlowDaily(),
    onSuccess: (res: { amount?: number }) => {
      toast.success(t(`استلمت ${res.amount ?? 0} Glow ✨`, `Claimed ${res.amount ?? 0} Glow ✨`));
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["glow-board"] });
    },
    onError: () => toast.error(t("ما زال الوقت باقي", "Not available yet")),
  });

  if (!me.isLoading && !me.data) {
    return (
      <div className="min-h-screen bg-background">
        <TopBar />
        <div className="py-32 text-center">
          <Button asChild>
            <a href="/api/public/auth/discord/login">{t("دخول بديسكورد", "Login with Discord")}</a>
          </Button>
        </div>
      </div>
    );
  }

  const next = wallet.data?.nextDailyAt ? new Date(wallet.data.nextDailyAt) : null;

  return (
    <div className="min-h-screen bg-background">
      <TopBar
        right={
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await signOut();
              window.location.href = "/";
            }}
          >
            <LogOut className="size-4" />
          </Button>
        }
      />
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Link
          to="/dashboard"
          className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="size-4" /> {t("السيرفرات", "Servers")}
        </Link>

        {me.data && (
          <Card className="relative overflow-hidden border-primary/30 bg-gradient-to-br from-primary/15 via-card/70 to-card/40 p-6 sm:p-8">
            <div className="absolute -right-16 -top-20 size-52 rounded-full bg-primary/20 blur-3xl" />
            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <img
                  src={userAvatarUrl(me.data.id, me.data.avatar)}
                  alt=""
                  className="size-20 rounded-3xl ring-2 ring-primary/60 shadow-xl shadow-primary/20"
                />
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">Glow profile</p>
                  <p className="mt-1 text-2xl font-black text-foreground">
                    {me.data.global_name ?? me.data.username}
                  </p>
                  <p className="text-sm text-muted-foreground">@{me.data.username} · {me.data.id}</p>
                </div>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/25 px-5 py-4 text-left sm:min-w-44">
                <p className="text-xs font-semibold text-muted-foreground">{t("أفضل رانك في سيرفر", "Best server rank")}</p>
                <p className="mt-1 text-3xl font-black text-foreground">{profile.data?.primary?.rank ? `#${profile.data.primary.rank}` : "—"}</p>
                <p className="text-xs text-primary">{profile.data?.primary ? `Level ${profile.data.primary.level}` : t("ابدأ النشاط", "Start earning XP")}</p>
              </div>
            </div>
          </Card>
        )}

        {profile.data && (
          <>
            <p className="mt-4 text-sm text-muted-foreground">{t("اللفل والرانك يُحسبان لكل سيرفر، وإجمالي XP يجمع سجلاتك المحفوظة عبر السيرفرات.", "Levels and ranks are calculated per server; total XP aggregates your saved server profiles.")}</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="border-primary/30 bg-primary/5 p-5"><Trophy className="size-5 text-primary" /><p className="mt-3 text-xs text-muted-foreground">{t("أفضل رانك في سيرفر", "Best server rank")}</p><p className="mt-1 text-2xl font-black text-foreground">{profile.data.primary?.rank ? `#${profile.data.primary.rank}` : "—"}</p></Card>
            <Card className="border-border/60 bg-card/50 p-5"><Sparkles className="size-5 text-cyan-300" /><p className="mt-3 text-xs text-muted-foreground">{t("إجمالي XP", "Total XP")}</p><p className="mt-1 text-2xl font-black text-foreground">{profile.data.totals.xp.toLocaleString("en-US")}</p></Card>
            <Card className="border-border/60 bg-card/50 p-5"><Zap className="size-5 text-amber-300" /><p className="mt-3 text-xs text-muted-foreground">{t("أعلى لفل", "Highest level")}</p><p className="mt-1 text-2xl font-black text-foreground">Lv.{profile.data.totals.level}</p></Card>
            <Card className="border-border/60 bg-card/50 p-5"><Server className="size-5 text-violet-300" /><p className="mt-3 text-xs text-muted-foreground">{t("سيرفراتك النشطة", "Active servers")}</p><p className="mt-1 text-2xl font-black text-foreground">{profile.data.totals.servers}</p></Card>
            </div>
          </>
        )}

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Card className="border-primary/40 bg-primary/5 p-5">
            <Coins className="size-5 text-primary" />
            <p className="mt-2 text-xs text-muted-foreground">{t("الرصيد", "Balance")}</p>
            <p className="text-2xl font-bold text-foreground">{wallet.data?.balance ?? 0}</p>
          </Card>
          <Card className="border-border/60 bg-card/50 p-5">
            <Flame className="size-5 text-primary" />
            <p className="mt-2 text-xs text-muted-foreground">{t("الستريك", "Streak")}</p>
            <p className="text-2xl font-bold text-foreground">{wallet.data?.streak ?? 0}</p>
          </Card>
          <Card className="border-border/60 bg-card/50 p-5">
            <Gift className="size-5 text-primary" />
            <p className="mt-2 text-xs text-muted-foreground">
              {t("إجمالي المكتسب", "Total earned")}
            </p>
            <p className="text-2xl font-bold text-foreground">{wallet.data?.totalEarned ?? 0}</p>
          </Card>
        </div>

        <Card className="mt-6 flex flex-wrap items-center justify-between gap-3 border-border/60 bg-card/50 p-6">
          <div>
            <p className="font-semibold text-foreground">{t("المكافأة اليومية", "Daily reward")}</p>
            <p className="text-sm text-muted-foreground">
              {wallet.data?.canClaim
                ? t("جاهزة للاستلام الآن!", "Ready to claim now!")
                : next
                  ? t(`متاحة في ${next.toLocaleString()}`, `Available at ${next.toLocaleString()}`)
                  : t("كل 12 ساعة", "Every 12 hours")}
            </p>
          </div>
          <Button
            disabled={!wallet.data?.canClaim || claim.isPending}
            onClick={() => claim.mutate()}
          >
            {t("استلم", "Claim")}
          </Button>
        </Card>

        {profile.data && profile.data.servers.length > 0 && (
          <>
            <h2 className="mt-10 text-lg font-bold text-foreground">{t("تقدمك في السيرفرات", "Your server progress")}</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {profile.data.servers.slice(0, 6).map((row) => (
                <Card key={row.guild_id} className="flex items-center justify-between gap-4 border-border/60 bg-card/50 p-4">
                  <div className="flex min-w-0 items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Sparkles className="size-4" /></span><div className="min-w-0"><p className="truncate text-sm font-bold text-foreground">Server {row.guild_id.slice(-6)}</p><p className="text-xs text-muted-foreground">{Number(row.xp ?? 0).toLocaleString("en-US")} XP · Level {row.level ?? 0}</p></div></div>
                  <span className="shrink-0 text-xs font-bold text-primary">{Number(row.xp ?? 0).toLocaleString("en-US")} XP</span>
                </Card>
              ))}
            </div>
          </>
        )}

        <h2 className="mt-10 text-lg font-bold text-foreground">
          {t("صدارة Glow", "Glow leaderboard")}
        </h2>
        <Card className="mt-3 divide-y divide-border/50 border-border/60 bg-card/50">
          {board.isLoading && <Skeleton className="m-4 h-24" />}
          {board.data?.map(
            (
              row: {
                userId: string;
                balance: number;
                username?: string | null;
                avatar?: string | null;
              },
              i: number,
            ) => (
              <div key={row.userId} className="flex items-center gap-3 px-5 py-3">
                <span className="w-6 text-sm font-bold text-primary">#{i + 1}</span>
                <img
                  src={userAvatarUrl(row.userId, row.avatar)}
                  alt=""
                  className="size-8 rounded-full"
                />
                <span className="flex-1 truncate text-sm text-foreground">
                  {row.username ?? row.userId}
                </span>
                <span className="text-sm font-semibold text-primary">{row.balance}</span>
              </div>
            ),
          )}
        </Card>

        <h2 className="mt-10 text-lg font-bold text-foreground">
          {t("آخر العمليات", "Recent activity")}
        </h2>
        <Card className="mt-3 divide-y divide-border/50 border-border/60 bg-card/50">
          {(wallet.data?.history ?? []).map(
            (h: {
              id: string;
              amount: number;
              kind: string;
              note: string | null;
              created_at: string;
            }) => (
              <div key={h.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <span className="text-muted-foreground">{h.note ?? h.kind}</span>
                <span className={h.amount >= 0 ? "text-primary" : "text-destructive"}>
                  {h.amount >= 0 ? "+" : ""}
                  {h.amount}
                </span>
              </div>
            ),
          )}
          {wallet.data && wallet.data.history.length === 0 && (
            <p className="px-5 py-6 text-center text-sm text-muted-foreground">
              {t("لا توجد عمليات بعد", "Nothing yet")}
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
