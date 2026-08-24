import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import logo from "@/assets/glow-logo.png";
import { SUPPORT_SERVER_URL } from "@/lib/discord";
import { Globe } from "lucide-react";

export function GlowMark({ size = 36 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2">
      <img src={logo} alt="Glow" width={size} height={size} className="rounded-xl" />
      <span className="text-lg font-bold tracking-wide text-foreground">Glow</span>
    </span>
  );
}

export function LangToggle() {
  const { toggle, lang } = useI18n();
  return (
    <Button variant="ghost" size="sm" onClick={toggle} className="gap-1.5">
      <Globe className="size-4" />
      {lang === "ar" ? "EN" : "ع"}
    </Button>
  );
}

export function TopBar({ right }: { right?: ReactNode }) {
  const { t } = useI18n();
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4">
        <Link to="/">
          <GlowMark />
        </Link>
        <div className="flex items-center gap-2">
          <a
            href={SUPPORT_SERVER_URL}
            target="_blank"
            rel="noreferrer"
            className="hidden text-sm text-muted-foreground transition-colors hover:text-primary sm:block"
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
