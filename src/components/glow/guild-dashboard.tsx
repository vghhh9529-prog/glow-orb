import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  Archive,
  ArrowLeft,
  Ban,
  BarChart3,
  Bot,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Command,
  Clock3,
  FileText,
  Hash,
  ImagePlus,
  LayoutDashboard,
  ListChecks,
  MessageCircleMore,
  MessageSquareOff,
  Mic2,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings2,
  Shield,
  Sparkles,
  Tags,
  Ticket,
  Upload,
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
  getScammerDirectory,
  getScammerReports,
  getGuildLeaderboard,
  getItems,
  getOverview,
  getSuggestions,
  removeItem,
  publishTicketPanel,
  provisionMessageGuard,
  revokeModerationCase,
  saveItem,
  saveModule,
  submitScamReport,
  updateSuggestion,
} from "@/lib/api.functions";
import { MODULE_KEYS, type ModuleKey, guildIconUrl } from "@/lib/discord";
import { COMMAND_CATALOG, type CommandCategory } from "@/lib/command-catalog";
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
  botCheckError?: boolean;
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

export interface ScamEvidence {
  key: string;
  url: string;
  name: string;
  type: string;
  size: number;
}

export interface ScammerDirectoryEntry {
  reportedUserId: string;
  username: string;
  avatar: string | null;
  reportCount: number;
  latestReportAt: string;
}

export interface ScammerReport {
  id: string;
  reportedUserId: string;
  username: string;
  avatar: string | null;
  description: string;
  evidence: ScamEvidence[];
  reporterName: string | null;
  createdAt: string;
  reviewedAt: string | null;
  roleAssigned: boolean;
  roleAssignmentError: string | null;
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

export type SectionKey = ModuleKey | "moderation" | "suggestion-review" | "leaderboard" | "scammers";

interface ModuleMeta {
  title: string;
  en: string;
  description: string;
  enDescription: string;
  icon: LucideIcon;
  group: "core" | "community" | "safety";
}

const COMMAND_ENGLISH: Record<string, string> = {
  "color-set": "Set a color role by number",
  colors: "View available colored roles",
  "get-emojis": "List the server emojis",
  help: "View the Glow help menu",
  ping: "Check Glow latency",
  "points-list": "View your points",
  rep: "Give a member reputation",
  roll: "Roll a six-sided die",
  suggest: "Submit a server suggestion",
  suggestion: "Review a suggestion",
  title: "View or change your profile title",
  translate: "Translate a message or phrase",
  avatar: "View a member avatar",
  banner: "View a member banner",
  invites: "View invite information",
  profile: "View a customizable profile card",
  roles: "List server roles and member counts",
  "server-avatar": "View the server avatar",
  "server-banner": "View the server banner",
  server: "View server information",
  user: "View member information",
  reset: "Reset server XP",
  setlevel: "Set a member level",
  setxp: "Set member XP",
  rank: "View a member rank card",
  top: "View the most active members",
  clear: "Delete recent messages",
  kick: "Remove a member from the server",
  ban: "Ban a member from the server",
  unban: "Remove a user ban",
  timeout: "Temporarily restrict a member",
  untimeout: "Remove a member timeout",
  "warn-add": "Record a member warning",
  warnings: "View member warnings",
};

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
  messageguard: {
    title: "حارس الرسائل",
    en: "Message Guard",
    description: "أنشئ رومًا يمنع الرسائل والرياكتات مع تطبيق طرد أو باند تلقائي.",
    enDescription: "Create a protected room that blocks messages and reactions with automatic kick or ban enforcement.",
    icon: MessageSquareOff,
    group: "safety",
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
  logging: {
    title: "اللوقات المتطورة",
    en: "Advanced Logs",
    description: "سجل الرسائل والأعضاء والرولات والقنوات والصوت والتذاكر في مكان مخصص.",
    enDescription: "Track messages, members, roles, channels, voice activity and tickets in one place.",
    icon: Archive,
    group: "safety",
  },
  customcommands: {
    title: "الأوامر المخصصة",
    en: "Custom Commands",
    description: "أنشئ أوامر قصيرة يرد عليها Glow داخل السيرفر.",
    enDescription: "Create short commands that Glow answers inside your server.",
    icon: Command,
    group: "community",
  },
  commands: {
    title: "إدارة الأوامر",
    en: "Command Center",
    description: "فعّل أو عطّل أوامر Glow المسجلة لكل سيرفر.",
    enDescription: "Enable or disable registered Glow commands per server.",
    icon: Command,
    group: "core",
  },
  tickets: {
    title: "التذاكر الفنية",
    en: "Support Tickets",
    description: "أنشئ لوحة دعم، وافتح تذاكر خاصة، وأدر فريق المساعدة.",
    enDescription: "Publish a support panel, open private tickets and manage your help team.",
    icon: Ticket,
    group: "core",
  },
};

const SECTION_META: Record<"moderation" | "suggestion-review" | "leaderboard" | "scammers", ModuleMeta> = {
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
  scammers: {
    title: "قائمة النصابين",
    en: "Scammer directory",
    description: "راجع البلاغات المعتمدة وابحث عن الحسابات المبلغ عنها داخل السيرفر.",
    enDescription: "Review approved reports and search reported accounts in this server.",
    icon: AlertTriangle,
    group: "safety",
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
    value === "leaderboard" ||
    value === "scammers"
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
      className={`group relative flex items-center gap-3 overflow-hidden rounded-xl border px-3 py-2.5 text-sm transition-[transform,background-color,border-color,box-shadow,color] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
        active
          ? "border-primary/25 bg-gradient-to-r from-primary/20 via-primary/10 to-accent/5 text-foreground shadow-[0_10px_24px_-18px_hsl(var(--primary)/0.95),inset_0_0_0_1px_hsl(var(--primary)/0.16)] before:absolute before:inset-y-2 before:start-0 before:w-0.5 before:rounded-full before:bg-gradient-to-b before:from-primary before:to-accent"
          : "border-transparent text-muted-foreground hover:-translate-y-0.5 hover:border-primary/15 hover:bg-sidebar-accent/80 hover:text-foreground hover:shadow-[0_10px_24px_-18px_hsl(var(--primary)/0.8)]"
      }`}
      aria-current={active ? "page" : undefined}
    >
      <span className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-lg transition-[background-color,box-shadow,color,transform] duration-200 ${active ? "bg-primary/15 text-primary shadow-[0_0_18px_-6px_hsl(var(--primary))]" : "bg-background/20 text-muted-foreground group-hover:scale-105 group-hover:bg-primary/10 group-hover:text-primary"}`}>
        <Icon className="size-4" />
      </span>
      <span className="relative z-10 truncate font-semibold">{children}</span>
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
  const { t, dir } = useI18n();
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
      items: ["suggestions", "autoreply", "autointeraction", "customcommands"] as ModuleKey[],
    },
    {
      label: t("الأوامر والدعم", "Commands & support"),
      items: ["commands", "tickets"] as ModuleKey[],
    },
    {
      label: t("الأمان والإشراف", "Safety & moderation"),
      items: ["automod", "messageguard", "protection", "logging"] as ModuleKey[],
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
      <div dir="ltr" className="mx-auto flex w-full max-w-[1440px] flex-row-reverse gap-4 px-3 py-4 sm:px-5 lg:gap-6 lg:px-6">
        <aside dir={dir} className="hidden w-64 shrink-0 lg:block">
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
                <SectionLink guildId={guildId} section="scammers" icon={AlertTriangle}>
                  {t("قائمة النصابين", "Scammer directory")}
                </SectionLink>
              </div>
            </div>
          </div>
        </aside>

        <main dir={dir} className="min-w-0 flex-1 animate-rise-in">
          <div className="dashboard-nav-scroll mb-4 flex gap-2 overflow-x-auto rounded-2xl border border-primary/15 bg-gradient-to-r from-sidebar/95 via-sidebar/80 to-primary/5 p-2 shadow-[0_16px_36px_-24px_hsl(var(--primary)/0.9)] lg:hidden">
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
            <SectionLink guildId={guildId} section="scammers" icon={AlertTriangle}>
              {t("قائمة النصابين", "Scammers")}
            </SectionLink>
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
  if (normalized === "commands")
    return <CommandsModulePage guildId={guildId} workspace={workspace} />;
  if (normalized === "tickets")
    return <TicketsPage guildId={guildId} workspace={workspace} />;
  if (normalized === "messageguard")
    return <MessageGuardPage guildId={guildId} workspace={workspace} />;
  if (isModuleKey(normalized))
    return <ModulePage guildId={guildId} moduleKey={normalized} workspace={workspace} />;
  if (normalized === "moderation") return <ModerationPage guildId={guildId} />;
  if (normalized === "suggestion-review") return <SuggestionsPage guildId={guildId} />;
  if (normalized === "scammers") return <ScammersPage guildId={guildId} />;
  return <LeaderboardPage guildId={guildId} />;
}

function TicketsPage({
  guildId,
  workspace,
}: {
  guildId: string;
  workspace: GuildWorkspace;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const current = workspace.modules?.["tickets"];
  const [enabled, setEnabled] = useState(current?.enabled ?? true);
  const [config, setConfig] = useState<Record<string, unknown>>(
    current?.config ?? MODULE_DEFAULTS.tickets,
  );
  const hydrated = useRef(false);

  useEffect(() => {
    hydrated.current = false;
    setEnabled(current?.enabled ?? true);
    setConfig(current?.config ?? MODULE_DEFAULTS.tickets);
    const timer = window.setTimeout(() => {
      hydrated.current = true;
    }, 0);
    return () => window.clearTimeout(timer);
  }, [current]);

  const save = useMutation({
    mutationFn: () => saveModule({ data: { guildId, module: "tickets", enabled, config } }),
    onSuccess: () => {
      toast.success(t("تم حفظ إعدادات التذاكر", "Ticket settings saved"));
      qc.invalidateQueries({ queryKey: ["workspace", guildId] });
    },
    onError: () => toast.error(t("تعذر حفظ إعدادات التذاكر", "Could not save ticket settings")),
  });

  useEffect(() => {
    if (!hydrated.current) return;
    const timer = window.setTimeout(() => save.mutate(), 550);
    return () => window.clearTimeout(timer);
  }, [enabled, config]);

  const publish = useMutation({
    mutationFn: async () => {
      await save.mutateAsync();
      return publishTicketPanel({ data: { guildId } });
    },
    onSuccess: () => {
      toast.success(t("تم نشر لوحة التذاكر في Discord", "Ticket panel published to Discord"));
      qc.invalidateQueries({ queryKey: ["workspace", guildId] });
    },
    onError: (error: unknown) => toast.error(ticketPublishError(error, t)),
  });

  const tickets = useQuery<GuildItem[]>({
    queryKey: ["items", guildId, "tickets"],
    queryFn: async () => (await getItems({ data: { guildId, kind: "tickets" } })) as unknown as GuildItem[],
  });
  const openTickets = (tickets.data ?? []).filter((item) => item.enabled !== false).length;
  const roles: Option[] = (workspace.roles ?? []).map((role) => ({ id: role.id, name: role.name }));
  const channels: Option[] = (workspace.channels ?? []).map((channel) => ({
    id: channel.id,
    name: channel.name,
  }));

  return (
    <div className="space-y-6">
      <SectionHero
        icon={Ticket}
        title={t("التذاكر الفنية", "Support Tickets")}
        description={t(
          "أنشئ نظام دعم خاص داخل Discord مع لوحة فتح تذكرة، فريق مساعدة، تصنيف، أولوية وسجل قابل للرجوع.",
          "Create a private support workflow inside Discord with a panel, support team, category, priority and a durable record.",
        )}
        enabled={enabled}
        onEnabledChange={setEnabled}
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <Card className="glow-panel p-5 sm:p-6">
          <div className="flex flex-col gap-4 border-b border-border/50 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">{t("إعداد كامل", "Full setup")}</p>
              <h2 className="mt-2 text-xl font-bold text-foreground">{t("لوحة الدعم", "Support panel")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t("كل تغيير يُحفظ تلقائياً لكل سيرفر.", "Every change is automatically saved per server.")}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => save.mutate()} disabled={save.isPending} className="gap-2"><Save className="size-4" />{t("حفظ الآن", "Save now")}</Button>
              <Button onClick={() => publish.mutate()} disabled={publish.isPending || save.isPending} className="gap-2"><Ticket className="size-4" />{publish.isPending ? t("جاري النشر…", "Publishing…") : t("انشر في Discord", "Publish to Discord")}</Button>
            </div>
          </div>
          <div className="pt-5"><ConfigEditor config={config} roles={roles} channels={channels} onChange={setConfig} /></div>
        </Card>
        <aside className="space-y-5">
          <Card className="glow-panel p-5">
            <PanelTitle icon={Ticket} title={t("دورة التذكرة", "Ticket flow")} />
            <div className="mt-4 space-y-3">
              {[

                ["01", t("نموذج الطلب", "Request form")],
                ["02", t("قناة خاصة", "Private channel")],
                ["03", t("استلام وأولوية", "Claim and priority")],
                ["04", t("إغلاق وترانسكربت HTML", "Close and HTML transcript")],
              ].map(([number, label]) => <div key={number} className="flex items-center gap-3 rounded-xl bg-background/25 px-3 py-2.5"><span className="text-xs font-black text-primary">{number}</span><span className="text-sm font-semibold text-muted-foreground">{label}</span></div>)}
            </div>
          </Card>
          <Card className="glow-panel border-primary/20 bg-primary/5 p-5"><PanelTitle icon={Shield} title={t("مهم", "Important")} /><p className="mt-4 text-sm leading-7 text-muted-foreground">{t("اختر قناة اللوحة ثم اضغط انشر في Discord. البوت سينشئ القنوات الخاصة ويقرأ الإعدادات من قاعدة البيانات نفسها.", "Choose a panel channel, then publish to Discord. The bot creates private channels and reads the same database settings.")}</p></Card>
          <Card className="glow-panel p-5"><PanelTitle icon={Activity} title={t("نشاط التذاكر", "Ticket activity")} /><div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-xl bg-background/30 p-3"><p className="text-2xl font-black text-foreground">{openTickets}</p><p className="mt-1 text-xs text-muted-foreground">{t("مفتوحة", "Open")}</p></div><div className="rounded-xl bg-background/30 p-3"><p className="text-2xl font-black text-foreground">{tickets.data?.length ?? 0}</p><p className="mt-1 text-xs text-muted-foreground">{t("كل التذاكر", "All tickets")}</p></div></div><div className="mt-4 space-y-2">{(tickets.data ?? []).slice(0, 4).map((item) => <div key={String(item.id)} className="flex items-center justify-between gap-3 rounded-xl bg-background/20 px-3 py-2"><span className="truncate text-xs font-semibold text-muted-foreground">{String(item.name ?? "ticket")}</span><Badge variant="secondary" className={item.enabled === false ? "text-muted-foreground" : "bg-success/10 text-success"}>{item.enabled === false ? t("مغلقة", "Closed") : t("مفتوحة", "Open")}</Badge></div>)}</div></Card>
        </aside>
      </div>
    </div>
  );
}

function CommandsModulePage({
  guildId,
  workspace,
}: {
  guildId: string;
  workspace: GuildWorkspace;
}) {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const current = workspace.modules?.["commands"];
  const [enabled, setEnabled] = useState(Boolean(current?.enabled));
  const [config, setConfig] = useState<Record<string, unknown>>(
    current?.config ?? MODULE_DEFAULTS.commands,
  );
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CommandCategory | "all">("all");
  const hydrated = useRef(false);

  useEffect(() => {
    hydrated.current = false;
    setEnabled(Boolean(current?.enabled));
    setConfig(current?.config ?? MODULE_DEFAULTS.commands);
    const timer = window.setTimeout(() => {
      hydrated.current = true;
    }, 0);
    return () => window.clearTimeout(timer);
  }, [current]);

  const save = useMutation({
    mutationFn: () => saveModule({ data: { guildId, module: "commands", enabled, config } }),
    onSuccess: () => {
      toast.success(t("تم حفظ إعدادات الأوامر", "Command settings saved"));
      qc.invalidateQueries({ queryKey: ["workspace", guildId] });
    },
    onError: () => toast.error(t("تعذر حفظ إعدادات الأوامر", "Could not save command settings")),
  });

  useEffect(() => {
    if (!hydrated.current) return;
    const timer = window.setTimeout(() => save.mutate(), 550);
    return () => window.clearTimeout(timer);
  }, [enabled, config]);

  const rawDisabled = config["disabled"];
  const disabled = Array.isArray(rawDisabled)
    ? rawDisabled.filter((item): item is string => typeof item === "string")
    : [];
  const rawColorRoleIds = config["colorRoleIds"];
  const colorRoleIds = Array.isArray(rawColorRoleIds)
    ? rawColorRoleIds.filter((item): item is string => typeof item === "string")
    : [];
  const colorRoles = (workspace.roles ?? [])
    .filter((role) => !role.managed && Number(role.color ?? 0) > 0)
    .sort((a, b) => Number(b.color ?? 0) - Number(a.color ?? 0));
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return COMMAND_CATALOG.filter((command) => {
      const matchesCategory = category === "all" || command.category === category;
      const matchesQuery = !normalized || `${command.name} ${command.description}`.toLowerCase().includes(normalized);
      return matchesCategory && matchesQuery;
    });
  }, [category, query]);
  const categoryLabels: Record<CommandCategory | "all", [string, string]> = {
    all: ["الكل", "All"],
    general: ["عام", "General"],
    info: ["معلومات", "Info"],
    leveling: ["الليفل", "Leveling"],
    moderation: ["الإشراف", "Moderation"],
  };
  const categories = Object.keys(categoryLabels) as Array<CommandCategory | "all">;

  function setCommandEnabled(name: string, nextEnabled: boolean) {
    const nextDisabled = nextEnabled
      ? disabled.filter((item) => item !== name)
      : Array.from(new Set([...disabled, name]));
    setConfig({ ...config, disabled: nextDisabled });
  }

  function setColorRoleEnabled(roleId: string, nextEnabled: boolean) {
    const nextIds = nextEnabled
      ? Array.from(new Set([...colorRoleIds, roleId])).slice(0, 50)
      : colorRoleIds.filter((item) => item !== roleId);
    setConfig({ ...config, colorRoleIds: nextIds });
  }

  return (
    <div className="space-y-6">
      <SectionHero
        icon={Command}
        title={t("إدارة الأوامر", "Command Center")}
        description={t(
          "فعّل أو عطّل كل أمر من أوامر Glow لهذا السيرفر. كل حالة تُحفظ بشكل مستقل في قاعدة البيانات.",
          "Enable or disable every Glow command for this server. Each state is stored independently in the database.",
        )}
        enabled={enabled}
        onEnabledChange={setEnabled}
      />
      <Card className="glow-panel overflow-hidden p-5 sm:p-6">
        <div className="flex flex-col gap-5 border-b border-border/50 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">{t("كتالوج كامل", "Full catalog")}</p>
            <h2 className="mt-2 text-xl font-bold text-foreground">{t("أوامر السيرفر", "Server commands")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t(`${COMMAND_CATALOG.length} أمر · ${disabled.length} معطل`, `${COMMAND_CATALOG.length} commands · ${disabled.length} disabled`)}
            </p>
          </div>
          <div className="relative w-full lg:max-w-xs">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("ابحث في الأوامر…", "Search commands…")} className="h-11 rounded-xl ps-9" />
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {categories.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCategory(item)}
              className={`rounded-xl border px-3.5 py-2 text-xs font-bold transition-[background-color,border-color,color,transform] duration-200 active:scale-[0.97] ${category === item ? "border-primary/45 bg-primary/15 text-primary" : "border-border/60 bg-background/30 text-muted-foreground hover:-translate-y-0.5 hover:border-primary/30 hover:text-foreground"}`}
            >
              {t(categoryLabels[item][0], categoryLabels[item][1])}
              <span className="ms-1.5 opacity-60">{item === "all" ? COMMAND_CATALOG.length : COMMAND_CATALOG.filter((command) => command.category === item).length}</span>
            </button>
          ))}
        </div>
        <Card className="mt-5 border-primary/15 bg-gradient-to-r from-primary/5 via-background/20 to-accent/5 p-4">
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">{t("تخصيص سريع", "Quick customization")}</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{t("الأوامر التي تحتاج إعداداً خاصاً", "Commands with dedicated setup")}</p>
            </div>
            <span className="text-xs text-muted-foreground">{t("اضبط النظام ثم فعّل الأمر من الأعلى", "Configure the system, then enable its command above")}</span>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["moderation", Ban, t("أدوات الإشراف", "Moderation tools")],
              ["automod", Shield, t("قواعد AutoMod", "AutoMod rules")],
              ["logging", FileText, t("اللوقات", "Advanced logs")],
              ["leveling", Trophy, t("الليفل والمكافآت", "Levels & rewards")],
              ["tickets", Ticket, t("التذاكر", "Ticket workflow")],
              ["messageguard", MessageSquareOff, t("حارس الرسائل", "Message Guard")],
            ].map(([section, Icon, label]) => (
              <Button key={String(section)} asChild variant="outline" size="sm" className="justify-start gap-2.5 bg-background/25 text-start">
                <Link to="/dashboard/$guildId/$section" params={{ guildId, section: String(section) }}>
                  {typeof Icon === "function" ? <Icon className="size-4 text-primary" /> : null}
                  <span>{String(label)}</span>
                </Link>
              </Button>
            ))}
          </div>
          <div className="mt-4 rounded-2xl border border-border/50 bg-background/20 p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold text-foreground">{t("لوحة رتب الألوان", "Color-role palette")}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("اختر الرتب التي يديرها /color-set فقط. لن يزيل Glow أي رتبة خارج هذه القائمة.", "Choose only the roles managed by /color-set. Glow will never remove roles outside this list.")}</p>
              </div>
              <Badge variant="secondary" className="w-fit text-[10px]">{colorRoleIds.length}/50</Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {colorRoles.slice(0, 50).map((role) => {
                const selected = colorRoleIds.includes(role.id);
                const color = `#${Number(role.color ?? 0).toString(16).padStart(6, "0")}`;
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setColorRoleEnabled(role.id, !selected)}
                    className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition duration-200 active:scale-[0.97] ${selected ? "border-primary/50 bg-primary/12 text-foreground" : "border-border/60 bg-background/30 text-muted-foreground hover:border-primary/30 hover:text-foreground"}`}
                  >
                    <span className="size-2.5 rounded-full ring-2 ring-background" style={{ backgroundColor: color }} />
                    {role.name}
                    {selected ? <Check className="size-3.5 text-primary" /> : null}
                  </button>
                );
              })}
              {colorRoles.length === 0 ? <span className="text-xs text-muted-foreground">{t("لا توجد رتب ألوان قابلة للإدارة.", "No manageable color roles found.")}</span> : null}
            </div>
          </div>
        </Card>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {filtered.map((command) => {
            const live = command.supported;
            const active = live && !disabled.includes(command.name);
            return (
              <div key={command.name} className={`flex min-h-[5.75rem] items-center gap-3 rounded-2xl border p-4 transition duration-200 ${active ? "border-border/60 bg-background/25 hover:border-primary/35" : "border-border/40 bg-background/10 opacity-75"}`}>
                <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${live ? "bg-primary/12 text-primary" : "bg-muted/60 text-muted-foreground"}`}><Command className="size-4" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><code className="text-sm font-bold text-foreground">/{command.name}</code>{live ? <Badge variant="secondary" className="bg-success/10 text-[10px] text-success">{t("شغال", "Live")}</Badge> : <Badge variant="secondary" className="text-[10px]">{t("قريباً", "Planned")}</Badge>}</div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{lang === "ar" ? command.description : COMMAND_ENGLISH[command.name] ?? "Server command"}</p>
                </div>
                {live && <Switch checked={active} onCheckedChange={(value) => setCommandEnabled(command.name, value)} aria-label={`${command.name} enabled`} />}
              </div>
            );
          })}
        </div>
        {filtered.length === 0 && <p className="py-12 text-center text-sm text-muted-foreground">{t("لا توجد أوامر مطابقة.", "No matching commands.")}</p>}
      </Card>
    </div>
  );
}

function MessageGuardPage({
  guildId,
  workspace,
}: {
  guildId: string;
  workspace: GuildWorkspace;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const current = workspace.modules?.["messageguard"];
  const currentConfig = current?.config ?? MODULE_DEFAULTS.messageguard;
  const [enabled, setEnabled] = useState(Boolean(current?.enabled));
  const [channelName, setChannelName] = useState(String(currentConfig["channelName"] ?? "mrbeast-guard"));
  const [categoryId, setCategoryId] = useState(String(currentConfig["categoryId"] ?? ""));
  const [punishment, setPunishment] = useState<"kick" | "ban">(
    currentConfig["punishment"] === "ban" ? "ban" : "kick",
  );
  const hydrated = useRef(false);
  const categories = (workspace.channels ?? []).filter((channel) => channel.type === 4);
  const configuredChannelId = String(currentConfig["channelId"] ?? "");
  const punishmentCount = Math.max(0, Number(currentConfig["punishmentCount"] ?? 0) || 0);

  useEffect(() => {
    hydrated.current = false;
    setEnabled(Boolean(current?.enabled));
    setChannelName(String(currentConfig["channelName"] ?? "mrbeast-guard"));
    setCategoryId(String(currentConfig["categoryId"] ?? ""));
    setPunishment(currentConfig["punishment"] === "ban" ? "ban" : "kick");
    const timer = window.setTimeout(() => {
      hydrated.current = true;
    }, 0);
    return () => window.clearTimeout(timer);
  }, [current]);

  const save = useMutation({
    mutationFn: async () => {
      if (!enabled) {
        return saveModule({
          data: {
            guildId,
            module: "messageguard",
            enabled: false,
            config: {
              ...currentConfig,
              channelName,
              categoryId,
              punishment,
            },
          },
        });
      }
      return provisionMessageGuard({ data: { guildId, channelName, categoryId, punishment } });
    },
    onSuccess: () => {
      toast.success(t("تم إنشاء وحفظ حارس الرسائل", "Message Guard was created and saved"));
      qc.invalidateQueries({ queryKey: ["workspace", guildId] });
      qc.invalidateQueries({ queryKey: ["overview", guildId] });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("INVALID_CATEGORY")) {
        toast.error(t("الكاتجوري غير موجودة أو ليست كاتجوري في هذا السيرفر", "That category is no longer available in this server"));
      } else if (message.includes("BOT_NOT_IN_GUILD")) {
        toast.error(t("أضف البوت إلى السيرفر أولاً", "Invite Glow to this server first"));
      } else {
        toast.error(t("تعذر إنشاء الروم. تأكد من صلاحيات البوت", "Could not create the room. Check the bot permissions"));
      }
    },
  });

  return (
    <div className="space-y-6">
      <SectionHero
        icon={MessageSquareOff}
        title={t("حارس رسائل MrBeast", "MrBeast Message Guard")}
        description={t(
          "أنشئ رومًا خاصًا لمنع رسائل MrBeast أو أي محتوى تختاره، مع حذف الرسالة وتطبيق طرد أو باند تلقائيًا.",
          "Create a protected room for MrBeast messages or any content you choose, deleting messages and applying an automatic kick or ban.",
        )}
        enabled={enabled}
        onEnabledChange={setEnabled}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="glow-panel overflow-hidden p-5 sm:p-6">
          <div className="flex flex-col gap-4 border-b border-border/50 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">{t("إنشاء وحفظ", "Create & save")}</p>
              <h2 className="mt-2 text-xl font-bold text-foreground">{t("إعداد الروم المحمي", "Protected room setup")}</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {t("اختر الاسم والكاتجوري والعقوبة، ثم اضغط إنشاء وحفظ ليتم إنشاء الروم داخل Discord.", "Choose the name, category and punishment, then create and save the room inside Discord.")}
              </p>
            </div>
            <Button onClick={() => save.mutate()} disabled={save.isPending} className="shrink-0 gap-2">
              {save.isPending ? <RefreshCw className="size-4 animate-spin" /> : <Save className="size-4" />}
              {save.isPending ? t("جاري الإنشاء…", "Creating…") : t("إنشاء وحفظ", "Create & save")}
            </Button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">{t("اسم الروم", "Room name")}</Label>
              <Input value={channelName} onChange={(event) => setChannelName(event.target.value)} maxLength={90} placeholder="mrbeast-guard" />
              <p className="text-[11px] leading-5 text-muted-foreground">{t("سيُنظّف الاسم تلقائيًا إلى صيغة مناسبة لرومات Discord.", "The name is normalized into a Discord-safe channel name.")}</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">{t("الكاتجوري", "Category")}</Label>
              <Select value={categoryId || "__none"} onValueChange={(value) => setCategoryId(value === "__none" ? "" : value)}>
                <SelectTrigger><SelectValue placeholder={t("اختر الكاتجوري", "Choose a category")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">{t("بدون كاتجوري", "No category")}</SelectItem>
                  {categories.map((category) => <SelectItem key={category.id} value={category.id}>📁 {category.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-[11px] leading-5 text-muted-foreground">{categories.length === 0 ? t("لم توجد كاتجوريات متاحة في هذا السيرفر.", "No categories were found in this server.") : t("تظهر هنا الكاتجوريات فقط، وليس الرومات العادية.", "Only categories from this server appear here.")}</p>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs font-semibold text-muted-foreground">{t("الإجراء عند إرسال رسالة", "Action when a message is sent")}</Label>
              <Select value={punishment} onValueChange={(value) => setPunishment(value === "ban" ? "ban" : "kick")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="kick">👢 {t("طرد العضو مباشرة", "Kick the member immediately")}</SelectItem>
                  <SelectItem value="ban">🔨 {t("حظر العضو مباشرة", "Ban the member immediately")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm leading-6 text-muted-foreground">
            <p className="font-semibold text-foreground">{t("كيف يعمل النظام؟", "How it works")}</p>
            <p className="mt-1">{t("الروم يبقى مفتوحًا للجميع، لكن أي رسالة تُحذف فورًا وتُطبق العقوبة المحددة. أما الرياكتات فتُحذف تلقائيًا ولا يستطيع الأعضاء الاحتفاظ بها.", "The room stays visible to everyone, but every message is deleted immediately and the selected punishment is applied. Reactions are also removed automatically.")}</p>
          </div>

          <div className="mt-5 rounded-2xl border border-border/60 bg-background/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2"><span className={`size-2.5 rounded-full ${configuredChannelId ? "bg-success" : "bg-muted-foreground"}`} /><span className="text-sm font-semibold text-foreground">{configuredChannelId ? t("الروم متصل ومحفوظ", "Room connected and saved") : t("لم يتم إنشاء روم بعد", "No room created yet")}</span></div>
              <Badge variant="secondary">{t(`${punishmentCount} عقوبة`, `${punishmentCount} penalties`)}</Badge>
            </div>
            {configuredChannelId && <p className="mt-2 text-xs text-muted-foreground">{t("سيستمر الإعداد بعد إعادة تشغيل البوت لأنه محفوظ في قاعدة البيانات.", "The setup survives bot restarts because it is stored in the database.")}</p>}
          </div>
        </Card>

        <aside className="space-y-5">
          <Card className="glow-panel overflow-hidden p-0">
            <img src="/message-guard-reference.png" alt={t("صورة نظام حارس الرسائل", "Message Guard visual")} className="aspect-[16/10] w-full object-cover opacity-80" />
            <div className="p-5">
              <PanelTitle icon={MessageSquareOff} title={t("واجهة النظام", "System visual")} />
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{t("سيضع البوت رسالة Embed عربية وإنجليزية داخل الروم، وبداخلها عدد الأشخاص الذين عوقبوا.", "Glow posts a bilingual Arabic and English embed inside the room with the number of punished members.")}</p>
            </div>
          </Card>
          <Card className="glow-panel border-primary/20 bg-primary/5 p-5">
            <PanelTitle icon={Shield} title={t("صلاحيات مطلوبة", "Required permissions")} />
            <div className="mt-4 space-y-2 text-sm leading-6 text-muted-foreground">
              <p>✅ {t("إدارة الرومات لإنشاء الروم ونقله", "Manage Channels to create and move the room")}</p>
              <p>✅ {t("إدارة الرسائل لحذف الرسائل والرياكتات", "Manage Messages to remove messages and reactions")}</p>
              <p>✅ {t("طرد الأعضاء أو حظرهم حسب اختيارك", "Kick Members or Ban Members based on your choice")}</p>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
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
  const hydrated = useRef(false);

  useEffect(() => {
    hydrated.current = false;
    setEnabled(Boolean(current?.enabled));
    setConfig(current?.config ?? MODULE_DEFAULTS[moduleKey]);
    const timer = window.setTimeout(() => {
      hydrated.current = true;
    }, 0);
    return () => window.clearTimeout(timer);
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

  useEffect(() => {
    if (!hydrated.current) return;
    const timer = window.setTimeout(() => {
      save.mutate();
    }, 700);
    return () => window.clearTimeout(timer);
  }, [enabled, config, moduleKey]);

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
            moduleKey === "tempvoice" ||
            moduleKey === "customcommands") && <ItemManager guildId={guildId} kind={moduleKey} />}
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
    kind: "autoreply" | "autointeraction" | "tempvoice" | "customcommands";
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
  const toggleItem = useMutation({
    mutationFn: ({ item, enabled }: { item: GuildItem; enabled: boolean }) =>
      saveItem({
        data: item.id
          ? {
              guildId,
              kind,
              id: item.id,
              name: String(item.name ?? "Glow item"),
              enabled,
              data: item.data ?? {},
            }
          : {
              guildId,
              kind,
              name: String(item.name ?? "Glow item"),
              enabled,
              data: item.data ?? {},
            },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["items", guildId, kind] }),
    onError: () => toast.error(t("تعذر تحديث حالة العنصر", "Could not update item status")),
  });

  const title =
    kind === "autoreply"
      ? t("ردود مخصصة", "Custom replies")
      : kind === "autointeraction"
        ? t("تفاعلات مخصصة", "Custom interactions")
        : kind === "customcommands"
          ? t("أوامر مخصصة", "Custom commands")
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
              : kind === "customcommands"
                ? t("اسم الأمر مثل rules", "Command name such as rules")
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
              <Switch
                checked={item.enabled !== false}
                onCheckedChange={(checked) => toggleItem.mutate({ item, enabled: checked })}
                aria-label={t("تفعيل العنصر", "Enable item")}
              />
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

function ScammersPage({ guildId }: { guildId: string }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [reportedUserId, setReportedUserId] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [reportIndex, setReportIndex] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const previewUrls = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);
  const meta = SECTION_META.scammers;
  const directory = useQuery<ScammerDirectoryEntry[]>({
    queryKey: ["scammer-directory", guildId, search],
    queryFn: async () =>
      (await getScammerDirectory({ data: { guildId, query: search } })) as unknown as ScammerDirectoryEntry[],
  });
  const reports = useQuery<ScammerReport[]>({
    queryKey: ["scammer-reports", guildId, selectedUserId],
    enabled: Boolean(selectedUserId),
    queryFn: async () =>
      (await getScammerReports({ data: { guildId, reportedUserId: selectedUserId! } })) as unknown as ScammerReport[],
  });
  const submit = useMutation({
    mutationFn: async () => {
      const evidenceKeys: string[] = [];
      for (const file of files) {
        const form = new FormData();
        form.append("guildId", guildId);
        form.append("files", file, file.name);
        const response = await fetch("/api/public/scam-reports/upload", { method: "POST", body: form });
        const body = (await response.json()) as { ok?: boolean; file?: { key: string }; error?: string };
        if (!response.ok || !body.file?.key) throw new Error(body.error ?? "UPLOAD_FAILED");
        evidenceKeys.push(body.file.key);
      }
      return submitScamReport({
        data: { guildId, reportedUserId: reportedUserId.trim(), description: description.trim(), evidenceKeys },
      });
    },
    onMutate: () => setSubmitted(false),
    onSuccess: (result) => {
      setSubmitted(true);
      setReportedUserId("");
      setDescription("");
      setFiles([]);
      toast.success(
        result.reviewQueued
          ? t("تم إرسال البلاغ للمراجعة", "Report sent for review")
          : t("تم حفظ البلاغ لكن تعذر إرساله للمراجعة", "Report saved, but review delivery failed"),
      );
      void qc.invalidateQueries({ queryKey: ["scammer-directory", guildId] });
    },
    onError: (error: Error) => toast.error(error.message === "FORBIDDEN" ? t("لا تملك صلاحية هذا السيرفر", "You cannot manage this server") : t("تعذر تقديم البلاغ", "Could not submit the report")),
  });

  useEffect(() => {
    return () => previewUrls.forEach((url) => URL.revokeObjectURL(url));
  }, [previewUrls]);
  useEffect(() => setReportIndex(0), [selectedUserId]);

  const addFiles = (incoming: File[]) => {
    const images = incoming.filter((file) => ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.type));
    const tooLarge = incoming.some((file) => file.size > 5 * 1024 * 1024);
    if (tooLarge) toast.error(t("حجم كل صورة يجب ألا يتجاوز 5MB", "Each image must be 5MB or smaller"));
    if (images.length !== incoming.length && incoming.length > 0) toast.error(t("يسمح برفع صور JPG أو PNG أو GIF أو WEBP فقط", "Only JPG, PNG, GIF or WEBP images are allowed"));
    setFiles((current) => [...current, ...images.filter((file) => file.size <= 5 * 1024 * 1024)].slice(0, 5));
  };
  const currentReport = reports.data?.[reportIndex];

  return (
    <div className="space-y-6">
      <SectionHero icon={meta.icon} title={t(meta.title, meta.en)} description={t(meta.description, meta.enDescription)} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
        <Card className="glow-panel relative overflow-hidden p-5 sm:p-6">
          <div className="pointer-events-none absolute -end-20 -top-24 size-64 rounded-full bg-destructive/10 blur-3xl" />
          <PanelTitle
            icon={AlertTriangle}
            title={t("رفع بلاغ جديد", "Submit a scam report")}
            description={t("كل بلاغ يمر على مراجعة الإدارة قبل أن يظهر في القائمة.", "Every report is reviewed by administrators before it appears in the directory.")}
          />
          <div className="relative mt-6 space-y-5" onPaste={(event) => addFiles(Array.from(event.clipboardData.files))}>
            <div className="space-y-2">
              <Label htmlFor="reported-user-id">{t("معرّف الشخص النصاب", "Scammer Discord ID")}</Label>
              <Input id="reported-user-id" value={reportedUserId} onChange={(event) => setReportedUserId(event.target.value.replace(/[^0-9]/g, "").slice(0, 20))} placeholder="123456789012345678" inputMode="numeric" maxLength={20} />
              <p className="text-xs text-muted-foreground">{t("انسخ User ID من Discord، وليس الاسم أو المنشن.", "Copy the Discord User ID, not the username or mention.")}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="scam-description">{t("شرح الواقعة", "What happened?")}</Label>
              <Textarea id="scam-description" value={description} onChange={(event) => setDescription(event.target.value.slice(0, 5000))} placeholder={t("اشرح ما حدث بالتفصيل وأضف التواريخ والروابط المهمة…", "Explain what happened and include dates or relevant links…")} rows={7} maxLength={5000} />
              <div className="flex justify-end text-xs text-muted-foreground">{description.length}/5000</div>
            </div>
            <div className="space-y-2">
              <Label>{t("الأدلة والصور", "Evidence images")}</Label>
              <div
                className="group cursor-pointer rounded-2xl border border-dashed border-primary/35 bg-primary/5 p-6 text-center transition hover:border-primary/70 hover:bg-primary/10"
                onClick={() => inputRef.current?.click()}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => { event.preventDefault(); addFiles(Array.from(event.dataTransfer.files)); }}
              >
                <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" multiple className="sr-only" onChange={(event) => { addFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
                <ImagePlus className="mx-auto size-9 text-primary transition group-hover:scale-110" />
                <p className="mt-3 text-sm font-semibold text-foreground">{t("اضغط أو اسحب الصور هنا", "Click or drop images here")}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t("يمكنك أيضاً لصق الصورة مباشرة. حتى 5 صور، 5MB للصورة.", "You can also paste an image. Up to 5 images, 5MB each.")}</p>
              </div>
              {files.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {files.map((file, index) => (
                    <div key={`${file.name}-${file.lastModified}-${index}`} className="group relative overflow-hidden rounded-xl border border-border/60 bg-background/30">
                      <img src={previewUrls[index]} alt={file.name} className="aspect-video w-full object-cover" />
                      <button type="button" onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))} className="absolute end-2 top-2 rounded-lg bg-background/85 p-1.5 text-destructive opacity-0 shadow transition group-hover:opacity-100" aria-label={t("حذف الصورة", "Remove image")}><Trash2 className="size-4" /></button>
                      <p className="truncate px-2 py-1.5 text-[11px] text-muted-foreground">{file.name}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Button type="button" onClick={() => submit.mutate()} disabled={submit.isPending || reportedUserId.length < 15 || description.trim().length < 20} className="w-full gap-2 bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-[0_14px_28px_-16px_hsl(var(--primary))] hover:brightness-110">
              {submit.isPending ? <RefreshCw className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {submit.isPending ? t("جاري رفع الأدلة…", "Uploading evidence…") : t("تقديم البلاغ للمراجعة", "Submit for review")}
            </Button>
            {(submitted || submit.isError) && (
              <div className={`rounded-2xl border p-4 ${submitted ? "border-success/35 bg-success/10 text-success" : "border-destructive/35 bg-destructive/10 text-destructive"} ${submitted ? "animate-report-success" : ""}`}>
                <div className="flex items-start gap-3">
                  {submitted ? <Check className="mt-0.5 size-5 shrink-0" /> : <AlertTriangle className="mt-0.5 size-5 shrink-0" />}
                  <p className="text-sm leading-6">{submitted ? t("تم استلام البلاغ وسيتم فحصه من إدارة Glow قبل نشره.", "Your report was received and will be checked by Glow administrators before publication.") : t("لم يكتمل الإرسال. راجع البيانات وحاول مرة أخرى.", "The submission did not complete. Check the details and try again.")}</p>
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card className="glow-panel p-5 sm:p-6">
          <PanelTitle icon={Search} title={t("قائمة النصابين", "Scammer directory")} description={t("تظهر هنا الحسابات التي اعتمدتها الإدارة فقط.", "Only administrator-approved accounts appear here.")} action={<Button variant="outline" size="icon" onClick={() => directory.refetch()} aria-label={t("تحديث", "Refresh")}><RefreshCw className={`size-4 ${directory.isFetching ? "animate-spin" : ""}`} /></Button>} />
          <div className="relative mt-5">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("ابحث بالاسم أو Discord ID…", "Search name or Discord ID…")} className="ps-9" />
          </div>
          <div className="mt-4 space-y-2">
            {directory.isLoading && <Skeleton className="h-24" />}
            {(directory.data ?? []).map((item) => (
              <div key={item.reportedUserId} className={`flex items-center gap-3 rounded-2xl border p-3 text-start transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5 ${selectedUserId === item.reportedUserId ? "border-primary/50 bg-primary/10" : "border-border/50 bg-background/20"}`}>
                {item.avatar ? <img src={item.avatar} alt="" className="size-11 rounded-full border border-primary/25 object-cover" /> : <span className="flex size-11 items-center justify-center rounded-full bg-primary/15 font-bold text-primary">{item.username.slice(0, 1).toUpperCase()}</span>}
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-foreground">{item.username}</span><span className="mt-1 block truncate font-mono text-[11px] text-muted-foreground">{item.reportedUserId}</span></span>
                <span className="shrink-0 rounded-lg bg-destructive/10 px-2 py-1 text-xs font-bold text-destructive">{item.reportCount} {t("بلاغ", "reports")}</span>
                <Button type="button" variant="outline" size="sm" onClick={() => setSelectedUserId(item.reportedUserId)} className="shrink-0 gap-1.5">
                  <FileText className="size-3.5" />
                  {t("عرض النصاب", "View scammer")}
                </Button>
              </div>
            ))}
            {!directory.isLoading && (directory.data ?? []).length === 0 && <EmptyState icon={Shield} title={t("لا توجد نتائج معتمدة", "No approved scammers found")} />}
          </div>
        </Card>
      </div>

      {selectedUserId && (
        <Card className="glow-panel overflow-hidden p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <PanelTitle icon={FileText} title={t("بلاغات الحساب", "Reports for this account")} description={selectedUserId} />
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setReportIndex((index) => Math.max(0, index - 1))} disabled={reportIndex === 0 || reports.isLoading} aria-label={t("السابق", "Previous")}><ChevronLeft className="size-4" /></Button>
              <span className="min-w-16 text-center text-xs text-muted-foreground">{reports.data?.length ? `${reportIndex + 1} / ${reports.data.length}` : "—"}</span>
              <Button variant="outline" size="icon" onClick={() => setReportIndex((index) => Math.min((reports.data?.length ?? 1) - 1, index + 1))} disabled={reports.isLoading || !reports.data || reportIndex >= reports.data.length - 1} aria-label={t("التالي", "Next")}><ChevronRight className="size-4" /></Button>
            </div>
          </div>
          {reports.isLoading && <Skeleton className="mt-5 h-56" />}
          {currentReport && (
            <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.72fr)]">
              <div className="rounded-2xl border border-border/50 bg-background/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3"><Badge className="bg-success/15 text-success hover:bg-success/15">{t("بلاغ معتمد", "Approved report")}</Badge><span className="text-xs text-muted-foreground">{formatDate(currentReport.createdAt)}</span></div>
                <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-foreground/85">{currentReport.description}</p>
                <p className="mt-4 text-xs text-muted-foreground">{t("مقدم البلاغ", "Reported by")}: {currentReport.reporterName ?? t("عضو", "Member")}</p>
                {currentReport.roleAssigned ? <p className="mt-2 text-xs text-success">{t("تمت إضافة رول النصاب عند الاعتماد.", "Scammer role was assigned on approval.")}</p> : currentReport.roleAssignmentError && <p className="mt-2 text-xs text-warning">{currentReport.roleAssignmentError}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {currentReport.evidence.map((evidence) => <a key={evidence.key} href={evidence.url} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-xl border border-border/50 bg-background/20"><img src={evidence.url} alt={evidence.name} className="aspect-video w-full object-cover transition duration-200 group-hover:scale-105" /></a>)}
                {currentReport.evidence.length === 0 && <div className="col-span-2 flex min-h-32 items-center justify-center rounded-xl border border-dashed border-border/60 text-center text-xs text-muted-foreground">{t("لا توجد صور مرفقة", "No image evidence attached")}</div>}
              </div>
            </div>
          )}
          {!reports.isLoading && !currentReport && <EmptyState icon={FileText} title={t("لا توجد بلاغات لهذا الحساب", "No reports for this account")} />}
        </Card>
      )}
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

function ticketPublishError(error: unknown, t: (arabic: string, english: string) => string) {
  const raw = error instanceof Error ? error.message : String(error);
  const code = raw.match(/TICKET_[A-Z0-9_]+|BOT_[A-Z0-9_]+|UNAUTHENTICATED|FORBIDDEN/)?.[0] ?? raw;
  const messages: Record<string, [string, string]> = {
    UNAUTHENTICATED: ["انتهت جلسة Discord. سجّل الدخول من جديد ثم حاول.", "Your Discord session expired. Sign in again and retry."],
    FORBIDDEN: ["لا تملك صلاحية إدارة هذا السيرفر.", "You do not have permission to manage this server."],
    BOT_NOT_IN_GUILD: ["البوت غير موجود في هذا السيرفر. أضفه أولاً ثم أعد المحاولة.", "Glow is not in this server. Add the bot first, then retry."],
    TICKET_PANEL_CHANNEL_REQUIRED: ["اختر قناة لوحة التذاكر أولاً.", "Choose a ticket panel channel first."],
    TICKET_PANEL_DISABLED: ["نظام التذاكر أو لوحة النشر معطل لهذا السيرفر.", "Tickets or the panel are disabled for this server."],
    TICKET_PANEL_CHANNEL_NOT_FOUND: ["قناة لوحة التذاكر غير موجودة أو تم حذفها. اختر قناة جديدة.", "The panel channel was deleted or cannot be found. Choose another channel."],
    TICKET_PANEL_CHANNEL_FORBIDDEN: ["البوت لا يستطيع قراءة قناة اللوحة. تحقق من صلاحية View Channel.", "Glow cannot read the panel channel. Check its View Channel permission."],
    TICKET_PANEL_CHANNEL_WRONG_GUILD: ["القناة المختارة ليست من نفس السيرفر.", "The selected channel belongs to a different server."],
    TICKET_PANEL_CHANNEL_NOT_TEXT: ["اختر قناة نصية أو قناة إعلانات، وليس تصنيفاً أو قناة صوتية.", "Choose a text or announcement channel, not a category or voice channel."],
    TICKET_PANEL_BOT_UNAUTHORIZED: ["توكن البوت غير صالح حالياً. تحقق من إعدادات Railway.", "The bot token was rejected. Check the Railway bot environment variables."],
    TICKET_PANEL_BOT_MISSING_PERMISSIONS: ["البوت لا يملك صلاحية إرسال الرسائل أو التضمينات في هذه القناة.", "Glow is missing permission to send messages or embeds in this channel."],
  };
  const known = messages[code];
  if (known) return t(known[0], known[1]);
  return t("تعذر نشر لوحة التذاكر. تحقق من القناة وصلاحيات البوت ثم حاول مرة أخرى.", `Could not publish the ticket panel${raw && raw !== "Error" ? `: ${raw.slice(0, 120)}` : "."}`);
}
