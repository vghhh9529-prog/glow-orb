import { createFileRoute, Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TopBar } from "@/components/glow/shell";
import banner from "@/assets/glow-banner.jpg";
import logo from "@/assets/glow-logo.png";
import { SUPPORT_SERVER_URL, botInviteUrl } from "@/lib/discord";
import { SLASH_COMMANDS } from "@/lib/slash-commands";
import {
  Shield,
  Sparkles,
  Trophy,
  MessageSquareHeart,
  UserPlus,
  Mic,
  Bot,
  Coins,
  Lightbulb,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Glow — لوحة تحكم بوت ديسكورد متكاملة" },
      {
        name: "description",
        content:
          "Glow: بوت ديسكورد بحماية وأوتومود ولفلات وترحيب واقتراحات ورومات مؤقتة وعملة Glow — تحكم كامل من داشبورد واحدة.",
      },
      { property: "og:title", content: "Glow — Better Use Glow" },
      {
        property: "og:description",
        content: "Protection, automod, leveling, welcome cards, suggestions and the Glow economy.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { t } = useI18n();

  const features = [
    {
      icon: Shield,
      ar: "الحماية",
      en: "Protection",
      dar: "أوقف حذف الرومات والرولات والبان الجماعي بعقوبات فورية.",
      den: "Stop channel/role nukes and mass bans with instant punishments.",
    },
    {
      icon: Bot,
      ar: "أوتومود",
      en: "AutoMod",
      dar: "فلاتر سبام وروابط ودعوات وكلمات ممنوعة تُركّب في ديسكورد مباشرة.",
      den: "Spam, links, invites and word filters pushed straight to Discord.",
    },
    {
      icon: Trophy,
      ar: "اللفلات",
      en: "Leveling",
      dar: "XP للكتابة والصوت والتفاعلات مع رولات مكافآت ولوحة صدارة.",
      den: "Text, voice and reaction XP with reward roles and leaderboards.",
    },
    {
      icon: UserPlus,
      ar: "الترحيب",
      en: "Welcome",
      dar: "رسائل وإمبد وكرت ترحيب بصورة العضو ومتغيرات مثل {user}.",
      den: "Messages, embeds and image cards with variables like {user}.",
    },
    {
      icon: Lightbulb,
      ar: "الاقتراحات",
      en: "Suggestions",
      dar: "تصويت ومراجعة وقرارات مع سجل كامل.",
      den: "Voting, review queue and decisions with full logs.",
    },
    {
      icon: MessageSquareHeart,
      ar: "الرد والتفاعل التلقائي",
      en: "Auto Reply & React",
      dar: "ردود وتفاعلات تلقائية على كلمات محددة.",
      den: "Automatic replies and reactions on trigger words.",
    },
    {
      icon: Mic,
      ar: "الرومات المؤقتة",
      en: "Temp Voice",
      dar: "روم إنشاء يولّد رومات خاصة تُحذف تلقائياً.",
      den: "A lobby that spawns private rooms and cleans them up.",
    },
    {
      icon: Coins,
      ar: "عملة Glow",
      en: "Glow Currency",
      dar: "مكافأة يومية كل 12 ساعة مع ستريك ومتجر قادم.",
      den: "Daily reward every 12 hours with streaks.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <TopBar
        right={
          <Button asChild size="sm">
            <a href="/api/public/auth/discord/login">{t("دخول بديسكورد", "Login with Discord")}</a>
          </Button>
        }
      />

      <section className="relative overflow-hidden">
        <img
          src={banner}
          alt=""
          aria-hidden
          className="absolute inset-0 size-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/85 to-background" />
        <div className="relative mx-auto flex max-w-5xl flex-col items-center px-4 py-24 text-center">
          <img
            src={logo}
            alt="Glow logo"
            className="size-24 rounded-3xl shadow-[0_0_60px_hsl(var(--primary)/0.6)]"
          />
          <p className="mt-6 text-sm font-semibold uppercase tracking-[0.35em] text-primary">
            Better Use Glow
          </p>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight text-foreground md:text-6xl">
            {t("بوت واحد يدير سيرفرك بالكامل", "One bot to run your whole server")}
          </h1>
          <p className="mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
            {t(
              "حماية، أوتومود، لفلات، ترحيب، اقتراحات، رومات مؤقتة، ردود تلقائية وعملة Glow — كلها من داشبورد واحدة أنيقة.",
              "Protection, automod, leveling, welcome, suggestions, temp voice, auto replies and the Glow economy — from a single sleek dashboard.",
            )}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="shadow-[0_0_30px_hsl(var(--primary)/0.45)]">
              <a href="/api/public/auth/discord/login">
                <Sparkles className="size-4" />
                {t("ابدأ الآن", "Get started")}
              </a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href={botInviteUrl()} target="_blank" rel="noreferrer">
                {t("أضف البوت", "Invite the bot")}
              </a>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <a href={SUPPORT_SERVER_URL} target="_blank" rel="noreferrer">
                {t("سيرفر الدعم", "Support server")}
              </a>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center text-3xl font-bold text-foreground">
          {t("الأنظمة", "Modules")}
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <Card
              key={f.en}
              className="group border-border/60 bg-card/50 p-5 transition-all hover:border-primary/60 hover:shadow-[0_0_40px_hsl(var(--primary)/0.18)]"
            >
              <f.icon className="size-6 text-primary" />
              <h3 className="mt-3 font-semibold text-foreground">{t(f.ar, f.en)}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{t(f.dar, f.den)}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-24">
        <h2 className="text-center text-3xl font-bold text-foreground">
          {t("أوامر السلاش", "Slash commands")}
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          {t("اكتب / في سيرفرك لتظهر لك كل الأوامر.", "Type / in your server to see them all.")}
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {SLASH_COMMANDS.map((c) => (
            <div
              key={c.name}
              className="flex items-start gap-3 rounded-xl border border-border/60 bg-card/40 p-4"
            >
              <code className="rounded-md bg-primary/10 px-2 py-1 text-sm font-semibold text-primary">
                /{c.name}
              </code>
              <p className="text-sm text-muted-foreground">{c.description}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border/60 py-8 text-center text-sm text-muted-foreground">
        Glow © {new Date().getFullYear()} — Better Use Glow
        <div className="mt-2">
          <Link to="/dashboard" className="text-primary hover:underline">
            {t("الداشبورد", "Dashboard")}
          </Link>
        </div>
      </footer>
    </div>
  );
}
