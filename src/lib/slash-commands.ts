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
