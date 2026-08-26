import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import logo from "@/assets/glow-brand-mark.png";
import { SUPPORT_SERVER_URL } from "@/lib/discord";
import { Globe } from "lucide-react";

export function GlowMark({ size = 36 }: { size?: number }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <img
        src={logo}
        alt="Glow"
        width={size}
        height={size}
        className="rounded-xl object-cover shadow-[0_0_22px_hsl(var(--primary)/0.25)]"
      />
      <span className="truncate text-lg font-bold tracking-wide text-foreground">Glow</span>
    </span>
  );
}

export function LangToggle() {
  const { toggle, lang } = useI18n();
  return (
    <Button variant="ghost" size="sm" onClick={toggle} className="size-9 shrink-0 gap-1.5 border border-border/50 bg-background/35 px-0 shadow-sm hover:border-primary/30 hover:bg-primary/10 sm:h-9 sm:w-auto sm:px-3">
      <Globe className="size-4" />
      <span className="hidden sm:inline">{lang === "ar" ? "EN" : "ع"}</span>
      <span className="sm:hidden">{lang === "ar" ? "EN" : "ع"}</span>
    </Button>
  );
}

export function TopBar({ right, nav = false }: { right?: ReactNode; nav?: boolean }) {
  const { t } = useI18n();
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-2 px-3 sm:h-16 sm:px-4">
        <div className="min-w-0 flex-1 flex items-center gap-3 sm:gap-6">
          <Link to="/" className="min-w-0">
            <GlowMark />
          </Link>
          {nav && (
            <nav className="hidden items-center gap-1 md:flex" aria-label={t("التنقل الرئيسي", "Primary navigation")}>
              <a href="#features" className="rounded-xl border border-transparent px-3 py-2 text-xs font-semibold text-muted-foreground transition-[transform,background-color,border-color,box-shadow,color] duration-200 hover:-translate-y-0.5 hover:border-primary/15 hover:bg-gradient-to-r hover:from-primary/12 hover:to-accent/10 hover:text-foreground hover:shadow-[0_10px_24px_-18px_hsl(var(--primary)/0.9)]">
                {t("المزايا", "Features")}
              </a>
              <a href="#systems" className="rounded-xl border border-transparent px-3 py-2 text-xs font-semibold text-muted-foreground transition-[transform,background-color,border-color,box-shadow,color] duration-200 hover:-translate-y-0.5 hover:border-primary/15 hover:bg-gradient-to-r hover:from-primary/12 hover:to-accent/10 hover:text-foreground hover:shadow-[0_10px_24px_-18px_hsl(var(--primary)/0.9)]">
                {t("الأنظمة", "Systems")}
              </a>
              <a href="#commands" className="rounded-xl border border-transparent px-3 py-2 text-xs font-semibold text-muted-foreground transition-[transform,background-color,border-color,box-shadow,color] duration-200 hover:-translate-y-0.5 hover:border-primary/15 hover:bg-gradient-to-r hover:from-primary/12 hover:to-accent/10 hover:text-foreground hover:shadow-[0_10px_24px_-18px_hsl(var(--primary)/0.9)]">
                {t("الأوامر", "Commands")}
              </a>
            </nav>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <a
            href={SUPPORT_SERVER_URL}
            target="_blank"
            rel="noreferrer"
            className="hidden rounded-xl border border-transparent px-3 py-2 text-sm text-muted-foreground transition-[transform,background-color,border-color,color] duration-200 hover:-translate-y-0.5 hover:border-primary/15 hover:bg-primary/10 hover:text-primary md:block"
          >
            {t("سيرفر الدعم", "Support")}
          </a>
          <LangToggle />
          {right}
        </div>
      </div>
    </header>
  );
}
