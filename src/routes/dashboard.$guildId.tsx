import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { botInviteUrl } from "@/lib/discord";
import { getWorkspace } from "@/lib/api.functions";
import { useI18n } from "@/lib/i18n";
import { GuildDashboardLayout, type GuildWorkspace } from "@/components/glow/guild-dashboard";
import { TopBar } from "@/components/glow/shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, RefreshCw, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/dashboard/$guildId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "لوحة السيرفر — Glow" },
      { name: "description", content: "إدارة أنظمة Glow لسيرفر Discord من لوحة واحدة." },
    ],
  }),
  component: GuildDashboardRoute,
});

function GuildDashboardRoute() {
  const { guildId } = Route.useParams();
  const workspace = useQuery<GuildWorkspace>({
    queryKey: ["workspace", guildId],
    queryFn: async () => (await getWorkspace({ data: { guildId } })) as unknown as GuildWorkspace,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    retry: 1,
  });
  const { t } = useI18n();

  if (workspace.isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6">
        <div className="mx-auto max-w-7xl space-y-5">
          <Skeleton className="h-16 rounded-2xl" />
          <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
            <Skeleton className="hidden h-[680px] rounded-2xl lg:block" />
            <div className="space-y-5">
              <Skeleton className="h-44 rounded-3xl" />
              <Skeleton className="h-72 rounded-3xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (workspace.isError || !workspace.data) {
    return (
      <div className="min-h-screen bg-background">
        <TopBar />
        <div className="mx-auto max-w-lg px-4 py-28 text-center">
          <ShieldAlert className="mx-auto size-12 text-destructive" />
          <h1 className="mt-5 text-2xl font-bold text-foreground">
            {t("تعذر تحميل السيرفر", "Could not load the server")}
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {t(
              "تأكد أن حسابك يملك صلاحية إدارة السيرفر ثم حاول مرة أخرى.",
              "Make sure your account can manage this server, then try again.",
            )}
          </p>
          <Button className="mt-6" onClick={() => workspace.refetch()}>
            {t("إعادة المحاولة", "Try again")}
          </Button>
        </div>
      </div>
    );
  }

  if (!workspace.data.botPresent) {
    return (
      <div className="min-h-screen bg-background">
        <TopBar />
        <div className="mx-auto max-w-xl px-4 py-28 text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-3xl bg-warning/15 text-warning">
            <Plus className="size-8" />
          </div>
          <h1 className="mt-6 text-3xl font-black text-foreground">
            {t("أضف Glow أولاً", "Invite Glow first")}
          </h1>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            {t(
              "هذا السيرفر قابل للإدارة، لكن البوت غير موجود فيه. أضفه ثم ارجع إلى لوحة التحكم لتفعيل الأنظمة.",
              "You can manage this server, but the bot is not in it yet. Invite it, then return to enable your modules.",
            )}
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button asChild className="gap-2">
              <a href={botInviteUrl(guildId)} target="_blank" rel="noreferrer">
                <Plus className="size-4" />
                {t("إضافة البوت للسيرفر", "Invite bot to server")}
              </a>
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => workspace.refetch()}
              disabled={workspace.isFetching}
            >
              <RefreshCw className={`size-4 ${workspace.isFetching ? "animate-spin" : ""}`} />
              {t("تحقق من وجود البوت", "Check bot again")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <GuildDashboardLayout guildId={guildId} workspace={workspace.data}>
      <Outlet />
    </GuildDashboardLayout>
  );
}
