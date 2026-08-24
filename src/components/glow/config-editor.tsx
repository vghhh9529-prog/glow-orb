import { useI18n } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

export interface Option {
  id: string;
  name: string;
}

interface Ctx {
  roles: Option[];
  channels: Option[];
}

const LABELS: Record<string, [string, string]> = {
  channelId: ["الروم", "Channel"],
  logChannelId: ["روم السجلات", "Log channel"],
  lobbyChannelId: ["روم الإنشاء", "Lobby channel"],
  categoryId: ["الكاتيجوري", "Category"],
  message: ["الرسالة", "Message"],
  enabled: ["مفعّل", "Enabled"],
  mentionUser: ["منشن العضو", "Mention member"],
  deleteAfterSeconds: ["حذف بعد (ثانية)", "Delete after (s)"],
  embed: ["الإمبد", "Embed"],
  card: ["كرت الترحيب", "Welcome card"],
  dm: ["رسالة خاصة", "Direct message"],
  leave: ["رسالة المغادرة", "Leave message"],
  title: ["العنوان", "Title"],
  description: ["الوصف", "Description"],
  color: ["اللون", "Color"],
  thumbnailAvatar: ["صورة العضو كثامبنيل", "Avatar as thumbnail"],
  imageUrl: ["رابط صورة", "Image URL"],
  footer: ["الفوتر", "Footer"],
  background: ["الخلفية", "Background"],
  avatarX: ["موضع الأفتار X", "Avatar X"],
  avatarY: ["موضع الأفتار Y", "Avatar Y"],
  avatarSize: ["حجم الأفتار", "Avatar size"],
  textX: ["موضع النص X", "Text X"],
  textY: ["موضع النص Y", "Text Y"],
  text: ["النص", "Text"],
  textColor: ["لون النص", "Text color"],
  xp: ["نقاط الخبرة", "XP"],
  announce: ["إعلان الترقية", "Level-up announce"],
  rewards: ["مكافآت الرولات", "Role rewards"],
  exclusions: ["الاستثناءات", "Exclusions"],
  roles: ["الرولات", "Roles"],
  textChannels: ["الرومات الكتابية", "Text channels"],
  voiceChannels: ["الرومات الصوتية", "Voice channels"],
  userRoles: ["رولات الأعضاء", "Member roles"],
  botRoles: ["رولات البوتات", "Bot roles"],
  exemptRoles: ["رولات مستثناة", "Exempt roles"],
  exemptChannels: ["رومات مستثناة", "Exempt channels"],
  whitelist: ["القائمة البيضاء", "Whitelist"],
  presets: ["الفلاتر", "Filters"],
  rules: ["القواعد", "Rules"],
  punishment: ["العقوبة", "Punishment"],
  action: ["الإجراء", "Action"],
  limit: ["الحد", "Limit"],
  windowSeconds: ["المدة (ثانية)", "Window (s)"],
  timeoutSeconds: ["مدة الميوت (ثانية)", "Timeout (s)"],
  words: ["الكلمات الممنوعة", "Blocked words"],
  allowlist: ["روابط مسموحة", "Allowed links"],
  percent: ["النسبة %", "Percent %"],
  nameTemplate: ["قالب الاسم", "Name template"],
  defaultUserLimit: ["حد الأعضاء", "User limit"],
  panelEnabled: ["تفعيل اللوحة", "Enable panel"],
  panelChannelId: ["قناة لوحة التذاكر", "Panel channel"],
  transcriptChannelId: ["قناة السجلات", "Transcript channel"],
  supportRoleIds: ["رولات فريق الدعم", "Support roles"],
  panelTitle: ["عنوان اللوحة", "Panel title"],
  panelDescription: ["وصف اللوحة", "Panel description"],
  panelColor: ["لون اللوحة", "Panel color"],
  ticketName: ["قالب اسم التذكرة", "Ticket name template"],
  notifyStaff: ["تنبيه فريق الدعم", "Notify support team"],
  allowClaim: ["السماح باستلام التذكرة", "Allow claiming"],
  allowPriorityChange: ["السماح بتغيير الأولوية", "Allow priority changes"],
  requireSubject: ["إلزام موضوع التذكرة", "Require ticket subject"],
  requireDetails: ["إلزام تفاصيل الطلب", "Require ticket details"],
  maxOpenPerUser: ["أقصى تذاكر مفتوحة للعضو", "Max open tickets per user"],
  transcriptEnabled: ["حفظ السجل", "Save transcript"],
  deleteWhenEmpty: ["حذف عند الفراغ", "Delete when empty"],
  allowRename: ["السماح بتغيير الاسم", "Allow rename"],
  allowLock: ["السماح بالقفل", "Allow lock"],
  memberUpdate: ["تغييرات الأعضاء", "Member updates"],
  massRoleChange: ["تغيير رولات جماعي", "Mass role changes"],
  webhookCreate: ["إنشاء Webhook", "Webhook creation"],
  enabledEvents: ["أنواع الأحداث", "Enabled events"],
  includeBots: ["تسجيل أحداث البوتات", "Log bot events"],
  includeMessageContent: ["حفظ محتوى الرسائل", "Include message content"],
  ignoredChannelIds: ["قنوات مستثناة من اللوق", "Ignored channels"],
  ignoredRoleIds: ["رولات مستثناة من اللوق", "Ignored roles"],
  colors: ["ألوان اللوقات", "Log colors"],
  moderation: ["الإشراف", "Moderation"],
  member: ["الأعضاء", "Members"],
  channel: ["القنوات", "Channels"],
  role: ["الرولات", "Roles"],
  voice: ["الصوت", "Voice"],
  ticket: ["التذاكر", "Tickets"],
  system: ["النظام", "System"],
  globalCooldownSeconds: ["التبريد العام (ثانية)", "Global cooldown (s)"],
  ignoreBots: ["تجاهل البوتات", "Ignore bots"],
  deleteTrigger: ["حذف رسالة الأمر", "Delete trigger"],
  delaySeconds: ["التأخير (ثانية)", "Delay (s)"],
  reapplyOnRejoin: ["إعادة الرول عند العودة", "Re-apply on rejoin"],
  requirePassRules: ["يتطلب قبول القوانين", "Require rules screening"],
};

const PUNISHMENTS = ["removeRoles", "kick", "ban", "timeout", "none"];
const ACTIONS = ["block", "timeout", "delete", "log"];
const LOG_EVENT_OPTIONS: Option[] = [
  { id: "messageDelete", name: "Message deleted" },
  { id: "messageUpdate", name: "Message edited" },
  { id: "memberJoin", name: "Member joined" },
  { id: "memberLeave", name: "Member left" },
  { id: "memberBan", name: "Member banned" },
  { id: "memberUnban", name: "Member unbanned" },
  { id: "roleCreate", name: "Role created" },
  { id: "roleDelete", name: "Role deleted" },
  { id: "roleUpdate", name: "Role updated" },
  { id: "channelCreate", name: "Channel created" },
  { id: "channelDelete", name: "Channel deleted" },
  { id: "channelUpdate", name: "Channel updated" },
  { id: "voiceState", name: "Voice activity" },
  { id: "ticket", name: "Ticket activity" },
  { id: "moderation", name: "Moderation activity" },
];

function label(key: string, t: (a: string, e: string) => string) {
  const found = LABELS[key];
  if (found) return t(found[0], found[1]);
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}

function isRoleKey(k: string) {
  return /role/i.test(k) && !/roleMultipliers/.test(k);
}
function isChannelKey(k: string) {
  return /channel|categoryId/i.test(k);
}

function MultiSelect({
  value,
  options,
  onChange,
  placeholder,
}: {
  value: string[];
  options: Option[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const remaining = options.filter((o) => !value.includes(o.id));
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {value.map((id) => (
          <Badge key={id} variant="secondary" className="gap-1">
            {options.find((o) => o.id === id)?.name ?? id}
            <button type="button" onClick={() => onChange(value.filter((v) => v !== id))}>
              <X className="size-3" />
            </button>
          </Badge>
        ))}
      </div>
      <Select value="" onValueChange={(v) => onChange([...value, v])}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {remaining.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function StringList({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {value.map((item, i) => (
          <Badge key={`${item}-${i}`} variant="secondary" className="gap-1">
            {item}
            <button type="button" onClick={() => onChange(value.filter((_, idx) => idx !== i))}>
              <X className="size-3" />
            </button>
          </Badge>
        ))}
      </div>
      <Input
        placeholder={placeholder}
        onKeyDown={(e) => {
          const el = e.currentTarget;
          if (e.key === "Enter" && el.value.trim()) {
            e.preventDefault();
            onChange([...value, el.value.trim()]);
            el.value = "";
          }
        }}
      />
    </div>
  );
}

function Field({
  name,
  value,
  ctx,
  onChange,
}: {
  name: string;
  value: unknown;
  ctx: Ctx;
  onChange: (v: unknown) => void;
}) {
  const { t } = useI18n();
  const title = label(name, t);

  if (typeof value === "boolean") {
    return (
      <div className="flex min-h-[4.25rem] items-center justify-between gap-4 rounded-2xl border border-border/60 bg-gradient-to-br from-card/70 to-background/35 px-4 py-3 shadow-sm transition-colors hover:border-primary/35">
        <div className="min-w-0">
          <Label className="block truncate text-sm font-semibold text-foreground">{title}</Label>
          <span className={`mt-1 block text-[11px] font-medium ${value ? "text-success" : "text-muted-foreground"}`}>
            {value ? t("مفعل ويُحفظ الآن", "Enabled and persisted") : t("معطل لكن إعداداته محفوظة", "Disabled but settings are saved")}
          </span>
        </div>
        <Switch checked={value} onCheckedChange={onChange} aria-label={title} />
      </div>
    );
  }

  if (typeof value === "number") {
    return (
      <div className="flex min-h-[4.25rem] flex-col justify-between gap-1.5">
        <Label className="text-xs font-semibold text-muted-foreground">{title}</Label>
        <Input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} />
      </div>
    );
  }

  if (Array.isArray(value)) {
    if (value.every((v) => typeof v === "string")) {
      const opts = name === "enabledEvents"
        ? LOG_EVENT_OPTIONS
        : isRoleKey(name)
          ? ctx.roles
          : isChannelKey(name)
            ? ctx.channels
            : null;
      return (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{title}</Label>
          {opts ? (
            <MultiSelect
              value={value as string[]}
              options={opts}
              onChange={onChange}
              placeholder={t("اختر…", "Select…")}
            />
          ) : (
            <StringList
              value={value as string[]}
              onChange={onChange}
              placeholder={t("اكتب واضغط Enter", "Type and press Enter")}
            />
          )}
        </div>
      );
    }
    return null;
  }

  if (value && typeof value === "object") {
    return (
      <div className="space-y-3 rounded-xl border border-border/60 bg-card/30 p-3">
        <p className="text-sm font-semibold text-primary">{title}</p>
        <ObjectFields
          data={value as Record<string, unknown>}
          ctx={ctx}
          onChange={(next) => onChange(next)}
        />
      </div>
    );
  }

  // strings
  const str = String(value ?? "");
  if (name === "punishment" || name === "action") {
    const list = name === "punishment" ? PUNISHMENTS : ACTIONS;
    return (
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">{title}</Label>
        <Select value={str} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {list.map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (isChannelKey(name) || (isRoleKey(name) && name.endsWith("Id"))) {
    const opts = isChannelKey(name) ? ctx.channels : ctx.roles;
    return (
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">{title}</Label>
        <Select value={str || "__none"} onValueChange={(v) => onChange(v === "__none" ? "" : v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">{t("بدون", "None")}</SelectItem>
            {opts.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (name === "color" || name.endsWith("Color")) {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">{title}</Label>
        <div className="flex gap-2">
          <Input
            type="color"
            value={str || "#3B9DF8"}
            onChange={(e) => onChange(e.target.value)}
            className="h-10 w-14 p-1"
          />
          <Input value={str} onChange={(e) => onChange(e.target.value)} />
        </div>
      </div>
    );
  }

  const long = name === "message" || name === "description" || str.length > 60;
  return (
    <div className="flex min-h-[4.25rem] flex-col gap-1.5">
      <Label className="text-xs font-semibold text-muted-foreground">{title}</Label>
      {long ? (
        <Textarea rows={3} value={str} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Input value={str} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

function ObjectFields({
  data,
  ctx,
  onChange,
}: {
  data: Record<string, unknown>;
  ctx: Ctx;
  onChange: (next: Record<string, unknown>) => void;
}) {
  return (
    <div className="grid items-stretch gap-4 md:grid-cols-2">
      {Object.entries(data).map(([key, value]) => {
        if (key === "panelMessageId") return null;
        const wide =
          (value && typeof value === "object" && !Array.isArray(value)) ||
          key === "message" ||
          key === "description";
        return (
          <div key={key} className={`${wide ? "md:col-span-2" : ""} h-full`}>
            <Field
              name={key}
              value={value}
              ctx={ctx}
              onChange={(v) => onChange({ ...data, [key]: v })}
            />
          </div>
        );
      })}
    </div>
  );
}

export function ConfigEditor({
  config,
  roles,
  channels,
  onChange,
}: {
  config: Record<string, unknown>;
  roles: Option[];
  channels: Option[];
  onChange: (next: Record<string, unknown>) => void;
}) {
  return <ObjectFields data={config} ctx={{ roles, channels }} onChange={onChange} />;
}
