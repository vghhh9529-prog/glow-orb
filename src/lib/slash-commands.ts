/** Global slash commands registered for the Glow application. */
export const SLASH_COMMANDS = [
  {
    name: "daily",
    description: "استلم مكافأة Glow اليومية (كل 12 ساعة)",
    type: 1,
  },
  {
    name: "balance",
    description: "اعرض رصيدك من عملة Glow",
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
    description: "اعرض نقاطك في Glow",
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
    name: "help",
    description: "اعرض أوامر Glow المتاحة",
    type: 1,
  },
] as const;
