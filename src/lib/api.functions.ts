import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import type { ModuleKey } from "./discord";

export const getMe = createServerFn({ method: "GET" }).handler(async () => {
  const { getSessionUser } = await import("./session.server");
  return getSessionUser();
});

export const signOut = createServerFn({ method: "POST" }).handler(async () => {
  const { currentSessionToken, SESSION_COOKIE } = await import("./session.server");
  const token = currentSessionToken();
  if (token) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("app_sessions").delete().eq("token", token);
  }
  setResponseHeader("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
  return { ok: true };
});

export const listGuilds = createServerFn({ method: "GET" }).handler(async () => {
  const { listManageableGuilds } = await import("./guilds.server");
  return listManageableGuilds();
});

export const getWorkspace = createServerFn({ method: "GET" })
  .inputValidator((data: { guildId: string }) => data)
  .handler(async ({ data }) => {
    const { loadGuildWorkspace } = await import("./guilds.server");
    return loadGuildWorkspace(data.guildId);
  });

export const getOverview = createServerFn({ method: "GET" })
  .inputValidator((data: { guildId: string }) => data)
  .handler(async ({ data }) => {
    const { guildOverview } = await import("./guilds.server");
    return guildOverview(data.guildId);
  });

export const saveModule = createServerFn({ method: "POST" })
  .inputValidator((data: { guildId: string; module: ModuleKey; enabled: boolean; config: Record<string, unknown> }) => data)
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

export const getItems = createServerFn({ method: "GET" })
  .inputValidator((data: { guildId: string; kind: string }) => data)
  .handler(async ({ data }) => {
    const { listGuildItems } = await import("./guilds.server");
    return listGuildItems(data.guildId, data.kind);
  });

export const saveItem = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { guildId: string; kind: string; id?: string; name: string; enabled: boolean; data: Record<string, unknown> }) => data,
  )
  .handler(async ({ data }) => {
    const { upsertGuildItem } = await import("./guilds.server");
    return upsertGuildItem(data);
  });

export const removeItem = createServerFn({ method: "POST" })
  .inputValidator((data: { guildId: string; id: string }) => data)
  .handler(async ({ data }) => {
    const { deleteGuildItem } = await import("./guilds.server");
    return deleteGuildItem(data.guildId, data.id);
  });

export const getCases = createServerFn({ method: "GET" })
  .inputValidator((data: { guildId: string; filter: string }) => data)
  .handler(async ({ data }) => {
    const { listCases } = await import("./moderation.server");
    return listCases(data.guildId, data.filter);
  });

export const addCase = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { guildId: string; action: string; targetId: string; targetName?: string; reason: string; durationMinutes?: number }) => data,
  )
  .handler(async ({ data }) => {
    const { createCase } = await import("./moderation.server");
    return createCase(data);
  });

export const revokeModerationCase = createServerFn({ method: "POST" })
  .inputValidator((data: { guildId: string; caseId: string }) => data)
  .handler(async ({ data }) => {
    const { revokeCase } = await import("./moderation.server");
    return revokeCase(data.guildId, data.caseId);
  });

export const getAutoModRules = createServerFn({ method: "GET" })
  .inputValidator((data: { guildId: string }) => data)
  .handler(async ({ data }) => {
    const { currentAutoModRules } = await import("./moderation.server");
    return currentAutoModRules(data.guildId);
  });

export const getSuggestions = createServerFn({ method: "GET" })
  .inputValidator((data: { guildId: string; status: string }) => data)
  .handler(async ({ data }) => {
    const { listSuggestions } = await import("./moderation.server");
    return listSuggestions(data.guildId, data.status);
  });

export const updateSuggestion = createServerFn({ method: "POST" })
  .inputValidator((data: { guildId: string; id: string; status: string; note: string }) => data)
  .handler(async ({ data }) => {
    const { setSuggestionStatus } = await import("./moderation.server");
    return setSuggestionStatus(data.guildId, data.id, data.status, data.note);
  });

export const getGuildLeaderboard = createServerFn({ method: "GET" })
  .inputValidator((data: { guildId: string; scope: string }) => data)
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
  const registered = await registerSlashCommands(SLASH_COMMANDS as unknown[]);
  return { ok: true, count: registered.length };
});
