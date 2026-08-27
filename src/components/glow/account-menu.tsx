import { Link } from "@tanstack/react-router";
import { ChevronDown, CircleUserRound, Gift, LogOut, Server } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { userAvatarUrl } from "@/lib/discord";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GlowCoinIcon } from "./coin-icon";

interface AccountMenuUser {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
}

export function AccountMenu({ user, onSignOut }: { user: AccountMenuUser; onSignOut?: () => void | Promise<void> }) {
  const { t } = useI18n();
  const displayName = user.global_name ?? user.username;

  return (
    <DropdownMenu dir="ltr">
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-10 gap-2 rounded-xl px-1.5 sm:px-2" aria-label={t("فتح قائمة الحساب", "Open account menu")}>
          <img src={userAvatarUrl(user.id, user.avatar)} alt="" className="size-8 rounded-full ring-2 ring-primary/40" />
          <span className="hidden max-w-28 truncate text-xs font-semibold text-foreground sm:block">{displayName}</span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="truncate">{displayName}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/dashboard/account">
            <CircleUserRound />
            {t("ملفي الشخصي", "My profile")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/dashboard">
            <Server />
            {t("السيرفرات", "My servers")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void onSignOut?.()}>
          <LogOut />
          {t("تسجيل الخروج", "Sign out")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="font-semibold text-primary focus:text-primary">
          <a href="/dashboard/account#daily">
            <GlowCoinIcon className="size-5" />
            <Gift className="size-4" />
            {t("Glow Coin Daily", "Glow Coin Daily")}
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
