import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { claimGlowDaily, getGlowLeaderboard, getMe, getWallet, signOut } from "@/lib/api.functions";
import { TopBar } from "@/components/glow/shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import { userAvatarUrl } from "@/lib/discord";
import { toast } from "sonner";
import { Coins, Flame, LogOut, Gift, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/dashboard/account")({
  head: () => ({
    meta: [
      { title: "ملفي الشخصي وعملة Glow" },
      { name: "description", content: "رصيدك من عملة Glow، المكافأة اليومية كل 12 ساعة، والصدارة." },
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
  const wallet = useQuery({ queryKey: ["wallet"], queryFn: () => getWallet(), enabled: Boolean(me.data) });
  const board = useQuery({ queryKey: ["glow-board"], queryFn: () => getGlowLeaderboard() });

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
        <Link to="/dashboard" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="size-4" /> {t("السيرفرات", "Servers")}
        </Link>

        {me.data && (
          <Card className="flex items-center gap-4 border-border/60 bg-card/50 p-6">
            <img
              src={userAvatarUrl(me.data.id, me.data.avatar)}
              alt=""
              className="size-16 rounded-2xl ring-2 ring-primary/50"
            />
            <div>
              <p className="text-xl font-bold text-foreground">
                {me.data.global_name ?? me.data.username}
              </p>
              <p className="text-sm text-muted-foreground">@{me.data.username}</p>
            </div>
          </Card>
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
            <p className="mt-2 text-xs text-muted-foreground">{t("إجمالي المكتسب", "Total earned")}</p>
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
          <Button disabled={!wallet.data?.canClaim || claim.isPending} onClick={() => claim.mutate()}>
            {t("استلم", "Claim")}
          </Button>
        </Card>

        <h2 className="mt-10 text-lg font-bold text-foreground">{t("صدارة Glow", "Glow leaderboard")}</h2>
        <Card className="mt-3 divide-y divide-border/50 border-border/60 bg-card/50">
          {board.isLoading && <Skeleton className="m-4 h-24" />}
          {board.data?.map((row: { user_id: string; balance: number; username?: string | null; avatar?: string | null }, i: number) => (
            <div key={row.user_id} className="flex items-center gap-3 px-5 py-3">
              <span className="w-6 text-sm font-bold text-primary">#{i + 1}</span>
              <img src={userAvatarUrl(row.user_id, row.avatar)} alt="" className="size-8 rounded-full" />
              <span className="flex-1 truncate text-sm text-foreground">{row.username ?? row.user_id}</span>
              <span className="text-sm font-semibold text-primary">{row.balance}</span>
            </div>
          ))}
        </Card>

        <h2 className="mt-10 text-lg font-bold text-foreground">{t("آخر العمليات", "Recent activity")}</h2>
        <Card className="mt-3 divide-y divide-border/50 border-border/60 bg-card/50">
          {(wallet.data?.history ?? []).map((h: { id: string; amount: number; reason: string; created_at: string }) => (
            <div key={h.id} className="flex items-center justify-between px-5 py-3 text-sm">
              <span className="text-muted-foreground">{h.reason}</span>
              <span className={h.amount >= 0 ? "text-primary" : "text-destructive"}>
                {h.amount >= 0 ? "+" : ""}
                {h.amount}
              </span>
            </div>
          ))}
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
