import type { ModuleKey } from "./discord";

export const MODULE_DEFAULTS: Record<ModuleKey, Record<string, unknown>> = {
  welcome: {
    channelId: "",
    message: "أهلاً {user} في **{server}**! أنت العضو رقم {membercount} ✨",
    mentionUser: true,
    deleteAfterSeconds: 0,
    embed: {
      enabled: true,
      title: "مرحباً {username}",
      description: "نورت {server}! لا تنسى تقرأ القوانين.",
      color: "#3B9DF8",
      thumbnailAvatar: true,
      imageUrl: "",
      footer: "عضو رقم {membercount}",
    },
    card: {
      enabled: false,
      background: "",
      avatarX: 50,
      avatarY: 50,
      avatarSize: 128,
      textX: 50,
      textY: 78,
      text: "Welcome {username}",
      textColor: "#FFFFFF",
    },
    dm: { enabled: false, message: "أهلاً بك في {server}!" },
    leave: { enabled: false, channelId: "", message: "{username} غادر السيرفر 👋" },
  },
  leveling: {
    announce: {
      mode: "channel",
      channelId: "",
      message: "🎉 مبروك {user}! وصلت للمستوى **{level}**",
      embedEnabled: true,
      embedColor: "#3B9DF8",
      deleteAfterSeconds: 0,
    },
    rewards: [] as Array<{ level: number; roleId: string; removePrevious: boolean }>,
    exclusions: { roles: [] as string[], textChannels: [] as string[], voiceChannels: [] as string[] },
    roleMultipliers: [] as Array<{ roleId: string; multiplier: number }>,
    channelMultipliers: [] as Array<{ channelId: string; multiplier: number }>,
    xp: {
      textMin: 15,
      textMax: 25,
      textCooldown: 60,
      voicePerMinuteMin: 5,
      voicePerMinuteMax: 10,
      voiceCooldown: 60,
      reactionXp: 2,
      reactionCooldown: 120,
      curve: 100,
    },
    voiceRestrictions: { allowMuted: false, allowDeafened: false, minMembers: 2 },
    resets: { dailyHour: 0, weeklyDay: 1, monthlyDay: 1 },
    resetOnLeave: false,
    resetOnBan: true,
    publicLeaderboard: true,
  },
  suggestions: {
    channels: { suggestionsId: "", logsId: "", reviewId: "" },
    permissions: { manageRoles: [] as string[], submitRoles: [] as string[], voteRoles: [] as string[] },
    features: {
      requireReview: false,
      allowAnonymous: true,
      createThread: true,
      allowImages: true,
      dmOnDecision: true,
    },
    voting: { mode: "reactions", reactions: ["👍", "👎"] },
    limits: { cooldownSeconds: 300, minLength: 10, maxLength: 1000, maxPerDay: 5 },
    colors: { pending: "#3498db", approved: "#2ecc71", denied: "#e74c3c", implemented: "#9b59b6" },
  },
  autoroles: {
    userRoles: [] as string[],
    botRoles: [] as string[],
    delaySeconds: 0,
    requirePassRules: false,
    reapplyOnRejoin: true,
  },
  tempvoice: {
    lobbyChannelId: "",
    categoryId: "",
    nameTemplate: "🔊 روم {username}",
    defaultUserLimit: 0,
    panelEnabled: true,
    deleteWhenEmpty: true,
    allowRename: true,
    allowLock: true,
  },
  autoreply: {
    globalCooldownSeconds: 5,
    ignoreBots: true,
    deleteTrigger: false,
  },
  autointeraction: {
    ignoreBots: true,
  },
  automod: {
    logChannelId: "",
    exemptRoles: [] as string[],
    exemptChannels: [] as string[],
    presets: {
      spam: { enabled: false, action: "block", timeoutSeconds: 60 },
      mentionSpam: { enabled: false, limit: 5, action: "block", timeoutSeconds: 300 },
      badWords: { enabled: false, words: [] as string[], action: "block", timeoutSeconds: 0 },
      invites: { enabled: false, action: "block", timeoutSeconds: 0 },
      links: { enabled: false, action: "block", allowlist: [] as string[] },
      caps: { enabled: false, percent: 70, action: "block" },
      emojiSpam: { enabled: false, limit: 8, action: "block" },
    },
  },
  protection: {
    logChannelId: "",
    whitelist: [] as string[],
    punishment: "removeRoles",
    rules: {
      channelDelete: { enabled: false, limit: 2, windowSeconds: 20, punishment: "kick" },
      channelCreate: { enabled: false, limit: 3, windowSeconds: 20, punishment: "removeRoles" },
      roleDelete: { enabled: false, limit: 2, windowSeconds: 20, punishment: "kick" },
      roleCreate: { enabled: false, limit: 3, windowSeconds: 20, punishment: "removeRoles" },
      ban: { enabled: false, limit: 3, windowSeconds: 30, punishment: "ban" },
      kick: { enabled: false, limit: 4, windowSeconds: 30, punishment: "removeRoles" },
      webhook: { enabled: false, limit: 2, windowSeconds: 30, punishment: "removeRoles" },
      botAdd: { enabled: false, limit: 1, windowSeconds: 60, punishment: "kick" },
      everyoneMention: { enabled: false, limit: 1, windowSeconds: 30, punishment: "timeout" },
      serverUpdate: { enabled: false, limit: 2, windowSeconds: 60, punishment: "removeRoles" },
    },
  },
  customcommands: {
    prefix: "!",
    ignoreBots: true,
    deleteTrigger: false,
    cooldownSeconds: 3,
  },
  commands: {
    disabled: [] as string[],
  },
};

export function withDefaults(module: ModuleKey, config: unknown): Record<string, unknown> {
  const base = MODULE_DEFAULTS[module];
  if (!config || typeof config !== "object") return structuredClone(base);
  return deepMerge(structuredClone(base), config as Record<string, unknown>);
}

function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  for (const [key, value] of Object.entries(source)) {
    const existing = target[key];
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      existing &&
      typeof existing === "object" &&
      !Array.isArray(existing)
    ) {
      target[key] = deepMerge(existing as Record<string, unknown>, value as Record<string, unknown>);
    } else {
      target[key] = value;
    }
  }
  return target;
}

export const PLACEHOLDERS = [
  { token: "{user}", ar: "منشن العضو", en: "Mentions the member" },
  { token: "{username}", ar: "اسم العضو", en: "Member username" },
  { token: "{userid}", ar: "أيدي العضو", en: "Member ID" },
  { token: "{avatar}", ar: "رابط صورة العضو", en: "Member avatar URL" },
  { token: "{server}", ar: "اسم السيرفر", en: "Server name" },
  { token: "{membercount}", ar: "عدد الأعضاء", en: "Member count" },
  { token: "{level}", ar: "المستوى الجديد", en: "New level" },
  { token: "{xp}", ar: "نقاط الخبرة", en: "XP amount" },
  { token: "{rank}", ar: "الترتيب", en: "Leaderboard rank" },
];
