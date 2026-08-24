import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowUpRight,
  BarChart3,
  Bot,
  Check,
  CircleCheck,
  Command,
  Gauge,
  Layers3,
  MessageSquareHeart,
  Mic,
  Rocket,
  Shield,
  Sparkles,
  Users,
  Webhook,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TopBar } from "@/components/glow/shell";
import logo from "@/assets/glow-brand-mark.png";
import heroBackground from "@/assets/glow-landing-hero.jpg";
import dashboardPreview from "@/assets/glow-dashboard-preview.jpg";
import communityPreview from "@/assets/glow-community-preview.jpg";
import { useI18n } from "@/lib/i18n";
import { SLASH_COMMANDS } from "@/lib/slash-commands";
import { SUPPORT_SERVER_URL, botInviteUrl } from "@/lib/discord";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Glow — Discord Community Control Center" },
      {
        name: "description",
        content:
          "Glow is a calmer, clearer control center for Discord communities, with protection, automation, engagement and useful server insights.",
      },
      { property: "og:title", content: "Glow — Discord Community Control Center" },
      {
        property: "og:description",
        content: "A calmer, clearer control center for every Discord community.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const featureCards = [
  {
    icon: Shield,
    ar: "احمِ مساحتك",
    en: "Protect your space",
    dar: "حماية من السبام والروابط والتخريب مع قرارات واضحة لفريق الإشراف.",
    den: "Handle spam, links and destructive activity with clear decisions for your staff.",
    tone: "from-cyan-400/18 via-blue-500/5 to-transparent",
  },
  {
    icon: Sparkles,
    ar: "حرّك مجتمعك",
    en: "Move your community",
    dar: "لفلات، اقتراحات، ردود وتفاعلات تجعل السيرفر حيّاً بدون تعقيد.",
    den: "Leveling, suggestions, replies and reactions that keep the server alive without the clutter.",
    tone: "from-violet-400/18 via-fuchsia-500/5 to-transparent",
  },
  {
    icon: BarChart3,
    ar: "افهم ما يحدث",
    en: "See what is happening",
    dar: "نظرة مركزة على الأنظمة، الأعضاء، الصدارة، والقرارات المهمة.",
    den: "A focused view of modules, members, leaderboard activity and important decisions.",
    tone: "from-amber-300/18 via-orange-500/5 to-transparent",
  },
];

const systems = [
  {
    icon: Shield,
    ar: "الأمان والإشراف",
    en: "Safety & moderation",
    dar: "AutoMod وحماية من التخريب وسجل واضح لفريقك.",
    den: "AutoMod, anti-nuke protection and a clear staff workflow.",
    tone: "text-cyan-300 bg-cyan-400/10",
  },
  {
    icon: MessageSquareHeart,
    ar: "التفاعل والمجتمع",
    en: "Community engagement",
    dar: "اقتراحات وردود وتفاعلات تحفظ روح السيرفر.",
    den: "Suggestions, replies and reactions that keep your server human.",
    tone: "text-violet-300 bg-violet-400/10",
  },
  {
    icon: Users,
    ar: "الأعضاء والرولات",
    en: "Members & roles",
    dar: "ترحيب، مغادرة، رولات تلقائية، ومعلومات أعضاء مفيدة.",
    den: "Welcome, leave, autoroles and useful member information.",
    tone: "text-emerald-300 bg-emerald-400/10",
  },
  {
    icon: Mic,
    ar: "الصوت والأتمتة",
    en: "Voice & automation",
    dar: "رومات مؤقتة وأوامر مخصصة تعمل من داخل Discord.",
    den: "Temporary voice rooms and custom commands that work inside Discord.",
    tone: "text-amber-300 bg-amber-400/10",
  },
];

const commandDescriptions: Record<string, { ar: string; en: string }> = {
  daily: { ar: "مكافأتك اليومية", en: "Claim your daily reward" },
  balance: { ar: "رصيد Glow والستريك", en: "Glow balance and streak" },
  rank: { ar: "المستوى ونقاط XP", en: "Level and XP progress" },
  leaderboard: { ar: "صدارة السيرفر", en: "Server leaderboard" },
  suggest: { ar: "أرسل اقتراحاً للفريق", en: "Send a suggestion to staff" },
  glow: { ar: "معلومات Glow واللوحة", en: "Glow and dashboard info" },
  profile: { ar: "ملفك الشخصي", en: "Your Glow profile" },
  server: { ar: "معلومات السيرفر", en: "Server information" },
  roles: { ar: "قائمة رولات السيرفر", en: "List server roles" },
  colors: { ar: "ألوان الرولات المتاحة", en: "View available role colors" },
  "points-list": { ar: "قائمة نقاطك", en: "View your points" },
  roll: { ar: "ارم نرداً من ستة", en: "Roll a six-sided die" },
  top: { ar: "أعلى أعضاء السيرفر", en: "Top server members" },
  banner: { ar: "بانر العضو", en: "View a member banner" },
  "server-avatar": { ar: "صورة السيرفر", en: "View the server avatar" },
  "server-banner": { ar: "بانر السيرفر", en: "View the server banner" },
  ping: { ar: "حالة اتصال Glow", en: "Check Glow connectivity" },
  user: { ar: "معلومات عضو", en: "Member information" },
  avatar: { ar: "رابط صورة العضو", en: "Member avatar URL" },
  help: { ar: "قائمة أوامر Glow", en: "Glow command list" },
};

function Landing() {
  const { t, lang } = useI18n();

  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} className="min-h-screen overflow-hidden bg-background">
      <TopBar
        nav
        right={
          <Button asChild size="sm" className="gap-2">
            <a href="/api/public/auth/discord/login">
              <Sparkles className="size-4" />
              {t("دخول بديسكورد", "Login with Discord")}
            </a>
          </Button>
        }
      />

      <main>
        <section className="relative isolate overflow-hidden border-b border-border/40">
          <img
            src={heroBackground}
            alt=""
            className="pointer-events-none absolute inset-0 -z-20 h-full w-full object-cover opacity-75"
          />
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,hsl(var(--background)/0.14)_0%,hsl(var(--background)/0.72)_58%,hsl(var(--background))_100%)]" />
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_22%,hsl(var(--primary)/0.22),transparent_36%)]" />
          <div className="mx-auto w-full max-w-7xl px-4 pb-16 pt-10 sm:px-6 lg:px-8 lg:pb-24 lg:pt-16">
            <div className="mx-auto max-w-4xl text-center">
              <div className="animate-rise-in inline-flex items-center gap-2 rounded-full border border-primary/25 bg-background/50 px-4 py-2 text-xs font-bold tracking-wide text-primary shadow-[0_0_30px_hsl(var(--primary)/0.15)] backdrop-blur-md">
                <span className="size-2 animate-pulse rounded-full bg-primary" />
                {t("مركز التحكم لمجتمعات Discord", "The control center for Discord communities")}
              </div>
              <h1 className="animate-rise-in mt-8 font-display text-5xl font-bold leading-[0.98] tracking-[-0.065em] text-foreground sm:text-7xl lg:text-[6.4rem]" style={{ animationDelay: "80ms" }}>
                {t("خلِّ مجتمعك", "Make your community")}
                <span className="block glow-text">{t("ينبض.", "glow.")}</span>
              </h1>
              <p className="animate-rise-in mx-auto mt-7 max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg" style={{ animationDelay: "150ms" }}>
                {t(
                  "Glow يجمع الحماية، النشاط، الأتمتة والتحليلات في تجربة واحدة مرتبة — من أول تسجيل دخول إلى آخر قرار إشراف.",
                  "Glow brings protection, engagement, automation and insight into one composed experience — from the first sign-in to the latest staff decision.",
                )}
              </p>
              <div className="animate-rise-in mt-9 flex flex-wrap justify-center gap-3" style={{ animationDelay: "220ms" }}>
                <Button asChild size="lg" className="gap-2 px-7">
                  <a href="/api/public/auth/discord/login">
                    {t("افتح لوحة التحكم", "Open the dashboard")}
                    <ArrowUpRight className="size-4" />
                  </a>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <a href={botInviteUrl()} target="_blank" rel="noreferrer">
                    {t("أضف Glow لسيرفرك", "Add Glow to your server")}
                  </a>
                </Button>
              </div>
            </div>

            <div className="animate-rise-in relative mx-auto mt-16 max-w-5xl" style={{ animationDelay: "300ms" }}>
              <div className="pointer-events-none absolute -inset-12 rounded-[4rem] bg-primary/15 blur-3xl" />
              <Card className="relative overflow-hidden rounded-[1.75rem] border-primary/30 bg-background/60 p-2 shadow-[0_34px_110px_-38px_hsl(var(--primary)/0.92)] backdrop-blur-xl sm:p-3">
                <div className="relative overflow-hidden rounded-[1.3rem] border border-white/10 bg-[#070b1c]">
                  <div className="flex h-9 items-center gap-1.5 border-b border-white/10 bg-white/[0.035] px-4">
                    <span className="size-2 rounded-full bg-rose-400/80" />
                    <span className="size-2 rounded-full bg-amber-300/80" />
                    <span className="size-2 rounded-full bg-emerald-300/80" />
                    <div className="mx-auto hidden h-5 w-1/2 rounded-md bg-white/[0.04] sm:block" />
                  </div>
                  <img src={dashboardPreview} alt={t("معاينة لوحة تحكم Glow", "Glow dashboard preview")} className="aspect-[16/8.7] w-full object-cover object-top" />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#070b1c]/80 via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-xl border border-white/15 bg-background/65 px-3 py-2 text-[11px] font-bold text-foreground backdrop-blur-md sm:bottom-6 sm:left-6">
                    <span className="size-2 rounded-full bg-success shadow-[0_0_14px_hsl(var(--success))]" />
                    {t("كل شيء متصل", "Everything is connected")}
                  </div>
                  <div className="absolute bottom-4 right-4 rounded-xl border border-white/15 bg-background/65 px-3 py-2 text-[11px] font-bold text-foreground backdrop-blur-md sm:bottom-6 sm:right-6">
                    <Zap className="me-1 inline size-3.5 text-primary" />
                    {t("قرارات أسرع", "Faster decisions")}
                  </div>
                </div>
              </Card>
            </div>

            <div className="mx-auto mt-8 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric value="24/7" label={t("تشغيل مستمر", "Always on")} />
              <Metric value="9+" label={t("أنظمة عملية", "Practical systems")} />
              <Metric value={String(SLASH_COMMANDS.length)} label={t("أوامر Discord", "Discord commands")} />
              <Metric value={t("مشترك", "Shared")} label={t("حفظ الإعدادات", "Settings persistence")} />
            </div>
            <div className="mt-9 flex justify-center text-muted-foreground"><a href="#features" aria-label={t("انزل للمزايا", "Scroll to features")} className="animate-bounce rounded-full border border-border/60 bg-background/45 p-3 backdrop-blur transition hover:border-primary/50 hover:text-primary"><ArrowDown className="size-4" /></a></div>
          </div>
        </section>

        <section id="features" className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary">{t("Glow في سطر واحد", "Glow in one line")}</p>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-[-0.05em] text-foreground sm:text-5xl">{t("أقل فوضى. أكثر حضوراً.", "Less clutter. More presence.")}</h2>
            <p className="mt-5 text-sm leading-7 text-muted-foreground sm:text-base">{t("مصمم لفريق يريد أدوات قوية، لكن لا يريد أن يشرح لوحة التحكم كل مرة.", "Built for teams that want powerful tools without having to explain the dashboard every time.")}</p>
          </div>
          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {featureCards.map((feature, index) => (
              <Card key={feature.en} className={`animate-rise-in group relative overflow-hidden border-border/60 bg-gradient-to-br ${feature.tone} bg-card/45 p-7 transition duration-300 hover:-translate-y-1.5 hover:border-primary/45 hover:shadow-[0_28px_70px_-38px_hsl(var(--primary)/0.9)]`} style={{ animationDelay: `${index * 90}ms` }}>
                <div className="absolute -end-14 -top-14 size-36 rounded-full bg-white/5 blur-3xl transition duration-500 group-hover:scale-150" />
                <span className="relative flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-background/40 text-primary shadow-[0_0_28px_hsl(var(--primary)/0.14)] transition duration-300 group-hover:rotate-3 group-hover:scale-110"><feature.icon className="size-5" /></span>
                <h3 className="relative mt-8 text-xl font-bold text-foreground">{t(feature.ar, feature.en)}</h3>
                <p className="relative mt-3 text-sm leading-7 text-muted-foreground">{t(feature.dar, feature.den)}</p>
                <div className="relative mt-7 flex items-center gap-2 text-xs font-bold text-success"><CircleCheck className="size-4" />{t("جاهز للعمل", "Ready to work")}</div>
              </Card>
            ))}
          </div>
        </section>

        <section id="systems" className="border-y border-border/40 bg-card/15">
          <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-8 lg:py-28">
            <div className="order-2 lg:order-1">
              <div className="relative overflow-hidden rounded-[2rem] border border-primary/25 bg-background/55 p-2 shadow-[0_30px_90px_-42px_hsl(var(--primary)/0.9)]">
                <img src={communityPreview} alt={t("صورة مجتمع Glow", "Glow community visual")} className="aspect-[16/10] w-full rounded-[1.5rem] object-cover" />
                <div className="pointer-events-none absolute inset-2 rounded-[1.5rem] bg-gradient-to-tr from-background/60 via-transparent to-primary/10" />
                <div className="absolute bottom-6 start-6 rounded-2xl border border-white/15 bg-background/70 px-4 py-3 backdrop-blur-md">
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary">Glow signal</p>
                  <p className="mt-1 text-sm font-bold text-foreground">{t("مجتمع أوضح", "A clearer community")}</p>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/12 text-primary shadow-[0_0_35px_hsl(var(--primary)/0.18)]"><Rocket className="size-6" /></div>
              <p className="mt-7 text-xs font-bold uppercase tracking-[0.3em] text-primary">{t("خريطة الأنظمة", "The systems map")}</p>
              <h2 className="mt-4 max-w-xl font-display text-3xl font-bold tracking-[-0.05em] text-foreground sm:text-5xl">{t("كل جزء له مكان. كل قرار له أثر.", "Every part has a place. Every decision has an effect.")}</h2>
              <p className="mt-5 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">{t("Glow لا يكدّس الخيارات أمامك. يضع الأنظمة المهمة في مسار مفهوم من الإعداد إلى النتيجة داخل Discord.", "Glow does not pile options in front of you. It gives important systems a clear path from setup to outcome inside Discord.")}</p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {systems.map((system) => (
                  <div key={system.en} className="group rounded-2xl border border-border/50 bg-background/25 p-4 transition duration-200 hover:border-primary/35 hover:bg-primary/5"><span className={`flex size-10 items-center justify-center rounded-xl ${system.tone}`}><system.icon className="size-4" /></span><h3 className="mt-4 text-sm font-bold text-foreground">{t(system.ar, system.en)}</h3><p className="mt-1.5 text-xs leading-6 text-muted-foreground">{t(system.dar, system.den)}</p></div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="commands" className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
            <div>
              <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/12 text-primary"><Command className="size-6" /></div>
              <p className="mt-7 text-xs font-bold uppercase tracking-[0.3em] text-primary">{t("داخل Discord", "Inside Discord")}</p>
              <h2 className="mt-4 font-display text-3xl font-bold tracking-[-0.05em] text-foreground sm:text-5xl">{t("من لوحة التحكم إلى أمر واحد.", "From the dashboard to one command.")}</h2>
              <p className="mt-5 max-w-md text-sm leading-7 text-muted-foreground">{t("إعداداتك لا تبقى في الواجهة. الأوامر والتفاعلات تقرأ من نفس مساحة Glow التي يديرها البوت.", "Your settings do not stop at the UI. Commands and interactions read from the same Glow workspace the bot manages.")}</p>
              <div className="mt-7 flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/7 p-4"><Bot className="size-5 text-primary" /><p className="text-xs font-semibold leading-6 text-muted-foreground">{t("أوامر واضحة، ردود أسرع، وتجربة أقل تشتيتاً.", "Clear commands, faster responses and less distraction.")}</p></div>
            </div>
            <Card className="glow-panel relative overflow-hidden p-4 sm:p-6"><div className="pointer-events-none absolute -end-24 -top-24 size-80 rounded-full bg-primary/12 blur-3xl" /><div className="relative grid gap-2 sm:grid-cols-2">
              {SLASH_COMMANDS.map((command, index) => { const copy = commandDescriptions[command.name] ?? { ar: command.description, en: command.description }; return <div key={command.name} className="group flex items-center gap-3 rounded-2xl border border-border/45 bg-background/25 px-4 py-3.5 transition duration-200 hover:border-primary/35 hover:bg-primary/5"><span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Zap className="size-3.5" /></span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><code className="text-sm font-bold text-primary">/{command.name}</code>{index < 4 && <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-bold text-success">Live</span>}</div><p className="mt-1 truncate text-xs text-muted-foreground">{t(copy.ar, copy.en)}</p></div></div>; })}
            </div></Card>
          </div>
        </section>

        <section className="border-y border-border/40 bg-card/15">
          <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-8 lg:py-24">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary">{t("ثلاث خطوات فقط", "Three simple steps")}</p>
              <h2 className="mt-4 font-display text-3xl font-bold tracking-[-0.05em] text-foreground sm:text-5xl">{t("ابدأ بدون منحنى تعلم طويل.", "Start without a long learning curve.")}</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Step number="01" icon={Webhook} title={t("اربط", "Connect")} copy={t("سجّل بديسكورد واختر السيرفر.", "Sign in with Discord and choose a server.")} />
              <Step number="02" icon={Gauge} title={t("رتّب", "Configure")} copy={t("فعّل الأنظمة واحفظ إعداداتك.", "Enable modules and save your settings.")} />
              <Step number="03" icon={Sparkles} title={t("خلّه يلمع", "Let it glow")} copy={t("راقب النتيجة داخل Discord.", "Watch the result inside Discord.")} />
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="relative overflow-hidden rounded-[2rem] border border-primary/25 bg-gradient-to-br from-primary/20 via-card/70 to-card/35 px-6 py-16 text-center shadow-[0_30px_95px_-42px_hsl(var(--primary)/0.9)] sm:px-12">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,hsl(var(--accent)/0.2),transparent_48%)]" />
            <div className="relative"><Layers3 className="mx-auto size-8 text-primary" /><h2 className="mt-5 font-display text-3xl font-bold tracking-[-0.05em] text-foreground sm:text-5xl">{t("خلِّ سيرفرك يشتغل بطريقتك.", "Let your server run your way.")}</h2><p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">{t("سجّل بديسكورد، اختر السيرفر، وابدأ ببناء تجربة Glow تناسب مجتمعك.", "Sign in with Discord, choose your server and start shaping a Glow experience for your community.")}</p><div className="mt-8 flex flex-wrap justify-center gap-3"><Button asChild size="lg" className="gap-2 px-7"><a href="/api/public/auth/discord/login">{t("ابدأ الآن", "Get started")}<ArrowUpRight className="size-4" /></a></Button><Button asChild size="lg" variant="ghost"><a href={SUPPORT_SERVER_URL} target="_blank" rel="noreferrer">{t("زر سيرفر الدعم", "Visit support")}<ArrowUpRight className="size-4" /></a></Button></div></div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/50"><div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-9 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8"><div className="flex items-center gap-3"><img src={logo} alt="Glow" className="size-8 rounded-lg" /><span>Glow © {new Date().getFullYear()} — Community Control Center</span></div><div className="flex items-center gap-5"><Link to="/dashboard" className="transition-colors hover:text-primary">{t("الداشبورد", "Dashboard")}</Link><a href={SUPPORT_SERVER_URL} target="_blank" rel="noreferrer" className="transition-colors hover:text-primary">{t("الدعم", "Support")}</a></div></div></footer>
    </div>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return <div className="rounded-2xl border border-border/50 bg-background/40 px-3 py-3 text-center backdrop-blur-sm"><p className="text-xl font-black tracking-tight text-foreground sm:text-2xl">{value}</p><p className="mt-1 text-[10px] font-semibold text-muted-foreground sm:text-[11px]">{label}</p></div>;
}

function Step({ number, icon: Icon, title, copy }: { number: string; icon: typeof Webhook; title: string; copy: string }) {
  return <Card className="glow-panel p-5 transition duration-300 hover:-translate-y-1 hover:border-primary/35"><div className="flex items-center justify-between"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-4" /></span><span className="text-xs font-black tracking-[0.2em] text-muted-foreground/60">{number}</span></div><h3 className="mt-6 text-base font-bold text-foreground">{title}</h3><p className="mt-2 text-xs leading-6 text-muted-foreground">{copy}</p><div className="mt-5 flex items-center gap-2 text-xs font-bold text-success"><Check className="size-3.5" />Glow-ready</div></Card>;
}
