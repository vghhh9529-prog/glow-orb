import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  ArrowUpRight,
  Bot,
  Check,
  CircleCheck,
  Coins,
  Command,
  Gauge,
  Layers3,
  MessageSquareHeart,
  Mic,
  Rocket,
  Settings2,
  Shield,
  Sparkles,
  Tags,
  Ticket,
  Trophy,
  UserPlus,
  Users,
  Webhook,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TopBar } from "@/components/glow/shell";
import logo from "@/assets/glow-brand-mark.png";
import banner from "@/assets/glow-hero-banner.png";
import heroVisual from "@/assets/glow-hero-visual.jpg";
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
          "Glow is a focused Discord community control center for protection, engagement, moderation, leveling and automation.",
      },
      { property: "og:title", content: "Glow — Better Use Glow" },
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

const features = [
  {
    icon: Shield,
    ar: "حماية هادئة وقوية",
    en: "Quiet, serious protection",
    dar: "حماية من التخريب والروابط والسبام بدون إزعاج مجتمعك.",
    den: "Stop raids, spam and dangerous links without adding noise.",
    accent: "from-cyan-400/25 via-blue-500/8 to-transparent",
  },
  {
    icon: Trophy,
    ar: "لفلات تحفّز النشاط",
    en: "Leveling that drives activity",
    dar: "XP واضح، رولات مكافآت ولوحة صدارة تجعل المشاركة ممتعة.",
    den: "Clear XP, reward roles and a leaderboard that keeps members active.",
    accent: "from-violet-400/25 via-fuchsia-500/8 to-transparent",
  },
  {
    icon: MessageSquareHeart,
    ar: "مجتمع يسمع بعضه",
    en: "A community that listens",
    dar: "اقتراحات وردود وتفاعلات تلقائية مرتبطة مباشرة بسيرفرك.",
    den: "Suggestions, replies and reactions connected directly to your server.",
    accent: "from-amber-300/25 via-orange-500/8 to-transparent",
  },
  {
    icon: Mic,
    ar: "رومات صوتية ذكية",
    en: "Smart voice rooms",
    dar: "لوبي واحد ينشئ رومات مؤقتة وينظفها عند انتهائها.",
    den: "One lobby creates temporary rooms and cleans them up when empty.",
    accent: "from-emerald-300/25 via-cyan-500/8 to-transparent",
  },
  {
    icon: Ticket,
    ar: "تشغيل مرتب للفريق",
    en: "A cleaner staff workflow",
    dar: "مساحة واضحة للإشراف، المراجعة، والقرارات التي يحتاجها فريقك.",
    den: "A clear space for moderation, review queues and staff decisions.",
    accent: "from-rose-400/25 via-pink-500/8 to-transparent",
  },
  {
    icon: Webhook,
    ar: "أتمتة مرتبطة بسيرفرك",
    en: "Automation that stays connected",
    dar: "كل إعداد يذهب إلى نفس مساحة العمل التي يقرأ منها البوت.",
    den: "Every setting is written to the same workspace your bot reads.",
    accent: "from-sky-400/25 via-indigo-500/8 to-transparent",
  },
];

const systems = [
  {
    icon: Shield,
    ar: "الأمان والإشراف",
    en: "Safety & moderation",
    dar: "AutoMod، حماية من التخريب، حالات إشراف وسجل قرارات واضح.",
    den: "AutoMod, anti-nuke protection, moderation cases and clear decisions.",
    tone: "text-cyan-300 bg-cyan-400/10",
  },
  {
    icon: Sparkles,
    ar: "المجتمع والتفاعل",
    en: "Community & engagement",
    dar: "رد تلقائي، تفاعلات، اقتراحات، ولفلات تشجع الأعضاء.",
    den: "Auto replies, reactions, suggestions and leveling that bring people back.",
    tone: "text-violet-300 bg-violet-400/10",
  },
  {
    icon: Users,
    ar: "إدارة الأعضاء",
    en: "Member operations",
    dar: "ترحيب، مغادرة، رولات تلقائية، ومعلومات العضو في مكان واحد.",
    den: "Welcome, leave, autoroles and useful member information in one place.",
    tone: "text-emerald-300 bg-emerald-400/10",
  },
  {
    icon: Gauge,
    ar: "الصحة والتحليلات",
    en: "Health & insight",
    dar: "نظرة سريعة على الأعضاء، الأنظمة، الاقتراحات، والصدارة.",
    den: "A fast view of members, modules, suggestions and leaderboard activity.",
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
  ping: { ar: "حالة اتصال Glow", en: "Check Glow connectivity" },
  user: { ar: "معلومات عضو", en: "Member information" },
  avatar: { ar: "رابط صورة العضو", en: "Member avatar URL" },
  help: { ar: "قائمة أوامر Glow", en: "Glow command list" },
};

function Landing() {
  const { t, lang } = useI18n();

  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} className="min-h-screen overflow-hidden bg-background">
      <TopBar nav right={
        <Button asChild size="sm" className="gap-2">
          <a href="/api/public/auth/discord/login">
            <Sparkles className="size-4" />
            {t("دخول بديسكورد", "Login with Discord")}
          </a>
        </Button>
      } />

      <main>
        <section className="relative isolate overflow-hidden border-b border-border/40">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_12%_4%,hsl(var(--primary)/0.24),transparent_30%),radial-gradient(circle_at_88%_18%,hsl(var(--accent)/0.18),transparent_28%)]" />
          <div className="pointer-events-none absolute inset-0 -z-10 opacity-30 [background-image:linear-gradient(hsl(var(--border)/0.16)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border)/0.16)_1px,transparent_1px)] [background-size:72px_72px] [mask-image:linear-gradient(to_bottom,black,transparent_78%)]" />
          <div className="mx-auto grid w-full max-w-7xl items-center gap-14 px-4 pb-20 pt-12 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:gap-16 lg:px-8 lg:pb-28 lg:pt-20">
            <div className="animate-rise-in relative">
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3.5 py-2 text-xs font-bold tracking-wide text-primary shadow-[0_0_30px_hsl(var(--primary)/0.12)]">
                <span className="size-2 animate-pulse rounded-full bg-primary" />
                {t("نظام تشغيل مجتمعك", "Your community operating system")}
              </div>
              <h1 className="max-w-3xl font-display text-5xl font-bold leading-[1.02] tracking-[-0.055em] text-foreground sm:text-6xl lg:text-[5.5rem]">
                {t("خلِّ سيرفرك", "Make your server")}
                <span className="block glow-text">{t("يلمع.", "glow.")}</span>
                <span className="mt-2 block text-foreground/90">{t("بدون الفوضى.", "Without the clutter.")}</span>
              </h1>
              <p className="mt-7 max-w-xl text-base leading-8 text-muted-foreground sm:text-lg">
                {t(
                  "Glow يجمع الحماية، النشاط، المجتمع والاقتصاد في مركز تحكم واحد — واضح لفريقك، مفيد لأعضائك، ومتصل بالبوت فعلياً.",
                  "Glow brings protection, engagement, community and economy into one control center — clear for your staff, useful for members and connected to the bot for real.",
                )}
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
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
              <div className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-3 border-t border-border/50 pt-6 text-xs font-semibold text-muted-foreground">
                <span className="inline-flex items-center gap-2"><CircleCheck className="size-4 text-success" />{t("حفظ مشترك", "Shared persistence")}</span>
                <span className="inline-flex items-center gap-2"><CircleCheck className="size-4 text-success" />{t("تشغيل مستمر", "Always on")}</span>
                <span className="inline-flex items-center gap-2"><CircleCheck className="size-4 text-success" />{t("Discord OAuth", "Discord OAuth")}</span>
              </div>
            </div>

            <div className="animate-rise-in relative mx-auto w-full max-w-xl lg:justify-self-end" style={{ animationDelay: "110ms" }}>
              <div className="pointer-events-none absolute -inset-10 rounded-[4rem] bg-primary/15 blur-3xl" />
              <Card className="glow-panel relative overflow-hidden rounded-[2rem] border-primary/30 bg-card/55 p-2 shadow-[0_34px_110px_-36px_hsl(var(--primary)/0.82)] backdrop-blur-xl">
                <div className="relative overflow-hidden rounded-[1.55rem] border border-white/10 bg-background/60">
                  <img src={heroVisual} alt={t("صورة Glow البصرية", "Glow visual") } className="animate-orb-drift aspect-[4/3] w-full object-cover" />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-transparent to-white/5" />
                  <div className="absolute left-4 top-4 flex items-center gap-2 rounded-xl border border-white/15 bg-background/55 px-3 py-2 text-[11px] font-bold text-foreground backdrop-blur-md">
                    <span className="size-2 rounded-full bg-success shadow-[0_0_12px_hsl(var(--success))]" />
                    {t("البوت متصل", "Bot connected")}
                  </div>
                  <div className="absolute bottom-4 right-4 rounded-2xl border border-white/15 bg-background/65 px-3.5 py-3 backdrop-blur-md">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Glow pulse</p>
                    <p className="mt-1 text-sm font-bold text-foreground">{t("كل شيء واضح", "Everything in sync")}</p>
                  </div>
                  <div className="relative -mt-10 flex items-end gap-4 px-5 pb-5 sm:px-7 sm:pb-7">
                    <img src={logo} alt="Glow" className="size-20 rounded-2xl border border-white/20 object-cover shadow-[0_0_36px_hsl(var(--primary)/0.45)] sm:size-24" />
                    <div className="min-w-0 pb-1">
                      <p className="text-xs font-bold uppercase tracking-[0.28em] text-primary">Better Use Glow</p>
                      <p className="mt-1 text-xl font-black text-foreground sm:text-2xl">Glow Control Center</p>
                    </div>
                  </div>
                </div>
                <div className="grid gap-2 p-3 sm:grid-cols-3 sm:p-4">
                  <MiniPanel icon={Shield} label={t("حماية", "Protection")} value={t("متصل", "Connected")} />
                  <MiniPanel icon={Zap} label={t("أتمتة", "Automation")} value={t("جاهزة", "Ready")} />
                  <MiniPanel icon={Layers3} label={t("أنظمة", "Modules")} value={t("مرتبة", "Organized")} />
                </div>
              </Card>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-primary">{t("لماذا Glow؟", "Why Glow?")}</p>
              <h2 className="mt-3 max-w-2xl font-display text-3xl font-bold tracking-[-0.04em] text-foreground sm:text-5xl">
                {t("أنظمة كثيرة، تجربة واحدة هادئة.", "Many systems. One calmer experience.")}
              </h2>
            </div>
            <p className="max-w-md text-sm leading-7 text-muted-foreground">
              {t(
                "بدل التنقل بين عشرات البوتات، خذ الأدوات المهمة إلى لوحة واحدة تشرح نفسها وتحفظ قراراتك مباشرة.",
                "Instead of jumping between a dozen bots, bring the important tools into one interface that explains itself and saves decisions directly.",
              )}
            </p>
          </div>
          <div className="mt-11 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <Card key={feature.en} className={`animate-rise-in group relative overflow-hidden border-border/60 bg-gradient-to-br ${feature.accent} bg-card/55 p-6 transition duration-300 hover:-translate-y-1.5 hover:border-primary/45 hover:shadow-[0_25px_65px_-35px_hsl(var(--primary)/0.9)]`} style={{ animationDelay: `${index * 70}ms` }}>
                <div className="absolute -right-12 -top-12 size-28 rounded-full bg-white/5 blur-2xl transition duration-300 group-hover:scale-150" />
                <span className="relative flex size-11 items-center justify-center rounded-2xl border border-white/10 bg-background/35 text-primary shadow-[0_0_25px_hsl(var(--primary)/0.12)] transition duration-300 group-hover:scale-110 group-hover:rotate-3">
                  <feature.icon className="size-5" />
                </span>
                <h3 className="relative mt-7 text-lg font-bold text-foreground">{t(feature.ar, feature.en)}</h3>
                <p className="relative mt-2 text-sm leading-7 text-muted-foreground">{t(feature.dar, feature.den)}</p>
              </Card>
            ))}
          </div>
        </section>

        <section id="systems" className="border-y border-border/40 bg-card/15">
          <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:px-8 lg:py-28">
            <div>
              <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/12 text-primary shadow-[0_0_35px_hsl(var(--primary)/0.18)]"><Rocket className="size-6" /></div>
              <p className="mt-7 text-xs font-bold uppercase tracking-[0.28em] text-primary">{t("خريطة Glow", "The Glow map")}</p>
              <h2 className="mt-3 max-w-lg font-display text-3xl font-bold tracking-[-0.04em] text-foreground sm:text-5xl">{t("خلِّ فريقك يشوف الصورة كاملة.", "Give your staff the full picture.")}</h2>
              <p className="mt-5 max-w-lg text-sm leading-7 text-muted-foreground sm:text-base">{t("من أول ترحيب إلى آخر قرار إشراف، كل نظام له مكان واضح وحالة قابلة للفهم.", "From the first welcome to the latest moderation decision, every system has a clear home and an understandable state.")}</p>
              <Button asChild variant="outline" className="mt-7 gap-2"><a href="/api/public/auth/discord/login">{t("شاهد لوحة سيرفرك", "See your server dashboard")}<ArrowUpRight className="size-4" /></a></Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {systems.map((system, index) => (
                <Card key={system.en} className="animate-rise-in glow-panel group p-5 transition duration-300 hover:-translate-y-1 hover:border-primary/35" style={{ animationDelay: `${index * 90}ms` }}>
                  <span className={`flex size-11 items-center justify-center rounded-2xl ${system.tone}`}><system.icon className="size-5" /></span>
                  <h3 className="mt-6 text-base font-bold text-foreground">{t(system.ar, system.en)}</h3>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">{t(system.dar, system.den)}</p>
                  <div className="mt-5 flex items-center gap-2 text-xs font-bold text-success"><CircleCheck className="size-4" />{t("متصل بالبوت", "Bot-connected")}</div>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="commands" className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:items-start">
            <div>
              <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/12 text-primary"><Command className="size-6" /></div>
              <p className="mt-7 text-xs font-bold uppercase tracking-[0.28em] text-primary">{t("أوامر عملية", "Useful commands")}</p>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-[-0.04em] text-foreground sm:text-5xl">{t("من اللوحة إلى Discord مباشرة.", "From the dashboard into Discord.")}</h2>
              <p className="mt-5 max-w-md text-sm leading-7 text-muted-foreground">{t("الأوامر الحالية مسجلة في Discord وتعمل على بيانات Glow الحقيقية — وليست مجرد بطاقات تجريبية.", "The current commands are registered in Discord and work against real Glow data — not demo cards.")}</p>
              <div className="mt-7 grid grid-cols-2 gap-3"><Metric value={String(SLASH_COMMANDS.length)} label={t("أوامر مسجلة", "Registered commands")} /><Metric value="24/7" label={t("تشغيل مستمر", "Always on")} /></div>
            </div>
            <Card className="glow-panel relative overflow-hidden p-4 sm:p-6"><div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-primary/12 blur-3xl" /><div className="relative grid gap-2 sm:grid-cols-2">
              {SLASH_COMMANDS.map((command, index) => { const copy = commandDescriptions[command.name] ?? { ar: command.description, en: command.description }; return <div key={command.name} className="group flex items-center gap-3 rounded-2xl border border-border/45 bg-background/25 px-4 py-3.5 transition duration-200 hover:border-primary/35 hover:bg-primary/5"><span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Zap className="size-3.5" /></span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><code className="text-sm font-bold text-primary">/{command.name}</code>{index < 3 && <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-bold text-success">Live</span>}</div><p className="mt-1 truncate text-xs text-muted-foreground">{t(copy.ar, copy.en)}</p></div></div>; })}
            </div></Card>
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-4 pb-20 sm:px-6 lg:px-8 lg:pb-28">
          <div className="relative overflow-hidden rounded-[2rem] border border-primary/25 bg-gradient-to-br from-primary/18 via-card/70 to-card/35 px-6 py-14 text-center shadow-[0_28px_90px_-42px_hsl(var(--primary)/0.85)] sm:px-12">
            <img src={banner} alt="Glow" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.08] mix-blend-screen" />
            <div className="pointer-events-none absolute left-1/2 top-0 size-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-3xl" />
            <div className="relative"><Coins className="mx-auto size-8 text-primary" /><h2 className="mt-5 font-display text-3xl font-bold tracking-[-0.04em] text-foreground sm:text-5xl">{t("خلِّ سيرفرك يشتغل بطريقتك.", "Let your server run your way.")}</h2><p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">{t("سجّل بديسكورد، اختر السيرفر، وابدأ ببناء تجربة Glow تناسب مجتمعك.", "Sign in with Discord, choose your server and start shaping a Glow experience for your community.")}</p><div className="mt-8 flex flex-wrap justify-center gap-3"><Button asChild size="lg" className="gap-2 px-7"><a href="/api/public/auth/discord/login">{t("ابدأ الآن", "Get started")}<ArrowUpRight className="size-4" /></a></Button><Button asChild size="lg" variant="ghost"><a href={SUPPORT_SERVER_URL} target="_blank" rel="noreferrer">{t("زر سيرفر الدعم", "Visit support")}<ArrowUpRight className="size-4" /></a></Button></div></div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/50"><div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-9 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8"><div className="flex items-center gap-3"><img src={logo} alt="Glow" className="size-8 rounded-lg" /><span>Glow © {new Date().getFullYear()} — Better Use Glow</span></div><div className="flex items-center gap-5"><Link to="/dashboard" className="transition-colors hover:text-primary">{t("الداشبورد", "Dashboard")}</Link><a href={SUPPORT_SERVER_URL} target="_blank" rel="noreferrer" className="transition-colors hover:text-primary">{t("الدعم", "Support")}</a></div></div></footer>
    </div>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return <div className="rounded-2xl border border-border/50 bg-card/40 px-4 py-3"><p className="text-2xl font-black tracking-tight text-foreground">{value}</p><p className="mt-1 text-[11px] font-semibold text-muted-foreground">{label}</p></div>;
}

function MiniPanel({ icon: Icon, label, value }: { icon: typeof Shield; label: string; value: string }) {
  return <div className="rounded-xl border border-border/50 bg-background/35 px-3 py-3 transition-colors hover:border-primary/30 hover:bg-primary/5"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="size-3.5 text-primary" /><span>{label}</span></div><p className="mt-2 text-sm font-bold text-foreground">{value}</p></div>;
}
