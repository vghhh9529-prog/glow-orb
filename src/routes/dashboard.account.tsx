import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { claimGlowDaily, getGlowLeaderboard, getMe, getMyProfile, getWallet, signOut } from "@/lib/api.functions";
import { TopBar } from "@/components/glow/shell";
import { GlowCoinIcon } from "@/components/glow/coin-icon";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import { userAvatarUrl } from "@/lib/discord";
import { toast } from "sonner";
import { Flame, LogOut, Gift, ArrowLeft, Trophy, Sparkles, Server, Zap } from "lucide-react";

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
  const board = useQuery({
    queryKey: ["glow-board"],
    queryFn: () => getGlowLeaderboard(),
    enabled: Boolean(me.data),
  });
  const profile = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => getMyProfile(),
    enabled: Boolean(me.data),
  });

  const claim = useMutation({
    mutationFn: () => claimGlowDaily(),
    onSuccess: (res: { ok?: boolean; amount?: number; nextAt?: string; reason?: string }) => {
      if (res.ok === false) {
        toast.error(
          res.reason === "cooldown"
            ? t("الهدية استُلمت مسبقاً، انتظر حتى موعدها القادم.", "This gift was already claimed. Wait until the next window.")
            : t("تعذر استلام الهدية الآن.", "The gift could not be claimed right now."),
        );
        qc.invalidateQueries({ queryKey: ["wallet"] });
        return;
      }
      toast.success(t(`استلمت ${res.amount ?? 0} Glow`, `Claimed ${res.amount ?? 0} Glow`));
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["glow-board"] });
    },
    onError: () => toast.error(t("تعذر الاتصال بالخادم، حاول مرة ثانية.", "Could not reach the server. Try again.")),
  });

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const next = wallet.data?.nextDailyAt ? new Date(wallet.data.nextDailyAt) : null;
  const remainingMs = next ? Math.max(0, next.getTime() - now) : 0;
  const remainingText = useMemo(() => {
    if (!remainingMs) return t("متاحة الآن", "Ready now");
    const totalMinutes = Math.ceil(remainingMs / 60_000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return t(
      `${hours ? `${hours}س ` : ""}${minutes}د متبقية`,
      `${hours ? `${hours}h ` : ""}${minutes}m remaining`,
    );
  }, [remainingMs, t]);
  const currentStreak = Number(wallet.data?.streak ?? 0);
  const streakProgress = Math.min(100, (currentStreak / 10) * 100);
  const nextReward = Number(wallet.data?.nextReward ?? 300);

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
        <nav className="mb-6 flex gap-2 overflow-x-auto pb-1" aria-label={t("قائمة الحساب", "Account navigation")}>
          {[
            ["#wallet", t("المحفظة", "Wallet")],
            ["#daily", t("الهدية اليومية", "Daily gift")],
            ["#glow-leaderboard", t("الصدارة", "Leaderboard")],
            ["#activity", t("النشاط", "Activity")],
          ].map(([href, label]) => (
            <a key={href} href={href} className="shrink-0 rounded-full border border-border/70 bg-card/50 px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:border-primary/40 hover:bg-primary/10 hover:text-primary">
              {label}
            </a>
          ))}
        </nav>

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

        <section id="wallet" aria-labelledby="glow-wallet-title" className="mt-6 scroll-mt-24">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Glow currency</p>
              <h2 id="glow-wallet-title" className="mt-1 text-lg font-bold text-foreground">
                {t("محفظة Glow", "Your Glow wallet")}
              </h2>
            </div>
            <GlowCoinIcon className="size-9" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="relative overflow-hidden border-primary/40 bg-gradient-to-br from-primary/15 via-primary/5 to-card/50 p-5">
              <div className="absolute -right-6 -top-8 size-24 rounded-full bg-primary/20 blur-2xl" />
              <div className="relative flex items-center gap-3">
                <GlowCoinIcon />
                <div>
                  <p className="text-xs text-muted-foreground">{t("الرصيد", "Balance")}</p>
                  <p className="mt-1 text-2xl font-black text-foreground">{Number(wallet.data?.balance ?? 0).toLocaleString("en-US")}</p>
                </div>
              </div>
            </Card>
            <Card className="border-border/60 bg-card/50 p-5">
              <Flame className="size-5 text-primary" />
              <p className="mt-2 text-xs text-muted-foreground">{t("الستريك", "Streak")}</p>
              <p className="text-2xl font-bold text-foreground">{wallet.data?.streak ?? 0}</p>
            </Card>
            <Card className="border-border/60 bg-card/50 p-5">
              <Gift className="size-5 text-primary" />
              <p className="mt-2 text-xs text-muted-foreground">{t("إجمالي المكتسب", "Total earned")}</p>
              <p className="text-2xl font-bold text-foreground">{Number(wallet.data?.totalEarned ?? 0).toLocaleString("en-US")}</p>
            </Card>
          </div>

          <Card id="daily" className="mt-4 scroll-mt-24 overflow-hidden border-primary/25 bg-gradient-to-r from-primary/10 via-card/60 to-cyan-400/5 p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                  <Gift className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{t("هدية Daily", "Daily gift")}</p>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {wallet.data?.canClaim ? t("جاهزة للاستلام الآن!", "Ready to claim now!") : remainingText}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-primary">
                    <span>+{nextReward.toLocaleString("en-US")} Glow</span>
                    <span className="text-muted-foreground">·</span>
                    <span>{t(`ستريك ${currentStreak}/10`, `Streak ${currentStreak}/10`)}</span>
                  </div>
                  <Progress value={streakProgress} className="mt-3 h-1.5 bg-primary/10" />
                </div>
              </div>
              <Button
                className="w-full shrink-0 sm:w-auto"
                disabled={!wallet.data?.canClaim || claim.isPending}
                onClick={() => claim.mutate()}
              >
                {claim.isPending ? t("جارٍ الاستلام...", "Claiming...") : t("استلم الهدية", "Claim gift")}
              </Button>
            </div>
          </Card>
        </section>

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

        <h2 id="glow-leaderboard" className="mt-10 scroll-mt-24 text-lg font-bold text-foreground">
          {t("صدارة Glow", "Glow leaderboard")}
        </h2>
        <Card className="mt-3 divide-y divide-border/50 border-border/60 bg-card/50">
          {board.isLoading && <Skeleton className="m-4 h-24" />}
          {board.data?.length === 0 && (
            <p className="px-5 py-6 text-center text-sm text-muted-foreground">
              {t("لا توجد محافظ في الصدارة بعد", "No wallets on the leaderboard yet")}
            </p>
          )}
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
                <span className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                  {row.balance.toLocaleString("en-US")}
                  <GlowCoinIcon className="size-5" />
                </span>
              </div>
            ),
          )}
        </Card>

        <h2 id="activity" className="mt-10 scroll-mt-24 text-lg font-bold text-foreground">
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
              <div key={h.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                  <GlowCoinIcon className="size-5" />
                  <span className="truncate">{h.note ?? h.kind}</span>
                </span>
                <span className={h.amount >= 0 ? "shrink-0 text-primary" : "shrink-0 text-destructive"}>
                  {h.amount >= 0 ? "+" : ""}
                  {Number(h.amount).toLocaleString("en-US")}
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
