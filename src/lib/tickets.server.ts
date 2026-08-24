import { assertGuildAccess, ensureGuildRow } from "./guilds.server";
import { inspectDiscordChannel, inspectBotGuild, upsertChannelMessage } from "./discord-api.server";
import { MODULE_DEFAULTS, withDefaults } from "./module-defaults";
import type { Json } from "@/integrations/supabase/types";

export async function publishTicketPanel(guildId: string) {
  await assertGuildAccess(guildId);
  const botGuildResult = await inspectBotGuild(guildId);
  const botGuild = botGuildResult.data;
  if (!botGuild) {
    if (botGuildResult.status === 404) throw new Error("BOT_NOT_IN_GUILD");
    throw new Error(`BOT_GUILD_LOOKUP_FAILED_${botGuildResult.status}`);
  }
  await ensureGuildRow(guildId, botGuild.name, botGuild.icon);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row } = await supabaseAdmin
    .from("guild_modules")
    .select("enabled, config")
    .eq("guild_id", guildId)
    .eq("module", "tickets")
    .maybeSingle();
  const config = withDefaults("tickets", row?.config ?? MODULE_DEFAULTS.tickets);
  const channelId = typeof config["panelChannelId"] === "string" ? config["panelChannelId"] : "";
  if (!channelId) throw new Error("TICKET_PANEL_CHANNEL_REQUIRED");
  if (row?.enabled === false || config["panelEnabled"] === false) throw new Error("TICKET_PANEL_DISABLED");

  const channelResult = await inspectDiscordChannel(channelId);
  if (!channelResult.data) {
    if (channelResult.status === 404) throw new Error("TICKET_PANEL_CHANNEL_NOT_FOUND");
    if (channelResult.status === 403) throw new Error("TICKET_PANEL_CHANNEL_FORBIDDEN");
    throw new Error(`TICKET_PANEL_CHANNEL_LOOKUP_FAILED_${channelResult.status}`);
  }
  if (channelResult.data.guild_id && channelResult.data.guild_id !== guildId)
    throw new Error("TICKET_PANEL_CHANNEL_WRONG_GUILD");
  if (![0, 5].includes(channelResult.data.type)) throw new Error("TICKET_PANEL_CHANNEL_NOT_TEXT");

  const title = typeof config["panelTitle"] === "string" ? config["panelTitle"] : "Need a hand?";
  const description =
    typeof config["panelDescription"] === "string"
      ? config["panelDescription"]
      : "Open a private support ticket and our team will be with you shortly.";
  const color = typeof config["panelColor"] === "string" ? config["panelColor"] : "#7C5CFF";
  const messageId = typeof config["panelMessageId"] === "string" ? config["panelMessageId"] : undefined;
  const result = await upsertChannelMessage(channelId, messageId, {
    embeds: [
      {
        title,
        description,
        color: Number.parseInt(color.replace("#", ""), 16) || 0x7c5cff,
        fields: [
          {
            name: "How it works",
            value: "Click **Open a ticket**, describe your request, then the private support room will be created automatically.",
          },
          {
            name: "Support workflow",
            value: "The team can claim the ticket, set its priority, close it with an HTML transcript, or reopen it when needed.",
          },
        ],
        footer: { text: `${botGuild.name} · Glow Support` },
      },
    ],
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 1,
            label: "Open a ticket",
            custom_id: "glow_ticket_open",
            emoji: { name: "🎫" },
          },
        ],
      },
    ],
  });
  if (!result.ok) {
    console.error(`[Glow Tickets] Panel publish failed channel=${channelId} status=${result.status}`, result.error);
    if (result.status === 401) throw new Error("TICKET_PANEL_BOT_UNAUTHORIZED");
    if (result.status === 403) throw new Error("TICKET_PANEL_BOT_MISSING_PERMISSIONS");
    if (result.status === 404) throw new Error("TICKET_PANEL_CHANNEL_NOT_FOUND");
    throw new Error(`TICKET_PANEL_PUBLISH_FAILED_${result.status}`);
  }

  const nextConfig = { ...config, panelMessageId: result.id };
  const { error } = await supabaseAdmin.from("guild_modules").upsert(
    {
      guild_id: guildId,
      module: "tickets",
      enabled: row?.enabled ?? true,
      config: nextConfig as Json,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "guild_id,module" },
  );
  if (error) throw error;
  return { ok: true, messageId: result.id };
}
