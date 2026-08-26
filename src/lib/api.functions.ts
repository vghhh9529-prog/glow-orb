import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { MODULE_KEYS, type ModuleKey } from "./discord";
import { z } from "zod";

const discordId = z.string().regex(/^\d{15,20}$/, "Invalid Discord ID");
const itemKind = z.string().regex(/^[a-z][a-z0-9_-]{0,48}$/i, "Invalid item kind");
const text = (max: number) => z.string().max(max);
const jsonRecord = z
  .record(z.string().max(80), z.unknown())
  .refine((value) => JSON.stringify(value).length <= 64_000, "JSON payload is too large");
const moduleKey = z.enum(MODULE_KEYS);
const guildInput = z.object({ guildId: discordId });

export const getMe = createServerFn({ method: "GET" }).handler(async () => {
  const { getSessionUser } = await import("./session.server");
  return getSessionUser();
});

export const getMyProfile = createServerFn({ method: "GET" }).handler(async () => {
  const { getMyProfile: loadProfile } = await import("./profile.server");
  return loadProfile();
});

export const signOut = createServerFn({ method: "POST" }).handler(async () => {
  const { currentSessionToken, SESSION_COOKIE } = await import("./session.server");
  const token = currentSessionToken();
  if (token) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("app_sessions").delete().eq("token", token);
  }
  setResponseHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
  );
  return { ok: true };
});

export const listGuilds = createServerFn({ method: "GET" }).handler(async () => {
  const { listManageableGuilds } = await import("./guilds.server");
  return listManageableGuilds();
});

export const getWorkspace = createServerFn({ method: "GET" })
  .inputValidator((data) => guildInput.parse(data))
  .handler(async ({ data }) => {
    const { loadGuildWorkspace } = await import("./guilds.server");
    return (await loadGuildWorkspace(data.guildId)) as unknown as string;
  });

export const getOverview = createServerFn({ method: "GET" })
  .inputValidator((data) => guildInput.parse(data))
  .handler(async ({ data }) => {
    const { guildOverview } = await import("./guilds.server");
    return guildOverview(data.guildId);
  });

export const saveModule = createServerFn({ method: "POST" })
  .inputValidator(
    (data) =>
      z
        .object({ guildId: discordId, module: moduleKey, enabled: z.boolean(), config: jsonRecord })
        .parse(data),
  )
  .handler(async ({ data }) => {
    const { saveModuleConfig } = await import("./guilds.server");
    const result = await saveModuleConfig(data.guildId, data.module, data.enabled, data.config);
    if (data.module === "automod" && data.enabled) {
      const { syncAutoMod } = await import("./moderation.server");
      const sync = await syncAutoMod(data.guildId, data.config);
      return { ...result, sync };
    }
    return result;
  });

export const publishTicketPanel = createServerFn({ method: "POST" })
  .inputValidator((data) => guildInput.parse(data))
  .handler(async ({ data }) => {
    const { publishTicketPanel: publish } = await import("./tickets.server");
    return publish(data.guildId);
  });

export const provisionMessageGuard = createServerFn({ method: "POST" })
  .inputValidator(
    (data) =>
      z
        .object({
          guildId: discordId,
          channelName: z.string().trim().min(1).max(90),
          categoryId: discordId.or(z.literal("")),
          punishment: z.enum(["kick", "ban"]),
        })
        .parse(data),
  )
  .handler(async ({ data }) => {
    const { provisionMessageGuard: provision } = await import("./message-guard.server");
    return provision(data);
  });

export const submitScamReport = createServerFn({ method: "POST" })
  .inputValidator(
    (data) =>
      z
        .object({
          guildId: discordId,
          reportedUserId: discordId,
          description: z.string().trim().min(20).max(5000),
          evidenceKeys: z.array(z.string().min(1).max(220)).max(5),
        })
        .parse(data),
  )
  .handler(async ({ data }) => {
    const { submitScamReport: submit } = await import("./scam-reports.server");
    return submit(data);
  });

export const getScammerDirectory = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ guildId: discordId, query: z.string().trim().max(100).optional() }).parse(data))
  .handler(async ({ data }) => {
    const { listScammerDirectory } = await import("./scam-reports.server");
    return listScammerDirectory(data.guildId, data.query ?? "");
  });

export const getScammerReports = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ guildId: discordId, reportedUserId: discordId }).parse(data))
  .handler(async ({ data }) => {
    const { listScammerReports } = await import("./scam-reports.server");
    return listScammerReports(data.guildId, data.reportedUserId);
  });

export const getItems = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ guildId: discordId, kind: itemKind }).parse(data))
  .handler(async ({ data }) => {
    const { listGuildItems } = await import("./guilds.server");
    return listGuildItems(data.guildId, data.kind);
  });

export const saveItem = createServerFn({ method: "POST" })
  .inputValidator(
    (data) =>
      z
        .object({
          guildId: discordId,
          kind: itemKind,
          id: z.string().uuid().optional(),
          name: text(100),
          enabled: z.boolean(),
          data: jsonRecord,
        })
        .parse(data),
  )
  .handler(async ({ data }) => {
    const { upsertGuildItem } = await import("./guilds.server");
    return upsertGuildItem({
      ...data,
      ...(data.id !== undefined ? { id: data.id } : {}),
    });
  });

export const removeItem = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ guildId: discordId, id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { deleteGuildItem } = await import("./guilds.server");
    return deleteGuildItem(data.guildId, data.id);
  });

export const getCases = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ guildId: discordId, filter: text(32) }).parse(data))
  .handler(async ({ data }) => {
    const { listCases } = await import("./moderation.server");
    return listCases(data.guildId, data.filter);
  });

export const addCase = createServerFn({ method: "POST" })
  .inputValidator(
    (data) =>
      z
        .object({
          guildId: discordId,
          action: z.string().regex(/^[a-z_-]{1,32}$/i),
          targetId: discordId,
          targetName: text(100).optional(),
          reason: text(500),
          durationMinutes: z.number().int().min(1).max(40320).optional(),
        })
        .parse(data),
  )
  .handler(async ({ data }) => {
    const { createCase } = await import("./moderation.server");
    return createCase({
      ...data,
      ...(data.targetName !== undefined ? { targetName: data.targetName } : {}),
      ...(data.durationMinutes !== undefined ? { durationMinutes: data.durationMinutes } : {}),
    });
  });

export const revokeModerationCase = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ guildId: discordId, caseId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { revokeCase } = await import("./moderation.server");
    return revokeCase(data.guildId, data.caseId);
  });

export const getAutoModRules = createServerFn({ method: "GET" })
  .inputValidator((data) => guildInput.parse(data))
  .handler(async ({ data }) => {
    const { currentAutoModRules } = await import("./moderation.server");
    return currentAutoModRules(data.guildId);
  });

export const getSuggestions = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ guildId: discordId, status: text(32) }).parse(data))
  .handler(async ({ data }) => {
    const { listSuggestions } = await import("./moderation.server");
    return listSuggestions(data.guildId, data.status);
  });

export const updateSuggestion = createServerFn({ method: "POST" })
  .inputValidator(
    (data) =>
      z
        .object({ guildId: discordId, id: z.string().uuid(), status: text(32), note: text(1000) })
        .parse(data),
  ).handler(async ({ data }) => {
    const { setSuggestionStatus } = await import("./moderation.server");
    return setSuggestionStatus(data.guildId, data.id, data.status, data.note);
  });

export const getGuildLeaderboard = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ guildId: discordId, scope: text(16) }).parse(data))
  .handler(async ({ data }) => {
    const { guildLeaderboard } = await import("./moderation.server");
    return guildLeaderboard(data.guildId, data.scope);
  });

export const getWallet = createServerFn({ method: "GET" }).handler(async () => {
  const { loadWallet } = await import("./glow.server");
  return loadWallet();
});

export const claimGlowDaily = createServerFn({ method: "POST" }).handler(async () => {
  const { claimDaily } = await import("./glow.server");
  return claimDaily();
});

export const getGlowLeaderboard = createServerFn({ method: "GET" }).handler(async () => {
  const { glowLeaderboard } = await import("./glow.server");
  return glowLeaderboard();
});

export const syncSlashCommands = createServerFn({ method: "POST" }).handler(async () => {
  const { requireSessionUser } = await import("./session.server");
  await requireSessionUser();
  const { registerSlashCommands } = await import("./discord-api.server");
  const { SLASH_COMMANDS } = await import("./slash-commands");
  const registered = await registerSlashCommands(SLASH_COMMANDS as unknown as unknown[]);
  return { ok: true, count: registered.length };
});
