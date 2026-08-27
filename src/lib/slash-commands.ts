/** Global slash commands registered for the Glow application. */
export const SLASH_COMMANDS = [
  {
    name: "daily",
    description: "استلم مكافأة Glow Coin اليومية (كل 12 ساعة)",
    type: 1,
  },
  {
    name: "balance",
    description: "اعرض رصيدك من عملة Glow Coin",
    type: 1,
    options: [{ name: "user", description: "عضو آخر", type: 6, required: false }],
  },
  {
    name: "rank",
    description: "اعرض مستواك ونقاط الخبرة في السيرفر",
    type: 1,
    options: [{ name: "user", description: "عضو آخر", type: 6, required: false }],
  },
  {
    name: "leaderboard",
    description: "أفضل الأعضاء في السيرفر",
    type: 1,
    options: [
      {
        name: "scope",
        description: "النطاق الزمني",
        type: 3,
        required: false,
        choices: [
          { name: "الكل", value: "all" },
          { name: "يومي", value: "daily" },
          { name: "أسبوعي", value: "weekly" },
          { name: "شهري", value: "monthly" },
        ],
      },
    ],
  },
  {
    name: "suggest",
    description: "قدّم اقتراحاً للسيرفر",
    type: 1,
    options: [
      { name: "content", description: "نص الاقتراح", type: 3, required: true },
      { name: "anonymous", description: "إخفاء اسمك", type: 5, required: false },
      { name: "image", description: "رابط صورة", type: 3, required: false },
    ],
  },
  {
    name: "glow",
    description: "معلومات بوت Glow ورابط الداشبورد",
    type: 1,
  },
  {
    name: "profile",
    description: "ملفك الشخصي في Glow",
    type: 1,
  },
  {
    name: "server",
    description: "اعرض معلومات السيرفر الحالية",
    type: 1,
  },
  {
    name: "user",
    description: "اعرض معلومات عضو في السيرفر",
    type: 1,
    options: [{ name: "member", description: "العضو المطلوب", type: 6, required: false }],
  },
  {
    name: "roles",
    description: "اعرض رولات السيرفر الحالية",
    type: 1,
  },
  {
    name: "colors",
    description: "اعرض ألوان الرولات المتاحة",
    type: 1,
  },
  {
    name: "points-list",
    description: "اعرض نقاطك في Glow Coin",
    type: 1,
  },
  {
    name: "roll",
    description: "ارم نرداً من ستة أوجه",
    type: 1,
  },
  {
    name: "top",
    description: "اعرض أعلى أعضاء السيرفر",
    type: 1,
  },
  {
    name: "banner",
    description: "اعرض بانر عضو",
    type: 1,
    options: [{ name: "member", description: "العضو المطلوب", type: 6, required: false }],
  },
  {
    name: "server-avatar",
    description: "اعرض صورة السيرفر",
    type: 1,
  },
  {
    name: "server-banner",
    description: "اعرض بانر السيرفر",
    type: 1,
  },
  {
    name: "clear",
    description: "نظف رسائل القناة الحالية",
    type: 1,
    options: [{ name: "amount", description: "عدد الرسائل (1-100)", type: 4, required: true, min_value: 1, max_value: 100 }],
  },
  {
    name: "kick",
    description: "اطرد عضواً من السيرفر",
    type: 1,
    options: [
      { name: "member", description: "العضو المطلوب", type: 6, required: true },
      { name: "reason", description: "سبب الطرد", type: 3, required: false },
    ],
  },
  {
    name: "ban",
    description: "احظر عضواً من السيرفر",
    type: 1,
    options: [
      { name: "member", description: "العضو المطلوب", type: 6, required: true },
      { name: "reason", description: "سبب الحظر", type: 3, required: false },
    ],
  },
  {
    name: "unban",
    description: "ارفع الحظر عن مستخدم",
    type: 1,
    options: [
      { name: "user_id", description: "معرّف المستخدم المحظور", type: 3, required: true },
      { name: "reason", description: "سبب رفع الحظر", type: 3, required: false },
    ],
  },
  {
    name: "timeout",
    description: "أعط عضواً تايم أوت",
    type: 1,
    options: [
      { name: "member", description: "العضو المطلوب", type: 6, required: true },
      { name: "minutes", description: "المدة بالدقائق (1-40320)", type: 4, required: true, min_value: 1, max_value: 40320 },
      { name: "reason", description: "السبب", type: 3, required: false },
    ],
  },
  {
    name: "untimeout",
    description: "ألغِ التايم أوت عن عضو",
    type: 1,
    options: [
      { name: "member", description: "العضو المطلوب", type: 6, required: true },
      { name: "reason", description: "السبب", type: 3, required: false },
    ],
  },
  {
    name: "warn-add",
    description: "سجّل تحذيراً على عضو",
    type: 1,
    options: [
      { name: "member", description: "العضو المطلوب", type: 6, required: true },
      { name: "reason", description: "سبب التحذير", type: 3, required: true },
    ],
  },
  {
    name: "warnings",
    description: "اعرض تحذيرات عضو",
    type: 1,
    options: [{ name: "member", description: "العضو المطلوب", type: 6, required: false }],
  },
  {
    name: "ping",
    description: "تحقق من اتصال Glow وسرعة الاستجابة",
    type: 1,
  },
  {
    name: "avatar",
    description: "اعرض رابط صورة العضو",
    type: 1,
    options: [{ name: "member", description: "العضو المطلوب", type: 6, required: false }],
  },
  {
    name: "get-emojis",
    description: "اعرض الإيموجيات المخصصة في السيرفر",
    type: 1,
  },
  {
    name: "color-set",
    description: "اختر لوناً من الرولات الملونة المتاحة",
    type: 1,
    options: [{ name: "number", description: "رقم اللون من قائمة /colors", type: 4, required: true, min_value: 1, max_value: 20 }],
  },
  {
    name: "invites",
    description: "اعرض دعوات السيرفر الحالية",
    type: 1,
  },
  {
    name: "reset",
    description: "أعد تعيين XP عضو أو السيرفر بالكامل",
    type: 1,
    options: [{ name: "member", description: "عضو محدد (اختياري)", type: 6, required: false }],
  },
  {
    name: "setlevel",
    description: "عيّن مستوى عضو",
    type: 1,
    options: [
      { name: "member", description: "العضو المطلوب", type: 6, required: true },
      { name: "level", description: "المستوى", type: 4, required: true, min_value: 0, max_value: 10000 },
    ],
  },
  {
    name: "setxp",
    description: "عيّن XP عضو",
    type: 1,
    options: [
      { name: "member", description: "العضو المطلوب", type: 6, required: true },
      { name: "xp", description: "نقاط الخبرة", type: 4, required: true, min_value: 0, max_value: 1000000000 },
    ],
  },
  {
    name: "hide",
    description: "أخفِ قناة عن الأعضاء",
    type: 1,
    options: [{ name: "channel", description: "القناة (اختياري)", type: 7, required: false }],
  },
  {
    name: "show",
    description: "أظهر قناة للأعضاء",
    type: 1,
    options: [{ name: "channel", description: "القناة (اختياري)", type: 7, required: false }],
  },
  {
    name: "lock",
    description: "امنع الكتابة مؤقتاً في قناة",
    type: 1,
    options: [{ name: "channel", description: "القناة (اختياري)", type: 7, required: false }],
  },
  {
    name: "unlock",
    description: "اسمح بالكتابة في قناة",
    type: 1,
    options: [{ name: "channel", description: "القناة (اختياري)", type: 7, required: false }],
  },
  {
    name: "slowmode",
    description: "اضبط Slowmode للقناة",
    type: 1,
    options: [{ name: "seconds", description: "الثواني (0-21600)", type: 4, required: true, min_value: 0, max_value: 21600 }],
  },
  {
    name: "inrole",
    description: "اعرض أعضاء رول محدد",
    type: 1,
    options: [{ name: "role", description: "الرول المطلوب", type: 8, required: true }],
  },
  {
    name: "move",
    description: "انقل عضواً إلى روم صوتي",
    type: 1,
    options: [
      { name: "member", description: "العضو المطلوب", type: 6, required: true },
      { name: "channel", description: "الروم الصوتي", type: 7, required: true },
    ],
  },
  {
    name: "mute-check",
    description: "تحقق من حالة Timeout عضو",
    type: 1,
    options: [{ name: "member", description: "العضو المطلوب", type: 6, required: true }],
  },
  {
    name: "role",
    description: "أضف أو أزل رولاً من عضو",
    type: 1,
    options: [
      { name: "member", description: "العضو المطلوب", type: 6, required: true },
      { name: "role", description: "الرول المطلوب", type: 8, required: true },
      { name: "action", description: "الإجراء", type: 3, required: true, choices: [{ name: "إضافة", value: "add" }, { name: "إزالة", value: "remove" }] },
    ],
  },
  {
    name: "rar",
    description: "أزل كل الرولات القابلة للإدارة من عضو",
    type: 1,
    options: [{ name: "member", description: "العضو المطلوب", type: 6, required: true }],
  },
  {
    name: "setnick",
    description: "غيّر أو أزل الاسم المستعار لعضو",
    type: 1,
    options: [
      { name: "member", description: "العضو المطلوب", type: 6, required: true },
      { name: "nickname", description: "الاسم الجديد، اتركه فارغاً للإزالة", type: 3, required: false, max_length: 32 },
    ],
  },
  {
    name: "vkick",
    description: "افصل عضواً من الروم الصوتي",
    type: 1,
    options: [{ name: "member", description: "العضو المطلوب", type: 6, required: true }],
  },
  {
    name: "warn-remove",
    description: "أزل تحذيرات عضو أو السيرفر",
    type: 1,
    options: [{ name: "member", description: "عضو محدد (اختياري)", type: 6, required: false }],
  },
  {
    name: "points",
    description: "إدارة رصيد Glow Coin لعضو",
    type: 1,
    options: [
      { name: "member", description: "العضو المطلوب", type: 6, required: true },
      { name: "amount", description: "المقدار", type: 4, required: true, min_value: 0, max_value: 1000000000 },
      { name: "action", description: "الإجراء", type: 3, required: true, choices: [{ name: "إضافة", value: "add" }, { name: "إزالة", value: "remove" }, { name: "تعيين", value: "set" }] },
    ],
  },
  {
    name: "points-reset",
    description: "أعد تعيين رصيد Glow Coin لعضو محدد",
    type: 1,
    options: [{ name: "member", description: "العضو المطلوب", type: 6, required: true }],
  },
  {
    name: "help",
    description: "اعرض أوامر Glow المتاحة",
    type: 1,
  },
] as const;
