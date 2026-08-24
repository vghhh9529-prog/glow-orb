import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  Activity,
  ArrowLeft,
  Ban,
  BarChart3,
  Bot,
  Check,
  ChevronDown,
  CircleDot,
  Clock3,
  FileText,
  Hash,
  LayoutDashboard,
  ListChecks,
  MessageCircleMore,
  Mic2,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings2,
  Shield,
  Sparkles,
  Tags,
  Trash2,
  Trophy,
  UserPlus,
  Users,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  addCase,
  getCases,
  getGuildLeaderboard,
  getItems,
  getOverview,
  getSuggestions,
  removeItem,
  revokeModerationCase,
  saveItem,
  saveModule,
  updateSuggestion,
} from "@/lib/api.functions";
import { MODULE_KEYS, type ModuleKey, guildIconUrl } from "@/lib/discord";
import { MODULE_DEFAULTS, PLACEHOLDERS } from "@/lib/module-defaults";
import { useI18n } from "@/lib/i18n";
import { ConfigEditor, type Option } from "@/components/glow/config-editor";
import { TopBar } from "@/components/glow/shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface GuildWorkspace {
  botPresent: boolean;
  guild: {
    id: string;
    name: string;
    icon: string | null;
    memberCount?: number;
    onlineCount?: number;
    boostCount?: number;
    ownerId?: string;
  };
  settings?: Record<string, unknown> | null;
  roles?: Array<{ id: string; name: string; color?: number; managed?: boolean }>;
  channels?: Array<{ id: string; name: string; type: number; parentId?: string | null }>;
  modules?: Record<string, { enabled: boolean; config: Record<string, unknown> }>;
}

export interface ModerationCase {
  id?: string;
  active?: boolean;
  target_id?: string | null;
  target_name?: string | null;
  action?: string | null;
  reason?: string | null;
  created_at?: string | null;
}

export interface SuggestionRow {
  id?: string;
  content?: string | null;
  status?: string | null;
  author_name?: string | null;
  created_at?: string | null;
  upvotes?: number | null;
  downvotes?: number | null;
}

export interface GuildItem {
  id?: string;
  name?: string | null;
  enabled?: boolean;
  data?: Record<string, unknown> | null;
}

export interface LeaderboardRow {
  user_id?: string | null;
  username?: string | null;
  avatar?: string | null;
  xp?: number | null;
  level?: number | null;
  daily_xp?: number | null;
  weekly_xp?: number | null;
  monthly_xp?: number | null;
}

export interface GuildOverview {
  topMembers: Array<{
    user_id: string;
    username?: string | null;
    avatar?: string | null;
    xp: number;
    level: number;
  }>;
  recentCases: ModerationCase[];
  recentSuggestions: SuggestionRow[];
  itemCounts: Record<string, number>;
}

export type SectionKey = ModuleKey | "moderation" | "suggestion-review" | "leaderboard";

interface ModuleMeta {
  title: string;
  en: string;
  description: string;
  enDescription: string;
  icon: LucideIcon;
  group: "core" | "community" | "safety";
}

export const MODULE_META: Record<ModuleKey, ModuleMeta> = {
  welcome: {
    title: "الترحيب والمغادرة",
    en: "Welcome & Leave",
    description: "رسائل ترحيب ومغادرة وإمبد وكرت بصري قابل للتخصيص.",
    enDescription: "Custom welcome and leave messages, embeds and visual cards.",
    icon: UserPlus,
    group: "core",
  },
  leveling: {
    title: "نظام اللفلات",
    en: "Leveling",
    description: "اكسب XP من الكتابة والصوت وكافئ الأعضاء بالرولات.",
    enDescription: "Reward active members with text, voice and reaction XP.",
    icon: Trophy,
    group: "community",
  },
  suggestions: {
    title: "الاقتراحات",
    en: "Suggestions",
    description: "استقبل اقتراحات الأعضاء وراجعها وصوّت عليها.",
    enDescription: "Collect, review and vote on community suggestions.",
    icon: MessageCircleMore,
    group: "community",
  },
  autoroles: {
    title: "الرولات التلقائية",
    en: "Auto Roles",
    description: "أعطِ الأعضاء والبوتات رولات تلقائياً عند الدخول.",
    enDescription: "Assign member and bot roles automatically on join.",
    icon: Tags,
    group: "core",
  },
  tempvoice: {
    title: "الرومات المؤقتة",
    en: "Temp Voice",
    description: "روم لوبي ينشئ رومات صوتية خاصة ويحذفها عند الفراغ.",
    enDescription: "Spawn private voice rooms from a lobby and clean them up.",
    icon: Mic2,
    group: "core",
  },
  autoreply: {
    title: "الرد التلقائي",
    en: "Auto Reply",
    description: "ردود مخصصة على كلمات وعبارات يحددها صاحب السيرفر.",
    enDescription: "Custom replies for phrases selected by the server owner.",
    icon: MessageCircleMore,
    group: "community",
  },
  autointeraction: {
    title: "التفاعل التلقائي",
    en: "Auto Interaction",
    description: "أضف رياكشنات تلقائية على الرسائل المطابقة.",
    enDescription: "Add automatic reactions to matching messages.",
    icon: Zap,
    group: "community",
  },
  automod: {
    title: "الأوتومود",
    en: "AutoMod",
    description: "فلاتر سبام وروابط ودعوات وكلمات ممنوعة متزامنة مع Discord.",
    enDescription: "Discord-synced spam, link, invite and word filters.",
    icon: Shield,
    group: "safety",
  },
  protection: {
    title: "الحماية من التخريب",
    en: "Anti-Nuke Protection",
    description: "راقب حذف وإنشاء الرومات والرولات والبان الجماعي.",
    enDescription: "Protect channels, roles and members from destructive actions.",
    icon: Shield,
    group: "safety",
  },
};

const SECTION_META: Record<"moderation" | "suggestion-review" | "leaderboard", ModuleMeta> = {
  moderation: {
    title: "أدوات الإشراف",
    en: "Moderation tools",
    description: "راجع حالات الميوت والبان والكِك واتخذ إجراءً موثقاً.",
    enDescription: "Review mute, ban and kick cases with an audit trail.",
    icon: Ban,
    group: "safety",
  },
  "suggestion-review": {
    title: "مراجعة الاقتراحات",
    en: "Suggestion review",
    description: "حوّل اقتراحات الأعضاء إلى قرارات واضحة للفريق.",
    enDescription: "Turn member suggestions into clear staff decisions.",
    icon: ListChecks,
    group: "community",
  },
  leaderboard: {
    title: "صدارة السيرفر",
    en: "Server leaderboard",
    description: "قارن نشاط الأعضاء حسب XP اليومي أو الأسبوعي أو الكلي.",
    enDescription: "Compare member activity by daily, weekly or total XP.",
    icon: Trophy,
    group: "community",
  },
};

export function isModuleKey(value: string | undefined): value is ModuleKey {
  return Boolean(value && MODULE_KEYS.includes(value as ModuleKey));
}

function isSectionKey(value: string | undefined): value is SectionKey {
  return (
    isModuleKey(value) ||
    value === "moderation" ||
    value === "suggestion-review" ||
    value === "leaderboard"
  );
}

function SectionLink({
  guildId,
  section,
  icon: Icon,
  children,
}: {
  guildId: string;
  section: SectionKey | "overview";
  icon: LucideIcon;
  children: ReactNode;
}) {
  const location = useLocation();
  const href =
    section === "overview" ? `/dashboard/${guildId}` : `/dashboard/${guildId}/${section}`;
  const active =
    section === "overview"
      ? location.pathname === `/dashboard/${guildId}` ||
        location.pathname === `/dashboard/${guildId}/`
      : location.pathname.includes(`/${section}`);
  return (
    <Link
      to={section === "overview" ? "/dashboard/$guildId" : "/dashboard/$guildId/$section"}
      params={section === "overview" ? { guildId } : { guildId, section }}
      className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
        active
          ? "bg-primary/15 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.24)]"
          : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
      }`}
      aria-current={active ? "page" : undefined}
    >
      <Icon
        className={`size-4 shrink-0 ${active ? "text-primary" : "text-muted-foreground group-hover:text-primary"}`}
      />
      <span className="truncate">{children}</span>
      <span className="sr-only">{href}</span>
    </Link>
  );
}

export function GuildDashboardLayout({
  guildId,
  workspace,
  children,
}: {
  guildId: string;
  workspace: GuildWorkspace;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const activeModules = MODULE_KEYS.filter((key) => workspace.modules?.[key]?.enabled).length;
  const guildIcon = guildIconUrl(workspace.guild.id, workspace.guild.icon);

  const groups = [
    {
      label: t("الأساسيات", "Essentials"),
      items: ["welcome", "leveling", "autoroles", "tempvoice"] as ModuleKey[],
    },
    {
      label: t("المجتمع", "Community"),
      items: ["suggestions", "autoreply", "autointeraction"] as ModuleKey[],
    },
    {
      label: t("الأمان والإشراف", "Safety & moderation"),
      items: ["automod", "protection"] as ModuleKey[],
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <TopBar
        right={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: "/dashboard" })}
            className="gap-2"
          >
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline">{t("السيرفرات", "Servers")}</span>
          </Button>
        }
      />
      <div className="mx-auto flex w-full max-w-[1440px] gap-4 px-3 py-4 sm:px-5 lg:gap-6 lg:px-6">
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-20 space-y-4">
            <Card className="glow-panel overflow-hidden p-3">
              <button
                type="button"
                onClick={() => navigate({ to: "/dashboard" })}
                className="flex w-full items-center gap-3 rounded-xl p-2 text-start hover:bg-sidebar-accent"
              >
                {guildIcon ? (
                  <img src={guildIcon} alt="" className="size-11 rounded-xl" />
                ) : (
                  <div className="flex size-11 items-center justify-center rounded-xl bg-primary/15 font-bold text-primary">
                    {workspace.guild.name.slice(0, 2)}
                  </div>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-foreground">
                    {workspace.guild.name}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <CircleDot className="size-3 text-success" />
                    {t(`${activeModules} أنظمة مفعلة`, `${activeModules} modules active`)}
                  </span>
                </span>
                <ChevronDown className="size-4 text-muted-foreground" />
              </button>
              <div className="mt-3 border-t border-border/50 pt-3">
                <SectionLink guildId={guildId} section="overview" icon={LayoutDashboard}>
                  {t("نظرة عامة", "Overview")}
                </SectionLink>
              </div>
            </Card>

            {groups.map((group) => (
              <div key={group.label}>
                <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  {group.label}
                </p>
                <div className="space-y-1">
                  {group.items.map((key) => {
                    const Icon = MODULE_META[key].icon;
                    return (
                      <SectionLink key={key} guildId={guildId} section={key} icon={Icon}>
                        {t(MODULE_META[key].title, MODULE_META[key].en)}
                      </SectionLink>
                    );
                  })}
                </div>
              </div>
            ))}

            <div>
              <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                {t("الأدوات", "Tools")}
              </p>
              <div className="space-y-1">
                <SectionLink guildId={guildId} section="moderation" icon={Ban}>
                  {t("أدوات الإشراف", "Moderation")}
                </SectionLink>
                <SectionLink guildId={guildId} section="suggestion-review" icon={ListChecks}>
                  {t("مراجعة الاقتراحات", "Suggestion review")}
                </SectionLink>
                <SectionLink guildId={guildId} section="leaderboard" icon={Trophy}>
                  {t("الصدارة", "Leaderboard")}
                </SectionLink>
              </div>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mb-4 flex gap-2 overflow-x-auto rounded-2xl border border-border/50 bg-sidebar/80 p-2 lg:hidden">
            <SectionLink guildId={guildId} section="overview" icon={LayoutDashboard}>
              {t("الرئيسية", "Home")}
            </SectionLink>
            {MODULE_KEYS.map((key) => {
              const Icon = MODULE_META[key].icon;
              return (
                <SectionLink key={key} guildId={guildId} section={key} icon={Icon}>
                  {t(MODULE_META[key].title, MODULE_META[key].en)}
                </SectionLink>
              );
            })}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <Card className={`glow-panel p-5 ${accent ? "border-primary/40 bg-primary/5" : ""}`}>
      <div className="flex items-center justify-between">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>
        {accent && <Sparkles className="size-4 text-primary" />}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">{value}</p>
    </Card>
  );
}

function PanelTitle({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>
        <div>
          <h2 className="font-bold text-foreground">{title}</h2>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function GuildOverviewPage({
  guildId,
  workspace,
}: {
  guildId: string;
  workspace: GuildWorkspace;
}) {
  const { t } = useI18n();
  const overview = useQuery<GuildOverview>({
    queryKey: ["overview", guildId],
    queryFn: async () => (await getOverview({ data: { guildId } })) as unknown as GuildOverview,
  });
  const enabledCount = MODULE_KEYS.filter((key) => workspace.modules?.[key]?.enabled).length;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/15 via-card/70 to-card/40 p-6 shadow-[0_20px_70px_-36px_hsl(var(--primary)/0.7)] sm:p-8">
        <div className="pointer-events-none absolute -left-16 -top-20 size-64 rounded-full bg-primary/15 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <Badge className="bg-primary/15 text-primary hover:bg-primary/15">
              {t("لوحة الإدارة", "Control center")}
            </Badge>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-foreground sm:text-4xl">
              {t(`أهلاً بك في ${workspace.guild.name}`, `Welcome to ${workspace.guild.name}`)}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
              {t(
                "هذه نظرتك السريعة على صحة السيرفر والأنظمة التي تعمل الآن. عدّل أي نظام من القائمة الجانبية وسيتم حفظه مباشرة.",
                "A quick view of your server health and active systems. Choose a module from the sidebar to configure and save it.",
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-border/60 bg-background/30 px-4 py-3 text-center">
              <p className="text-2xl font-black text-primary">{enabledCount}</p>
              <p className="text-[11px] text-muted-foreground">
                {t("أنظمة مفعلة", "Active modules")}
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/30 px-4 py-3 text-center">
              <p className="text-2xl font-black text-foreground">
                {workspace.guild.boostCount ?? 0}
              </p>
              <p className="text-[11px] text-muted-foreground">{t("تعزيزات", "Boosts")}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Users}
          label={t("إجمالي الأعضاء", "Members")}
          value={(workspace.guild.memberCount ?? 0).toLocaleString()}
          accent
        />
        <StatCard
          icon={Activity}
          label={t("متصلون الآن", "Online now")}
          value={(workspace.guild.onlineCount ?? 0).toLocaleString()}
        />
        <StatCard
          icon={Settings2}
          label={t("الأنظمة المفعلة", "Active modules")}
          value={enabledCount}
        />
        <StatCard
          icon={FileText}
          label={t("العناصر المخصصة", "Custom items")}
          value={Object.values(overview.data?.itemCounts ?? {}).reduce((a, b) => a + b, 0)}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="glow-panel p-5 sm:p-6">
          <PanelTitle
            icon={Trophy}
            title={t("أكثر الأعضاء نشاطاً", "Most active members")}
            description={t(
              "أفضل 10 أعضاء حسب نقاط الخبرة.",
              "Top 10 members by experience points.",
            )}
            action={
              <Button asChild variant="outline" size="sm">
                <Link
                  to="/dashboard/$guildId/$section"
                  params={{ guildId, section: "leaderboard" }}
                >
                  {t("عرض الكل", "View all")}
                </Link>
              </Button>
            }
          />
          <div className="mt-5 divide-y divide-border/50">
            {overview.isLoading && <Skeleton className="h-56 w-full" />}
            {(overview.data?.topMembers ?? []).map((member, index) => (
              <div key={member.user_id} className="flex items-center gap-3 py-3">
                <span className="w-6 text-sm font-bold text-primary">#{index + 1}</span>
                <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {(member.username ?? member.user_id).slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {member.username ?? member.user_id}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t(`مستوى ${member.level}`, `Level ${member.level}`)}
                  </p>
                </div>
                <span className="text-sm font-bold text-primary">
                  {member.xp.toLocaleString()} XP
                </span>
              </div>
            ))}
            {!overview.isLoading && (overview.data?.topMembers ?? []).length === 0 && (
              <EmptyState
                icon={Trophy}
                title={t("لا توجد بيانات ليفلات بعد", "No leveling data yet")}
              />
            )}
          </div>
        </Card>

        <Card className="glow-panel p-5 sm:p-6">
          <PanelTitle
            icon={Shield}
            title={t("حالة الأنظمة", "Module health")}
            description={t(
              "لمحة عن الأنظمة المتاحة في هذه اللوحة.",
              "A snapshot of the systems available here.",
            )}
          />
          <div className="mt-5 space-y-2">
            {MODULE_KEYS.map((key) => {
              const meta = MODULE_META[key];
              const enabled = Boolean(workspace.modules?.[key]?.enabled);
              const Icon = meta.icon;
              return (
                <Link
                  key={key}
                  to="/dashboard/$guildId/$section"
                  params={{ guildId, section: key }}
                  className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/20 px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  <Icon className="size-4 text-primary" />
                  <span className="flex-1 text-sm text-foreground">{t(meta.title, meta.en)}</span>
                  <Badge
                    variant={enabled ? "default" : "secondary"}
                    className={enabled ? "bg-success/15 text-success hover:bg-success/15" : ""}
                  >
                    {enabled ? t("يعمل", "Active") : t("متوقف", "Off")}
                  </Badge>
                </Link>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="glow-panel p-5 sm:p-6">
          <PanelTitle
            icon={Ban}
            title={t("آخر إجراءات الإشراف", "Recent moderation")}
            description={t(
              "أحدث الحالات المسجلة من لوحة Glow.",
              "Latest cases recorded from Glow.",
            )}
          />
          <div className="mt-5 space-y-2">
            {(overview.data?.recentCases ?? []).slice(0, 5).map((item, index) => (
              <div
                key={String(item.id ?? index)}
                className="flex items-center gap-3 rounded-xl bg-background/25 px-3 py-3"
              >
                <span className="flex size-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                  <Ban className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {String(item.target_name ?? item.target_id ?? "Member")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {String(item.action ?? "action")} ·{" "}
                    {String(item.reason ?? t("بدون سبب", "No reason"))}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">{formatDate(item.created_at)}</span>
              </div>
            ))}
            {(overview.data?.recentCases ?? []).length === 0 && (
              <EmptyState icon={Ban} title={t("لا توجد حالات حديثة", "No recent cases")} />
            )}
          </div>
        </Card>
        <Card className="glow-panel p-5 sm:p-6">
          <PanelTitle
            icon={MessageCircleMore}
            title={t("آخر الاقتراحات", "Recent suggestions")}
            description={t("تابع نبض مجتمعك بسرعة.", "Keep an eye on community feedback.")}
          />
          <div className="mt-5 space-y-2">
            {(overview.data?.recentSuggestions ?? []).map((item, index) => (
              <div key={String(item.id ?? index)} className="rounded-xl bg-background/25 px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {String(item.author_name ?? t("عضو", "Member"))}
                  </p>
                  <Badge variant="secondary">{String(item.status ?? "pending")}</Badge>
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                  {String(item.content ?? "")}
                </p>
              </div>
            ))}
            {(overview.data?.recentSuggestions ?? []).length === 0 && (
              <EmptyState
                icon={MessageCircleMore}
                title={t("لا توجد اقتراحات حديثة", "No recent suggestions")}
              />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

export function GuildSectionPage({
  guildId,
  section,
  workspace,
}: {
  guildId: string;
  section: string;
  workspace: GuildWorkspace;
}) {
  if (!isSectionKey(section)) return <NotFoundSection />;
  const normalized = section as SectionKey;
  if (isModuleKey(normalized))
    return <ModulePage guildId={guildId} moduleKey={normalized} workspace={workspace} />;
  if (normalized === "moderation") return <ModerationPage guildId={guildId} />;
  if (normalized === "suggestion-review") return <SuggestionsPage guildId={guildId} />;
  return <LeaderboardPage guildId={guildId} />;
}

function ModulePage({
  guildId,
  moduleKey,
  workspace,
}: {
  guildId: string;
  moduleKey: ModuleKey;
  workspace: GuildWorkspace;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const meta = MODULE_META[moduleKey];
  const current = workspace.modules?.[moduleKey];
  const [enabled, setEnabled] = useState(Boolean(current?.enabled));
  const [config, setConfig] = useState<Record<string, unknown>>(
    current?.config ?? MODULE_DEFAULTS[moduleKey],
  );

  useEffect(() => {
    setEnabled(Boolean(current?.enabled));
    setConfig(current?.config ?? MODULE_DEFAULTS[moduleKey]);
  }, [moduleKey, current]);

  const save = useMutation<{ ok: boolean; sync?: { ok?: boolean } }>({
    mutationFn: async () =>
      (await saveModule({ data: { guildId, module: moduleKey, enabled, config } })) as {
        ok: boolean;
        sync?: { ok?: boolean };
      },
    onSuccess: (result: { sync?: { ok?: boolean } }) => {
      toast.success(t("تم حفظ إعدادات النظام", "Module settings saved"));
      if (moduleKey === "automod" && result.sync && !result.sync.ok)
        toast.warning(
          t(
            "تم الحفظ لكن تعذرت مزامنة بعض قواعد Discord",
            "Saved, but some Discord rules could not sync",
          ),
        );
      qc.invalidateQueries({ queryKey: ["workspace", guildId] });
      qc.invalidateQueries({ queryKey: ["overview", guildId] });
    },
    onError: () => toast.error(t("تعذر حفظ الإعدادات", "Could not save settings")),
  });

  const roles: Option[] = (workspace.roles ?? []).map((role) => ({ id: role.id, name: role.name }));
  const channels: Option[] = (workspace.channels ?? []).map((channel) => ({
    id: channel.id,
    name: channel.name,
  }));
  const Icon = meta.icon;

  return (
    <div className="space-y-6">
      <SectionHero
        icon={Icon}
        title={t(meta.title, meta.en)}
        description={t(meta.description, meta.enDescription)}
        enabled={enabled}
        onEnabledChange={setEnabled}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <Card className="glow-panel p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-5">
            <div>
              <h2 className="font-bold text-foreground">{t("الإعدادات", "Configuration")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t(
                  "عدّل القيم ثم احفظ لتطبيقها على السيرفر.",
                  "Adjust values and save to apply them to the server.",
                )}
              </p>
            </div>
            <Button onClick={() => save.mutate()} disabled={save.isPending} className="gap-2">
              {save.isPending ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              {t("حفظ التغييرات", "Save changes")}
            </Button>
          </div>
          <div className="pt-5">
            <ConfigEditor config={config} roles={roles} channels={channels} onChange={setConfig} />
          </div>
        </Card>

        <aside className="space-y-5">
          <Card className="glow-panel p-5">
            <PanelTitle icon={Sparkles} title={t("ملاحظات سريعة", "Quick notes")} />
            <div className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
              <p>
                {t(
                  "كل الحقول محفوظة على مستوى السيرفر. تقدر ترجع وتغيّرها في أي وقت.",
                  "Every field is stored per server and can be changed at any time.",
                )}
              </p>
              <p>
                {t(
                  "استخدم القنوات والرولات من القوائم الجاهزة لتجنب أخطاء الـ ID.",
                  "Use the channel and role pickers to avoid ID mistakes.",
                )}
              </p>
            </div>
          </Card>
          {moduleKey === "welcome" || moduleKey === "leveling" ? (
            <PlaceholderHelp moduleKey={moduleKey} />
          ) : null}
          {(moduleKey === "autoreply" ||
            moduleKey === "autointeraction" ||
            moduleKey === "tempvoice") && <ItemManager guildId={guildId} kind={moduleKey} />}
        </aside>
      </div>
    </div>
  );
}

function SectionHero({
  icon: Icon,
  title,
  description,
  enabled,
  onEnabledChange,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  enabled?: boolean;
  onEnabledChange?: (value: boolean) => void;
}) {
  const { t } = useI18n();
  return (
    <section className="rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/12 via-card/70 to-card/35 p-6 sm:p-7">
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
        <div className="flex items-start gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-[0_0_35px_hsl(var(--primary)/0.28)]">
            <Icon className="size-7" />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Glow module</p>
            <h1 className="mt-2 text-2xl font-black text-foreground sm:text-3xl">{title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
        </div>
        {typeof enabled === "boolean" && onEnabledChange && (
          <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/25 px-4 py-3">
            <div className="text-end">
              <p className="text-sm font-semibold text-foreground">
                {t("تفعيل النظام", "Enable module")}
              </p>
              <p className="text-xs text-muted-foreground">
                {enabled ? t("يعمل الآن", "Running") : t("متوقف", "Disabled")}
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={onEnabledChange} />
          </div>
        )}
      </div>
    </section>
  );
}

function PlaceholderHelp({ moduleKey }: { moduleKey: "welcome" | "leveling" }) {
  const { t } = useI18n();
  return (
    <Card className="glow-panel p-5">
      <PanelTitle
        icon={Hash}
        title={t("المتغيرات الجاهزة", "Available variables")}
        description={t(
          "انسخ أي متغير والصقه داخل رسالتك.",
          "Copy a variable into any message field.",
        )}
      />
      <div className="mt-4 space-y-2">
        {PLACEHOLDERS.filter(
          (item) =>
            moduleKey === "welcome" ||
            ["{user}", "{username}", "{level}", "{xp}", "{rank}"].includes(item.token),
        ).map((item) => (
          <div
            key={item.token}
            className="flex items-center justify-between gap-3 rounded-xl bg-background/25 px-3 py-2"
          >
            <code className="text-xs font-semibold text-primary">{item.token}</code>
            <span className="text-end text-xs text-muted-foreground">{t(item.ar, item.en)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ItemManager({
  guildId,
  kind,
}: {
  guildId: string;
  kind: "autoreply" | "autointeraction" | "tempvoice";
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const items = useQuery<GuildItem[]>({
    queryKey: ["items", guildId, kind],
    queryFn: async () => (await getItems({ data: { guildId, kind } })) as unknown as GuildItem[],
  });
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState("");
  const [response, setResponse] = useState("");

  const save = useMutation({
    mutationFn: () =>
      saveItem({
        data: {
          guildId,
          kind,
          name: name.trim() || trigger.trim() || "Glow item",
          enabled: true,
          data: { trigger: trigger.trim(), response: response.trim(), emoji: response.trim() },
        },
      }),
    onSuccess: () => {
      toast.success(t("تمت إضافة العنصر", "Item added"));
      setName("");
      setTrigger("");
      setResponse("");
      qc.invalidateQueries({ queryKey: ["items", guildId, kind] });
    },
    onError: () => toast.error(t("تعذر حفظ العنصر", "Could not save item")),
  });
  const remove = useMutation({
    mutationFn: (id: string) => removeItem({ data: { guildId, id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["items", guildId, kind] }),
    onError: () => toast.error(t("تعذر حذف العنصر", "Could not delete item")),
  });

  const title =
    kind === "autoreply"
      ? t("ردود مخصصة", "Custom replies")
      : kind === "autointeraction"
        ? t("تفاعلات مخصصة", "Custom interactions")
        : t("قوالب الرومات", "Voice templates");
  return (
    <Card className="glow-panel p-5">
      <PanelTitle
        icon={Plus}
        title={title}
        description={t("أضف عناصر إضافية يديرها البوت.", "Add extra items managed by the bot.")}
      />
      <div className="mt-4 space-y-3">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("اسم العنصر", "Item name")}
        />
        <Input
          value={trigger}
          onChange={(e) => setTrigger(e.target.value)}
          placeholder={
            kind === "tempvoice"
              ? t("اسم القالب أو القناة", "Template or channel name")
              : t("الكلمة أو العبارة", "Trigger phrase")
          }
        />
        <Textarea
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          rows={3}
          placeholder={
            kind === "autointeraction"
              ? t("الإيموجي أو التفاعل", "Emoji or interaction")
              : t("الرد الذي سيرسله البوت", "Bot response")
          }
        />
        <Button
          className="w-full gap-2"
          onClick={() => save.mutate()}
          disabled={save.isPending || !trigger.trim()}
        >
          <Plus className="size-4" /> {t("إضافة", "Add")}
        </Button>
      </div>
      <div className="mt-5 space-y-2 border-t border-border/50 pt-4">
        {items.isLoading && <Skeleton className="h-16" />}
        {(items.data ?? []).map((item, index) => {
          const data = (item.data ?? {}) as Record<string, unknown>;
          return (
            <div
              key={String(item.id ?? index)}
              className="flex items-center gap-2 rounded-xl bg-background/25 p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {String(item.name ?? data["trigger"] ?? "Glow item")}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {String(data["response"] ?? data["emoji"] ?? data["trigger"] ?? "")}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => remove.mutate(String(item.id))}
                aria-label={t("حذف", "Delete")}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          );
        })}
        {!items.isLoading && (items.data ?? []).length === 0 && (
          <p className="py-3 text-center text-xs text-muted-foreground">
            {t("لا توجد عناصر بعد", "No items yet")}
          </p>
        )}
      </div>
    </Card>
  );
}

function ModerationPage({ guildId }: { guildId: string }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const cases = useQuery<ModerationCase[]>({
    queryKey: ["cases", guildId, "all"],
    queryFn: async () =>
      (await getCases({ data: { guildId, filter: "all" } })) as unknown as ModerationCase[],
  });
  const [action, setAction] = useState("mute");
  const [targetId, setTargetId] = useState("");
  const [targetName, setTargetName] = useState("");
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState("60");
  const add = useMutation({
    mutationFn: () => {
      const data: {
        guildId: string;
        action: string;
        targetId: string;
        targetName?: string;
        reason: string;
        durationMinutes?: number;
      } = {
        guildId,
        action,
        targetId: targetId.trim(),
        reason: reason.trim() || t("إجراء من لوحة Glow", "Glow dashboard action"),
      };
      if (targetName.trim()) data.targetName = targetName.trim();
      if (action === "mute") data.durationMinutes = Number(duration) || 60;
      return addCase({ data });
    },
    onSuccess: () => {
      toast.success(t("تم تسجيل الإجراء", "Moderation action recorded"));
      setTargetId("");
      setTargetName("");
      setReason("");
      qc.invalidateQueries({ queryKey: ["cases", guildId, "all"] });
      qc.invalidateQueries({ queryKey: ["overview", guildId] });
    },
    onError: () => toast.error(t("تعذر تطبيق الإجراء", "Could not apply action")),
  });
  const revoke = useMutation({
    mutationFn: (caseId: string) => revokeModerationCase({ data: { guildId, caseId } }),
    onSuccess: () => {
      toast.success(t("تم إلغاء الحالة", "Case revoked"));
      qc.invalidateQueries({ queryKey: ["cases", guildId, "all"] });
    },
    onError: () => toast.error(t("تعذر إلغاء الحالة", "Could not revoke case")),
  });
  const meta = SECTION_META.moderation;
  return (
    <div className="space-y-6">
      <SectionHero
        icon={meta.icon}
        title={t(meta.title, meta.en)}
        description={t(meta.description, meta.enDescription)}
      />
      <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <Card className="glow-panel p-5">
          <PanelTitle
            icon={Ban}
            title={t("إجراء جديد", "New action")}
            description={t(
              "يسجل الإجراء ويرسله إلى Discord عند الحاجة.",
              "Record the action and send it to Discord when applicable.",
            )}
          />
          <div className="mt-5 space-y-4">
            <div className="space-y-2">
              <Label>{t("نوع الإجراء", "Action type")}</Label>
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["mute", "ban", "kick"].map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("أيدي العضو", "Member ID")}</Label>
              <Input
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                placeholder="123456789012345678"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("اسم العضو (اختياري)", "Member name (optional)")}</Label>
              <Input
                value={targetName}
                onChange={(e) => setTargetName(e.target.value)}
                placeholder="Glow user"
              />
            </div>
            {action === "mute" && (
              <div className="space-y-2">
                <Label>{t("مدة الميوت بالدقائق", "Mute duration in minutes")}</Label>
                <Input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>{t("السبب", "Reason")}</Label>
              <Textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t("اكتب سبباً واضحاً", "Write a clear reason")}
              />
            </div>
            <Button
              className="w-full gap-2"
              onClick={() => add.mutate()}
              disabled={add.isPending || !targetId.trim()}
            >
              <Ban className="size-4" />
              {t("تطبيق وتسجيل", "Apply & record")}
            </Button>
          </div>
        </Card>
        <Card className="glow-panel p-5 sm:p-6">
          <PanelTitle
            icon={Clock3}
            title={t("سجل الإشراف", "Moderation log")}
            description={t(
              "آخر 100 حالة مع إمكانية الإلغاء.",
              "The latest 100 cases with revoke controls.",
            )}
            action={
              <Button variant="outline" size="sm" onClick={() => cases.refetch()} className="gap-2">
                <RefreshCw className="size-4" />
                {t("تحديث", "Refresh")}
              </Button>
            }
          />
          <div className="mt-5 space-y-2">
            {cases.isLoading && <Skeleton className="h-60" />}
            {(cases.data ?? []).map((item, index) => {
              const active = item.active !== false;
              return (
                <div
                  key={String(item.id ?? index)}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-border/50 bg-background/20 p-3"
                >
                  <span className="flex size-9 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                    <Ban className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {String(item.target_name ?? item.target_id ?? "Member")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {String(item.action ?? "action")} ·{" "}
                      {String(item.reason ?? t("بدون سبب", "No reason"))}
                    </p>
                  </div>
                  <Badge variant={active ? "default" : "secondary"}>
                    {active ? t("نشطة", "Active") : t("ملغاة", "Revoked")}
                  </Badge>
                  {active && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => revoke.mutate(String(item.id))}
                      aria-label={t("إلغاء", "Revoke")}
                    >
                      <X className="size-4 text-warning" />
                    </Button>
                  )}
                </div>
              );
            })}
            {!cases.isLoading && (cases.data ?? []).length === 0 && (
              <EmptyState icon={Clock3} title={t("سجل الإشراف فارغ", "Moderation log is empty")} />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function SuggestionsPage({ guildId }: { guildId: string }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const suggestions = useQuery<SuggestionRow[]>({
    queryKey: ["suggestions", guildId, "all"],
    queryFn: async () =>
      (await getSuggestions({ data: { guildId, status: "all" } })) as unknown as SuggestionRow[],
  });
  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      updateSuggestion({
        data: {
          guildId,
          id,
          status,
          note: t("تم تحديثها من لوحة Glow", "Updated from Glow dashboard"),
        },
      }),
    onSuccess: () => {
      toast.success(t("تم تحديث الاقتراح", "Suggestion updated"));
      qc.invalidateQueries({ queryKey: ["suggestions", guildId, "all"] });
      qc.invalidateQueries({ queryKey: ["overview", guildId] });
    },
    onError: () => toast.error(t("تعذر تحديث الاقتراح", "Could not update suggestion")),
  });
  const meta = SECTION_META["suggestion-review"];
  return (
    <div className="space-y-6">
      <SectionHero
        icon={meta.icon}
        title={t(meta.title, meta.en)}
        description={t(meta.description, meta.enDescription)}
      />
      <Card className="glow-panel p-5 sm:p-6">
        <PanelTitle
          icon={ListChecks}
          title={t("طابور المراجعة", "Review queue")}
          description={t(
            "وافق أو ارفض أو علّم الاقتراح بأنه نُفذ.",
            "Approve, deny or mark a suggestion implemented.",
          )}
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => suggestions.refetch()}
              className="gap-2"
            >
              <RefreshCw className="size-4" />
              {t("تحديث", "Refresh")}
            </Button>
          }
        />
        <div className="mt-5 space-y-3">
          {suggestions.isLoading && <Skeleton className="h-64" />}
          {(suggestions.data ?? []).map((item, index) => {
            const status = String(item.status ?? "pending");
            const id = String(item.id ?? index);
            return (
              <div key={id} className="rounded-2xl border border-border/50 bg-background/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {String(item.author_name ?? t("عضو مجهول", "Anonymous member"))}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(item.created_at)}
                    </p>
                  </div>
                  <Badge variant="secondary">{status}</Badge>
                </div>
                <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                  {String(item.content ?? "")}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => update.mutate({ id, status: "approved" })}
                    disabled={update.isPending}
                    className="gap-1"
                  >
                    <Check className="size-4" />
                    {t("قبول", "Approve")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => update.mutate({ id, status: "implemented" })}
                    disabled={update.isPending}
                  >
                    {t("تم التنفيذ", "Implemented")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => update.mutate({ id, status: "denied" })}
                    disabled={update.isPending}
                    className="text-destructive"
                  >
                    {t("رفض", "Deny")}
                  </Button>
                </div>
              </div>
            );
          })}
          {!suggestions.isLoading && (suggestions.data ?? []).length === 0 && (
            <EmptyState icon={ListChecks} title={t("لا توجد اقتراحات", "No suggestions found")} />
          )}
        </div>
      </Card>
    </div>
  );
}

function LeaderboardPage({ guildId }: { guildId: string }) {
  const { t } = useI18n();
  const [scope, setScope] = useState("all");
  const board = useQuery<LeaderboardRow[]>({
    queryKey: ["guild-leaderboard", guildId, scope],
    queryFn: async () =>
      (await getGuildLeaderboard({ data: { guildId, scope } })) as unknown as LeaderboardRow[],
  });
  const meta = SECTION_META.leaderboard;
  const scopeOptions: Array<[string, string]> = [
    ["all", t("كل الوقت", "All time")],
    ["daily", t("اليوم", "Daily")],
    ["weekly", t("الأسبوع", "Weekly")],
    ["monthly", t("الشهر", "Monthly")],
  ];
  return (
    <div className="space-y-6">
      <SectionHero
        icon={meta.icon}
        title={t(meta.title, meta.en)}
        description={t(meta.description, meta.enDescription)}
      />
      <Card className="glow-panel p-5 sm:p-6">
        <PanelTitle
          icon={BarChart3}
          title={t("ترتيب XP", "XP ranking")}
          description={t(
            "بدّل الفترة لمقارنة نشاط أعضاء السيرفر.",
            "Switch the period to compare server activity.",
          )}
          action={
            <div className="flex flex-wrap gap-2">
              {scopeOptions.map(([value, label]) => (
                <Button
                  key={value}
                  size="sm"
                  variant={scope === value ? "default" : "outline"}
                  onClick={() => setScope(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
          }
        />
        <div className="mt-5 overflow-hidden rounded-2xl border border-border/50">
          <div className="grid grid-cols-[48px_minmax(0,1fr)_100px_80px] gap-3 bg-background/30 px-4 py-3 text-xs font-bold text-muted-foreground">
            <span>#</span>
            <span>{t("العضو", "Member")}</span>
            <span>XP</span>
            <span>{t("المستوى", "Level")}</span>
          </div>
          {board.isLoading && <Skeleton className="m-4 h-72" />}
          {(board.data ?? []).map((row, index) => (
            <div
              key={String(row.user_id ?? index)}
              className="grid grid-cols-[48px_minmax(0,1fr)_100px_80px] items-center gap-3 border-t border-border/40 px-4 py-3"
            >
              <span className={`font-bold ${index < 3 ? "text-primary" : "text-muted-foreground"}`}>
                #{index + 1}
              </span>
              <span className="truncate text-sm font-semibold text-foreground">
                {String(row.username ?? row.user_id ?? t("عضو", "Member"))}
              </span>
              <span className="text-sm font-bold text-primary">
                {Number(
                  row[
                    scope === "daily"
                      ? "daily_xp"
                      : scope === "weekly"
                        ? "weekly_xp"
                        : scope === "monthly"
                          ? "monthly_xp"
                          : "xp"
                  ] ?? 0,
                ).toLocaleString()}
              </span>
              <span className="text-sm text-muted-foreground">{String(row.level ?? 0)}</span>
            </div>
          ))}
          {!board.isLoading && (board.data ?? []).length === 0 && (
            <EmptyState icon={Trophy} title={t("لا توجد بيانات XP بعد", "No XP data yet")} />
          )}
        </div>
      </Card>
    </div>
  );
}

function EmptyState({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
      <p className="text-sm text-muted-foreground">{title}</p>
    </div>
  );
}

function NotFoundSection() {
  const { t } = useI18n();
  return (
    <Card className="glow-panel p-10 text-center">
      <Search className="mx-auto size-8 text-primary" />
      <h1 className="mt-4 text-xl font-bold text-foreground">
        {t("القسم غير موجود", "Section not found")}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {t("اختر قسماً من القائمة الجانبية.", "Choose a section from the sidebar.")}
      </p>
    </Card>
  );
}

function formatDate(value: unknown) {
  if (!value) return "—";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("ar", { day: "numeric", month: "short" }).format(date);
}
