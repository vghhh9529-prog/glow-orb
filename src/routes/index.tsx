import { createFileRoute, Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TopBar } from "@/components/glow/shell";
import banner from "@/assets/glow-hero-banner.png";
import logo from "@/assets/glow-brand-mark.png";
import { SUPPORT_SERVER_URL, botInviteUrl } from "@/lib/discord";
import { SLASH_COMMANDS } from "@/lib/slash-commands";
import {
  ArrowUpRight,
  Bot,
  Check,
  Coins,
  Layers3,
  Lightbulb,
  MessageSquareHeart,
  Mic,
  Shield,
  Sparkles,
  Trophy,
  UserPlus,
  Zap,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Glow — لوحة تحكم بوت ديسكورد متكاملة" },
      {
        name: "description",
        content:
          "Glow: بوت ديسكورد احترافي للحماية، الأوتومود، اللفلات، الترحيب، الاقتراحات، الرومات المؤقتة واقتصاد Glow.",
      },
      { property: "og:title", content: "Glow — Better Use Glow" },
      {
        property: "og:description",
        content: "A focused control center for every Discord community.",
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
    accent: "from-cyan-400/25 to-blue-500/5",
  },
  {
    icon: Trophy,
    ar: "لفلات تحفّز النشاط",
    en: "Leveling that drives activity",
    dar: "XP واضح، رولات مكافآت ولوحة صدارة تجعل المشاركة ممتعة.",
    den: "Clear XP, reward roles and a leaderboard that keeps members active.",
    accent: "from-violet-400/25 to-fuchsia-500/5",
  },
  {
    icon: MessageSquareHeart,
    ar: "مجتمع يسمع بعضه",
    en: "A community that listens",
    dar: "اقتراحات وردود وتفاعلات تلقائية مرتبطة مباشرة بسيرفرك.",
    den: "Suggestions, replies and reactions connected directly to your server.",
    accent: "from-amber-300/25 to-orange-500/5",
  },
  {
    icon: Mic,
    ar: "رومات صوتية ذكية",
    en: "Smart voice rooms",
    dar: "لوبي واحد ينشئ رومات مؤقتة وينظفها تلقائياً عند انتهائها.",
    den: "One lobby creates temporary rooms and cleans them up when they empty.",
    accent: "from-emerald-300/25 to-cyan-500/5",
  },
];

function Landing() {
  const { t, lang } = useI18n();

  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} className="min-h-screen overflow-hidden bg-background">
      <TopBar
        right={
          <Button asChild size="sm" className="gap-2 shadow-[0_0_24px_hsl(var(--primary)/0.28)]">
            <a href="/api/public/auth/discord/login">
              <Sparkles className="size-4" />
              {t("دخول بديسكورد", "Login with Discord")}
            </a>
          </Button>
        }
      />

      <main>
        <section className="relative isolate border-b border-border/40">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_10%_0%,hsl(var(--primary)/0.22),transparent_32%),radial-gradient(circle_at_92%_8%,hsl(var(--accent)/0.16),transparent_28%)]" />
          <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:px-8 lg:pb-28 lg:pt-20">
            <div className="relative">
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
                <span className="size-1.5 animate-pulse rounded-full bg-primary" />
                {t("نظام تشغيل مجتمعك", "Your community operating system")}
              </div>
              <h1 className="max-w-3xl text-4xl font-black leading-[1.08] tracking-[-0.04em] text-foreground sm:text-6xl lg:text-7xl">
                {t("خلِّ سيرفرك يلمع.", "Make your server glow.")}
                <span className="mt-2 block glow-text">
                  {t("بدون تعقيد.", "Without the clutter.")}
                </span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-8 text-muted-foreground sm:text-lg">
                {t(
                  "Glow يجمع الحماية، النشاط، المجتمع والاقتصاد في لوحة واحدة مرتبة — إعدادات واضحة، تشغيل مستمر، وتجربة تشبه سيرفرك.",
                  "Glow brings protection, engagement, community and economy into one composed control center — clear settings, always-on runtime and a dashboard that feels like your server.",
                )}
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button
                  asChild
                  size="lg"
                  className="gap-2 px-6 shadow-[0_0_32px_hsl(var(--primary)/0.38)]"
                >
                  <a href="/api/public/auth/discord/login">
                    {t("افتح لوحة التحكم", "Open the dashboard")}
                    <ArrowUpRight className="size-4" />
                  </a>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-border/70 bg-background/30"
                >
                  <a href={botInviteUrl()} target="_blank" rel="noreferrer">
                    {t("أضف Glow لسيرفرك", "Add Glow to your server")}
                  </a>
                </Button>
              </div>
              <div className="mt-10 grid max-w-xl grid-cols-3 gap-3 border-t border-border/50 pt-6">
                <Metric value="24/7" label={t("تشغيل مستمر", "Always on")} />
                <Metric value="9+" label={t("أنظمة أساسية", "Core systems")} />
                <Metric value="1" label={t("لوحة تحكم", "Control center")} />
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-xl lg:justify-self-end">
              <div className="pointer-events-none absolute -inset-8 rounded-[3rem] bg-primary/10 blur-3xl" />
              <Card className="relative overflow-hidden rounded-[2rem] border-primary/25 bg-card/65 p-2 shadow-[0_30px_100px_-35px_hsl(var(--primary)/0.75)] backdrop-blur-xl">
                <div className="relative overflow-hidden rounded-[1.55rem] border border-white/10 bg-background/60">
                  <img
                    src={banner}
                    alt={t("هوية Glow البصرية", "Glow visual identity")}
                    className="aspect-[17/6] w-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-background via-background/40 to-transparent" />
                  <div className="relative -mt-14 flex items-end gap-4 px-5 pb-5 sm:px-7 sm:pb-7">
                    <img
                      src={logo}
                      alt="Glow"
                      className="size-20 rounded-2xl border border-white/20 object-cover shadow-[0_0_36px_hsl(var(--primary)/0.4)] sm:size-24"
                    />
                    <div className="min-w-0 pb-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
                        Better Use Glow
                      </p>
                      <p className="mt-1 text-xl font-black text-foreground sm:text-2xl">
                        Glow Control Center
                      </p>
                    </div>
                  </div>
                </div>
                <div className="grid gap-2 p-3 sm:grid-cols-3 sm:p-4">
                  <MiniPanel
                    icon={Shield}
                    label={t("حماية", "Protection")}
                    value={t("متصل", "Connected")}
                  />
                  <MiniPanel
                    icon={Zap}
                    label={t("أتمتة", "Automation")}
                    value={t("جاهزة", "Ready")}
                  />
                  <MiniPanel
                    icon={Layers3}
                    label={t("أنظمة", "Modules")}
                    value={t("مرتبة", "Organized")}
                  />
                </div>
              </Card>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-primary">
                {t("لماذا Glow؟", "Why Glow?")}
              </p>
              <h2 className="mt-3 max-w-2xl text-3xl font-black tracking-tight text-foreground sm:text-5xl">
                {t("أنظمة كثيرة، تجربة واحدة واضحة.", "Many systems. One clear experience.")}
              </h2>
            </div>
            <p className="max-w-md text-sm leading-7 text-muted-foreground">
              {t(
                "لا تحتاج تتنقل بين عشرات البوتات. فعّل ما تحتاجه، اترك الباقي هادئاً، وشاهد حالة سيرفرك من مكان واحد.",
                "You do not need a dozen bots. Enable what you need, keep the rest quiet and see your server health from one place.",
              )}
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <Card
                key={feature.en}
                className={`group relative overflow-hidden border-border/60 bg-gradient-to-br ${feature.accent} bg-card/55 p-6 transition duration-200 hover:-translate-y-1 hover:border-primary/45 hover:shadow-[0_22px_55px_-32px_hsl(var(--primary)/0.8)]`}
              >
                <feature.icon className="size-6 text-primary transition-transform duration-200 group-hover:scale-110" />
                <h3 className="mt-8 text-lg font-bold text-foreground">
                  {t(feature.ar, feature.en)}
                </h3>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                  {t(feature.dar, feature.den)}
                </p>
              </Card>
            ))}
          </div>
        </section>

        <section className="border-y border-border/40 bg-card/20">
          <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:px-8 lg:py-24">
            <div>
              <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                <Bot className="size-6" />
              </div>
              <h2 className="mt-5 text-3xl font-black tracking-tight text-foreground sm:text-4xl">
                {t("من أول أمر إلى آخر عضو.", "From the first command to the last member.")}
              </h2>
              <p className="mt-4 max-w-lg text-sm leading-7 text-muted-foreground">
                {t(
                  "أوامر Glow مصممة لتكون قصيرة ومفيدة، وتعمل جنباً إلى جنب مع الإعدادات التي تحفظها من الداشبورد.",
                  "Glow commands are short and useful, and they work alongside the settings you save from the dashboard.",
                )}
              </p>
              <div className="mt-6 space-y-3">
                {["/rank", "/leaderboard", "/suggest", "/daily"].map((command) => (
                  <div
                    key={command}
                    className="flex items-center gap-3 text-sm text-muted-foreground"
                  >
                    <Check className="size-4 text-success" />
                    <code className="rounded-lg border border-primary/20 bg-primary/10 px-2.5 py-1 font-semibold text-primary">
                      {command}
                    </code>
                    <span>{t("متاح داخل Discord", "Available inside Discord")}</span>
                  </div>
                ))}
              </div>
            </div>
            <Card className="glow-panel relative overflow-hidden p-5 sm:p-7">
              <div className="pointer-events-none absolute -right-20 -top-20 size-56 rounded-full bg-primary/15 blur-3xl" />
              <div className="relative grid gap-3 sm:grid-cols-2">
                {SLASH_COMMANDS.map((command) => (
                  <div
                    key={command.name}
                    className="rounded-2xl border border-border/50 bg-background/35 p-4 transition-colors hover:border-primary/35 hover:bg-primary/5"
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="size-3.5 text-primary" />
                      <code className="text-sm font-bold text-primary">/{command.name}</code>
                    </div>
                    <p className="mt-2 text-xs leading-6 text-muted-foreground">
                      {command.description}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="relative overflow-hidden rounded-[2rem] border border-primary/25 bg-gradient-to-br from-primary/15 via-card/70 to-card/35 px-6 py-12 text-center shadow-[0_25px_80px_-42px_hsl(var(--primary)/0.8)] sm:px-12">
            <div className="pointer-events-none absolute left-1/2 top-0 size-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-3xl" />
            <Coins className="relative mx-auto size-8 text-primary" />
            <h2 className="relative mt-5 text-3xl font-black text-foreground sm:text-5xl">
              {t("خلّ سيرفرك يشتغل بطريقتك.", "Let your server run your way.")}
            </h2>
            <p className="relative mx-auto mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
              {t(
                "سجّل بديسكورد، اختر السيرفر، وابدأ ببناء تجربة Glow تناسب مجتمعك.",
                "Sign in with Discord, choose your server and start shaping a Glow experience for your community.",
              )}
            </p>
            <div className="relative mt-7 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" className="gap-2 px-6">
                <a href="/api/public/auth/discord/login">{t("ابدأ الآن", "Get started")}</a>
              </Button>
              <Button asChild size="lg" variant="ghost">
                <a href={SUPPORT_SERVER_URL} target="_blank" rel="noreferrer">
                  {t("زر سيرفر الدعم", "Visit support")}
                  <ArrowUpRight className="size-4" />
                </a>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/50">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Glow" className="size-8 rounded-lg" />
            <span>Glow © {new Date().getFullYear()} — Better Use Glow</span>
          </div>
          <div className="flex items-center gap-5">
            <Link to="/dashboard" className="transition-colors hover:text-primary">
              {t("الداشبورد", "Dashboard")}
            </Link>
            <a
              href={SUPPORT_SERVER_URL}
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-primary"
            >
              {t("الدعم", "Support")}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-xl font-black tracking-tight text-foreground sm:text-2xl">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground sm:text-xs">{label}</p>
    </div>
  );
}

function MiniPanel({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Shield;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-background/35 px-3 py-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="size-3.5 text-primary" />
        <span>{label}</span>
      </div>
      <p className="mt-2 text-sm font-bold text-foreground">{value}</p>
    </div>
  );
}
