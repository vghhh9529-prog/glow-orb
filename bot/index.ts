import "dotenv/config";

import {
  ActionRowBuilder,
  ActivityType,
  AuditLogEvent,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  Partials,
  PermissionFlagsBits,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type GuildMember,
  type Message,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ModalSubmitInteraction,
  type VoiceState,
} from "discord.js";

import { supabaseAdmin } from "../src/integrations/supabase/client.server";
import {
  handleDiscordCardCommand,
  handleDiscordInteraction,
  type DiscordInteractionOption,
  type DiscordInteractionPayload,
} from "../src/lib/discord-interactions.server";
import { botToken, registerSlashCommands } from "../src/lib/discord-api.server";
import { MODULE_DEFAULTS, withDefaults } from "../src/lib/module-defaults";
import {
  logGuildEvent,
  protectGuildEvent,
  recentAuditActor,
  roleDetails,
  roleIds,
} from "../src/lib/discord-runtime.server";
import { type ModuleKey } from "../src/lib/discord";
import {
  getMessageGuardSettings,
  isMessageGuardCounterButton,
  updateMessageGuardCounter,
} from "../src/lib/message-guard.server";
import { SLASH_COMMANDS } from "../src/lib/slash-commands";
import { configuredPublicOrigin } from "../src/lib/origin.server";
import {
  isScamReviewButton,
  reviewScamReport,
  SCAMMER_ROLE_ID,
  SCAM_REVIEW_CHANNEL_ID,
} from "../src/lib/scam-reports.server";

const SITE_URL = configuredPublicOrigin();
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

const messageCooldowns = new Map<string, number>();
const customCommandCooldowns = new Map<string, number>();
const voiceCreatedChannels = new Set<string>();
const messageGuardCache = new Map<
  string,
  { expiresAt: number; settings: Awaited<ReturnType<typeof getMessageGuardSettings>> }
>();

const GLOW_CHANNELS = {
  status: "1541166366160060468",
  updates: "1541166368232312892",
  rules: "1541166355116466236",
  getStarted: "1541166351929049118",
  about: "1541166360929902633",
  blueHeart: "1541166399802708069",
  suggestions: "1541166392227799171",
} as const;

const RELEASE_NOTES =
  process.env["GLOW_RELEASE_NOTES"] ??
  [
    "**Dashboard login:** Returning signed-in users now go straight to the Dashboard instead of seeing the Login page again.",
    "**Persistent sessions:** Login sessions now last 30 days and refresh while the account is active, so normal use does not force repeated Discord sign-ins.",
    "**Ticket publishing:** Server owners, Administrators and members with Manage Server can now pass the server access check when publishing the support panel.",
    "**Permission recovery:** The dashboard can verify the member's real Discord roles through Glow when OAuth permission data is incomplete or stale.",
    "**Branding:** The site tab icon now uses the small Glow bot logo.",
  ].join("\n");

function database() {
  return supabaseAdmin;
}

function replacePlaceholders(
  text: string,
  member: GuildMember,
  values: { level?: number; xp?: number; rank?: number } = {},
) {
  return text
    .replaceAll("{user}", `<@${member.id}>`)
    .replaceAll("{username}", member.user.username)
    .replaceAll("{userid}", member.id)
    .replaceAll("{avatar}", member.user.displayAvatarURL({ extension: "png", size: 256 }))
    .replaceAll("{server}", member.guild.name)
    .replaceAll("{membercount}", String(member.guild.memberCount))
    .replaceAll("{level}", String(values.level ?? 0))
    .replaceAll("{xp}", String(values.xp ?? 0))
    .replaceAll("{rank}", String(values.rank ?? 0));
}

async function moduleConfig<T extends ModuleKey>(guildId: string, module: T) {
  const { data, error } = await database()
    .from("guild_modules")
    .select("enabled, config")
    .eq("guild_id", guildId)
    .eq("module", module)
    .maybeSingle();
  if (error) {
    console.error(
      `[Glow Bot] Failed to load ${module} config for guild ${guildId}: ${error.message}`,
    );
  }
  return {
    enabled: data ? Boolean(data.enabled) : module === "commands" || module === "tickets",
    config: withDefaults(module, data?.config),
  };
}

async function guildItems(guildId: string, kind: string) {
  const { data, error } = await database()
    .from("guild_items")
    .select("id, name, enabled, data")
    .eq("guild_id", guildId)
    .eq("kind", kind)
    .eq("enabled", true);
  if (error) {
    console.error(`[Glow Bot] Failed to load ${kind} items for guild ${guildId}: ${error.message}`);
  }
  return data ?? [];
}

async function ticketConfig(guildId: string) {
  const settings = await moduleConfig(guildId, "tickets");
  return settings;
}

function ticketRecordData(input: {
  channelId: string;
  creatorId: string;
  creatorName: string;
  status: "open" | "closed";
  claimedBy?: string | null;
  priority?: string;
  categoryId?: string;
  subject?: string;
  createdAt?: string;
}) {
  return {
    channelId: input.channelId,
    creatorId: input.creatorId,
    creatorName: input.creatorName,
    status: input.status,
    claimedBy: input.claimedBy ?? null,
    priority: input.priority ?? "normal",
    categoryId: input.categoryId ?? null,
    subject: input.subject ?? "General support",
    createdAt: input.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

async function findTicket(channelId: string) {
  const { data, error } = await database()
    .from("guild_items")
    .select("id, guild_id, name, enabled, data")
    .eq("kind", "tickets")
    .contains("data", { channelId })
    .maybeSingle();
  if (error) console.error(`[Glow Bot] Failed to load ticket ${channelId}: ${error.message}`);
  return data;
}

async function saveTicketRecord(input: {
  guildId: string;
  channelId: string;
  creatorId: string;
  creatorName: string;
  status: "open" | "closed";
  id?: string;
  claimedBy?: string | null;
  priority?: string;
  categoryId?: string;
  subject?: string;
  createdAt?: string;
}) {
  const record = {
    guild_id: input.guildId,
    kind: "tickets",
    name: `ticket-${input.channelId}`,
    enabled: input.status === "open",
    data: ticketRecordData(input),
    updated_at: new Date().toISOString(),
  };
  const query = input.id
    ? database().from("guild_items").update(record).eq("id", input.id).eq("guild_id", input.guildId)
    : database().from("guild_items").insert(record);
  const { error } = await query;
  if (error) console.error(`[Glow Bot] Failed to save ticket ${input.channelId}: ${error.message}`);
}

async function buildTicketEmbed(guildName: string, creatorId: string, status: "open" | "closed", priority = "normal") {
  return new EmbedBuilder()
    .setColor(status === "open" ? 0x7c5cff : 0x64748b)
    .setTitle(status === "open" ? "Glow Support Ticket" : "Ticket closed")
    .setDescription(status === "open" ? `Welcome <@${creatorId}>. Tell us what you need and the support team will be with you shortly.` : "This ticket is closed. The HTML transcript was saved when the ticket was closed. Reopen it if you still need help, or delete the ticket permanently when you are done.")
    .addFields({ name: "Priority", value: priority, inline: true }, { name: "Status", value: status, inline: true })
    .setFooter({ text: `${guildName} · Glow Support` });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>\"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

async function fetchTicketMessages(channel: Message["channel"]) {
  if (!("messages" in channel)) return [];
  const all = new Map<string, Message>();
  let before: string | undefined;
  for (let page = 0; page < 10; page += 1) {
    const batch = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) }).catch(() => null);
    if (!batch || batch.size === 0) break;
    for (const message of batch.values()) all.set(message.id, message);
    const oldest = batch.last();
    if (!oldest || batch.size < 100) break;
    before = oldest.id;
  }
  return [...all.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
}

async function postTicketTranscript(channel: Message["channel"], ticket: { id?: string; data?: Record<string, unknown> }, config: Record<string, unknown>) {
  const transcriptChannelId = typeof config["transcriptChannelId"] === "string" ? config["transcriptChannelId"] : "";
  if (config["transcriptEnabled"] === false || !transcriptChannelId || !channel.isTextBased()) return;
  const transcriptChannel = await channel.client.channels.fetch(transcriptChannelId).catch(() => null);
  if (!transcriptChannel || !transcriptChannel.isTextBased() || !("send" in transcriptChannel)) return;
  const messages = await fetchTicketMessages(channel);
  const channelName = "name" in channel && typeof channel.name === "string" ? channel.name : channel.id;
  const ticketData = ticket.data ?? {};
  const rows = messages.length
    ? messages.map((message) => {
        const attachments = [...message.attachments.values()]
          .map((attachment) => `<a href="${escapeHtml(attachment.url)}">${escapeHtml(attachment.name ?? "attachment")}</a>`)
          .join(" · ");
        return `<article class="message"><div class="meta"><strong>${escapeHtml(message.author.tag)}</strong><time>${escapeHtml(message.createdAt.toISOString())}</time></div><p>${escapeHtml(message.cleanContent || "").replaceAll("\n", "<br>") || "<em>empty message</em>"}</p>${attachments ? `<div class="attachments">${attachments}</div>` : ""}</article>`;
      }).join("\n")
    : `<p class="empty">No messages could be fetched.</p>`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Glow ticket transcript · ${escapeHtml(channelName)}</title><style>body{margin:0;background:#090b18;color:#eef0ff;font:15px/1.6 Inter,system-ui,sans-serif;padding:32px}.wrap{max-width:900px;margin:auto}.hero{background:linear-gradient(135deg,#181332,#0c1630);border:1px solid #343064;border-radius:22px;padding:24px;margin-bottom:20px}.eyebrow{color:#a996ff;text-transform:uppercase;letter-spacing:.16em;font-size:11px;font-weight:700}.meta{display:flex;gap:14px;align-items:center;color:#a9acc8}.meta time{font-size:12px}.message{background:#11152a;border:1px solid #24294a;border-radius:16px;padding:14px 16px;margin:10px 0}.message p{margin:8px 0 0;white-space:normal}.attachments{font-size:12px;color:#a996ff}.attachments a{color:#a996ff}</style></head><body><main class="wrap"><section class="hero"><div class="eyebrow">Glow Support</div><h1>${escapeHtml(channelName)}</h1><p>Ticket transcript · ${escapeHtml(String(ticket.id ?? "unknown"))}</p><p>Creator: ${escapeHtml(String(ticketData["creatorName"] ?? "unknown"))}</p><p>Subject: ${escapeHtml(String(ticketData["subject"] ?? "General support"))} · Priority: ${escapeHtml(String(ticketData["priority"] ?? "normal"))} · Claimed by: ${escapeHtml(String(ticketData["claimedBy"] ?? "Unassigned"))}</p><p>Messages captured: ${messages.length}</p></section><section>${rows}</section></main></body></html>`;
  await transcriptChannel.send({
    embeds: [new EmbedBuilder().setColor(0x64748b).setTitle("Ticket transcript saved").setDescription(`HTML transcript for **${channelName}** is attached below.`)],
    files: [{ attachment: Buffer.from(html, "utf8"), name: `glow-${channel.id}-transcript.html` }],
  }).catch((error) => console.error("[Glow Bot] Ticket HTML transcript failed", error));
}

function ticketModal(config: Record<string, unknown>) {
  return new ModalBuilder()
    .setCustomId("glow_ticket_open_modal")
    .setTitle("Open a Glow support ticket")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("subject")
          .setLabel("What do you need help with?")
          .setStyle(TextInputStyle.Short)
          .setRequired(config.requireSubject !== false)
          .setMaxLength(80)
          .setPlaceholder("Billing, moderation, bug report...")
          .setValue("General support"),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("details")
          .setLabel("Describe the issue")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(config.requireDetails === true)
          .setMaxLength(1500)
          .setPlaceholder("Give the support team enough context to help you quickly."),
      ),
    );
}

async function createTicketFromModal(interaction: ModalSubmitInteraction) {
  if (!interaction.guild) return interaction.reply({ content: "Tickets are available inside a server only.", ephemeral: true });
  await interaction.deferReply({ ephemeral: true });
  const settings = await ticketConfig(interaction.guild.id);
  const config = settings.config;
  if (!settings.enabled) return interaction.editReply("Support tickets are disabled for this server.");
  const maxOpenPerUser = Math.min(5, Math.max(1, Number(config.maxOpenPerUser ?? 1)));
  const existing = await database().from("guild_items").select("id, data").eq("guild_id", interaction.guild.id).eq("kind", "tickets").contains("data", { creatorId: interaction.user.id, status: "open" }).limit(10);
  const openTickets = existing.data ?? [];
  let activeOpenTickets = 0;
  for (const openTicket of openTickets.slice(0, maxOpenPerUser)) {
    const data = (openTicket.data ?? {}) as Record<string, unknown>;
    if (typeof data["channelId"] !== "string") continue;
    const existingChannel = await interaction.guild.channels.fetch(data["channelId"]).catch(() => null);
    if (existingChannel) {
      activeOpenTickets += 1;
      return interaction.editReply(`You already have an open ticket: <#${existingChannel.id}>`);
    }
    await database().from("guild_items").update({ enabled: false, data: { ...data, status: "closed", closedReason: "Ticket channel no longer exists" } }).eq("id", openTicket.id).eq("guild_id", interaction.guild.id);
  }
  if (activeOpenTickets >= maxOpenPerUser) return interaction.editReply(`You can have up to ${maxOpenPerUser} open ticket${maxOpenPerUser === 1 ? "" : "s"} at a time.`);
  const supportRoleIds = Array.isArray(config.supportRoleIds) ? config.supportRoleIds.filter((id): id is string => typeof id === "string") : [];
  const nameTemplate = typeof config.ticketName === "string" ? config.ticketName : "ticket-{username}";
  const subject = interaction.fields.getTextInputValue("subject").trim().slice(0, 80) || "General support";
  const details = interaction.fields.getTextInputValue("details").trim().slice(0, 1500);
  const channelName = nameTemplate.replaceAll("{username}", interaction.user.username.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 20) || "member").replaceAll("{subject}", subject.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "support").slice(0, 90);
  const channel = await interaction.guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: typeof config.categoryId === "string" && config.categoryId ? config.categoryId : undefined,
    topic: `Glow ticket · ${subject} · opened by ${interaction.user.tag}`.slice(0, 1024),
    permissionOverwrites: [
      { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
      ...supportRoleIds.map((roleId) => ({ id: roleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] })),
    ],
  }).catch(() => null);
  if (!channel) return interaction.editReply("Could not create the ticket. Check Glow's Manage Channels permission.");
  const record = ticketRecordData({ channelId: channel.id, creatorId: interaction.user.id, creatorName: interaction.user.username, status: "open", categoryId: typeof config.categoryId === "string" ? config.categoryId : undefined, subject });
  const { data: saved } = await database().from("guild_items").insert({ guild_id: interaction.guild.id, kind: "tickets", name: channel.name, enabled: true, data: { ...record, priority: "normal" } }).select("id").maybeSingle();
  const staffMentions = config.notifyStaff === false ? "" : supportRoleIds.map((roleId) => `<@&${roleId}>`).join(" ");
  const embed = await buildTicketEmbed(interaction.guild.name, interaction.user.id, "open", "normal");
  embed.setTitle(`Glow Support · ${subject}`).addFields({ name: "Opened by", value: `<@${interaction.user.id}>`, inline: true }, { name: "Ticket ID", value: saved?.id ? `#${saved.id}` : channel.id, inline: true });
  if (details) embed.addFields({ name: "Initial details", value: details.slice(0, 1024) });
  try {
    await channel.send({
      content: staffMentions || undefined,
      allowedMentions: { parse: [], users: [interaction.user.id], roles: supportRoleIds },
      embeds: [embed],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId("glow_ticket_claim").setLabel("Claim").setEmoji("🛠️").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId("glow_ticket_priority").setLabel("Priority").setEmoji("📌").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId("glow_ticket_close").setLabel("Close").setEmoji("🔒").setStyle(ButtonStyle.Danger),
        ),
      ],
    });
  } catch (error) {
    console.error("[Glow Bot] Ticket welcome message failed", error);
    if (saved?.id) await database().from("guild_items").delete().eq("id", saved.id).eq("guild_id", interaction.guild.id);
    await channel.delete("Glow ticket setup failed").catch(() => undefined);
    return interaction.editReply("Could not finish opening the ticket. Check Glow's message and emoji permissions, then try again.");
  }
  await logGuildEvent({ guild: interaction.guild, event: "ticket", title: "Ticket opened", description: `<@${interaction.user.id}> opened **${subject}**.`, fields: [{ name: "Channel", value: `<#${channel.id}>`, inline: true }, { name: "Priority", value: "normal", inline: true }] });
  return interaction.editReply(`Your private ticket is ready: <#${channel.id}>`);
}

async function handleTicketButton(interaction: ButtonInteraction) {
  if (!interaction.guild) return interaction.reply({ content: "Tickets are available inside a server only.", ephemeral: true });
  const settings = await ticketConfig(interaction.guild.id);
  const config = settings.config;

  if (interaction.customId === "glow_ticket_open") {
    if (!settings.enabled) return interaction.reply({ content: "Support tickets are disabled for this server.", ephemeral: true });
    return interaction.showModal(ticketModal(config));
  }

  const ticket = await findTicket(interaction.channelId);
  if (!ticket) return interaction.reply({ content: "This channel is not a Glow ticket.", ephemeral: true });
  const ticketData = (ticket.data ?? {}) as Record<string, unknown>;
  if (interaction.customId === "glow_ticket_priority") {
    if (config.allowPriorityChange === false) return interaction.reply({ content: "Ticket priority changes are disabled for this server.", ephemeral: true });
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) return interaction.reply({ content: "Only support staff can change ticket priority.", ephemeral: true });
    const currentPriority = String(ticketData.priority ?? "normal");
    const nextPriority = currentPriority === "normal" ? "high" : currentPriority === "high" ? "urgent" : "normal";
    await saveTicketRecord({ guildId: interaction.guild.id, channelId: interaction.channelId, creatorId: String(ticketData.creatorId ?? ""), creatorName: String(ticketData.creatorName ?? "member"), status: String(ticketData.status ?? "open") === "closed" ? "closed" : "open", id: ticket.id, claimedBy: String(ticketData.claimedBy ?? "") || null, priority: nextPriority, categoryId: String(ticketData.categoryId ?? ""), subject: String(ticketData.subject ?? "General support"), createdAt: String(ticketData.createdAt ?? "") || undefined });
    await logGuildEvent({ guild: interaction.guild, event: "ticket", title: "Ticket priority changed", description: `<#${interaction.channelId}> is now **${nextPriority}** priority.`, fields: [{ name: "Changed by", value: `<@${interaction.user.id}>`, inline: true }] });
    const updated = await buildTicketEmbed(interaction.guild.name, String(ticketData.creatorId ?? interaction.user.id), String(ticketData.status ?? "open") === "closed" ? "closed" : "open", nextPriority);
    updated.setTitle(`Glow Support · ${String(ticketData.subject ?? "General support")}`);
    return interaction.update({ embeds: [updated], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId("glow_ticket_claim").setLabel("Claim").setEmoji("🛠️").setStyle(ButtonStyle.Secondary), new ButtonBuilder().setCustomId("glow_ticket_priority").setLabel(`Priority: ${nextPriority}`).setEmoji("📌").setStyle(ButtonStyle.Secondary), new ButtonBuilder().setCustomId("glow_ticket_close").setLabel("Close").setEmoji("🔒").setStyle(ButtonStyle.Danger))] });
  }
  if (interaction.customId === "glow_ticket_delete") {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels) && String(ticketData.creatorId) !== interaction.user.id) return interaction.reply({ content: "Only the ticket creator or staff can delete this ticket.", ephemeral: true });
    await interaction.deferUpdate();
    await logGuildEvent({ guild: interaction.guild, event: "ticket", title: "Ticket deleted", description: `<#${interaction.channelId}> was permanently deleted.`, fields: [{ name: "Deleted by", value: `<@${interaction.user.id}>`, inline: true }] });
    await interaction.channel?.delete("Glow ticket deleted").catch(() => undefined);
    await database().from("guild_items").delete().eq("id", ticket.id).eq("guild_id", interaction.guild.id);
    return;
  }
  if (interaction.customId === "glow_ticket_claim") {
    if (config.allowClaim === false) return interaction.reply({ content: "Ticket claiming is disabled.", ephemeral: true });
    await saveTicketRecord({ guildId: interaction.guild.id, channelId: interaction.channelId, creatorId: String(ticketData.creatorId ?? ""), creatorName: String(ticketData.creatorName ?? "member"), status: "open", id: ticket.id, claimedBy: interaction.user.id, priority: String(ticketData.priority ?? "normal"), categoryId: String(ticketData.categoryId ?? ""), subject: String(ticketData.subject ?? "General support"), createdAt: String(ticketData.createdAt ?? "") || undefined });
    await logGuildEvent({ guild: interaction.guild, event: "ticket", title: "Ticket claimed", description: `<#${interaction.channelId}> was claimed by <@${interaction.user.id}>.` });
    return interaction.reply({ content: `Ticket claimed by **${interaction.user.username}**.`, ephemeral: false });
  }
  if (interaction.customId === "glow_ticket_reopen") {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels) && String(ticketData.creatorId) !== interaction.user.id) return interaction.reply({ content: "Only the ticket creator or staff can reopen this ticket.", ephemeral: true });
    if (interaction.channel && "setName" in interaction.channel) await interaction.channel.setName(String(ticket.name ?? "ticket").replace(/^closed-/, "")).catch(() => undefined);
    await saveTicketRecord({ guildId: interaction.guild.id, channelId: interaction.channelId, creatorId: String(ticketData.creatorId ?? ""), creatorName: String(ticketData.creatorName ?? "member"), status: "open", id: ticket.id, claimedBy: String(ticketData.claimedBy ?? "") || null, priority: String(ticketData.priority ?? "normal"), categoryId: String(ticketData.categoryId ?? ""), subject: String(ticketData.subject ?? "General support"), createdAt: String(ticketData.createdAt ?? "") || undefined });
    await logGuildEvent({ guild: interaction.guild, event: "ticket", title: "Ticket reopened", description: `<#${interaction.channelId}> was reopened by <@${interaction.user.id}>.` });
    return interaction.update({ embeds: [await buildTicketEmbed(interaction.guild.name, String(ticketData.creatorId ?? interaction.user.id), "open", String(ticketData.priority ?? "normal"))], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId("glow_ticket_claim").setLabel("Claim").setEmoji("🛠️").setStyle(ButtonStyle.Secondary), new ButtonBuilder().setCustomId("glow_ticket_priority").setLabel(`Priority: ${String(ticketData.priority ?? "normal")}`).setEmoji("📌").setStyle(ButtonStyle.Secondary), new ButtonBuilder().setCustomId("glow_ticket_close").setLabel("Close").setEmoji("🔒").setStyle(ButtonStyle.Danger))] });
  }
  if (interaction.customId === "glow_ticket_close") {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels) && String(ticketData.creatorId) !== interaction.user.id) return interaction.reply({ content: "Only the ticket creator or staff can close this ticket.", ephemeral: true });
    await postTicketTranscript(interaction.channel, ticket, config);
    if (interaction.channel && "setName" in interaction.channel) await interaction.channel.setName(`closed-${String(ticket.name ?? "ticket").replace(/^closed-/, "")}`.slice(0, 100)).catch(() => undefined);
    if (interaction.channel && "permissionOverwrites" in interaction.channel) await interaction.channel.permissionOverwrites.edit(String(ticketData.creatorId), { SendMessages: false }).catch(() => undefined);
    await saveTicketRecord({ guildId: interaction.guild.id, channelId: interaction.channelId, creatorId: String(ticketData.creatorId ?? ""), creatorName: String(ticketData.creatorName ?? "member"), status: "closed", id: ticket.id, claimedBy: String(ticketData.claimedBy ?? "") || null, priority: String(ticketData.priority ?? "normal"), categoryId: String(ticketData.categoryId ?? ""), subject: String(ticketData.subject ?? "General support"), createdAt: String(ticketData.createdAt ?? "") || undefined });
    await logGuildEvent({ guild: interaction.guild, event: "ticket", title: "Ticket closed", description: `<#${interaction.channelId}> was closed by <@${interaction.user.id}>.`, fields: [{ name: "Transcript", value: config.transcriptEnabled === false ? "Disabled" : "Saved when available", inline: true }] });
    return interaction.update({ embeds: [await buildTicketEmbed(interaction.guild.name, String(ticketData.creatorId ?? interaction.user.id), "closed", String(ticketData.priority ?? "normal"))], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId("glow_ticket_reopen").setLabel("Reopen").setEmoji("↩️").setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId("glow_ticket_delete").setLabel("Delete ticket").setEmoji("🗑️").setStyle(ButtonStyle.Danger))] });
  }
  return interaction.reply({ content: "Unknown ticket action.", ephemeral: true });
}

async function handleScamReviewButton(interaction: ButtonInteraction) {
  if (!interaction.guild || interaction.channelId !== SCAM_REVIEW_CHANNEL_ID) {
    await interaction.reply({ content: "This review action is only available in the configured Glow review channel.", ephemeral: true });
    return;
  }
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: "Only server administrators can review scam reports.", ephemeral: true });
    return;
  }
  const [action, reportId] = interaction.customId.split(":");
  if (!reportId || (action !== "glow_scam_approve" && action !== "glow_scam_delete")) {
    await interaction.reply({ content: "This review action is invalid.", ephemeral: true });
    return;
  }
  await interaction.deferUpdate();
  const decision = action === "glow_scam_approve" ? "approved" : "rejected";
  try {
    const result = await reviewScamReport(reportId, decision, interaction.user.id);
    const statusText = decision === "approved" ? "APPROVED" : "DELETED / REJECTED";
    const roleText = decision === "approved"
      ? result.roleAssigned
        ? `Scammer role assigned: ${SCAMMER_ROLE_ID}`
        : `Scammer role was not assigned: ${result.roleAssignmentError ?? "the user is not in the source server"}`
      : "No role was assigned.";
    const embeds = interaction.message.embeds.map((embed, index) => {
      if (index !== 0) return embed.toJSON();
      return {
        ...embed.toJSON(),
        color: decision === "approved" ? 0x22c55e : 0xef4444,
        footer: { text: `Glow Safety Review · ${statusText} by ${interaction.user.tag}` },
      };
    });
    await interaction.editReply({
      content: `Report ${reportId} · ${statusText}\n${roleText}`,
      embeds,
      components: [
        {
          type: 1,
          components: [
            { type: 2, style: 3, label: "Approve report", custom_id: `glow_scam_approve:${reportId}`, disabled: true },
            { type: 2, style: 4, label: "Delete report", custom_id: `glow_scam_delete:${reportId}`, disabled: true },
          ],
        },
      ],
      allowedMentions: { parse: [] },
    });
  } catch (error) {
    console.error("[Glow Bot] Scam report review failed", error);
    await interaction.editReply({ content: "Could not complete this review. The report may already have been reviewed.", allowedMentions: { parse: [] } });
  }
}

async function ensureUser(member: GuildMember) {
  const user = member.user;
  await database()
    .from("discord_users")
    .upsert(
      {
        id: user.id,
        username: user.username,
        global_name: user.globalName,
        avatar: user.displayAvatarURL({ extension: "png", size: 128 }),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
  await database()
    .from("glow_wallets")
    .upsert({ user_id: user.id }, { onConflict: "user_id", ignoreDuplicates: true });
}

async function handleWelcome(member: GuildMember) {
  const settings = await moduleConfig(member.guild.id, "welcome");
  if (!settings.enabled) return;
  const config = settings.config;
  const channelId = String(config.channelId ?? "");
  const channel = member.guild.channels.cache.get(channelId);
  if (!channel?.isTextBased()) return;

  const message = replacePlaceholders(
    String(config.message ?? "أهلاً {user} في {server}!"),
    member,
  );
  const embedConfig = (config.embed ?? {}) as Record<string, unknown>;
  const payload: Parameters<typeof channel.send>[0] = {
    content: message,
    allowedMentions: config.mentionUser === true ? { parse: [], users: [member.id] } : { parse: [] },
  };
  if (embedConfig.enabled) {
    payload.embeds = [
      {
        title: replacePlaceholders(String(embedConfig.title ?? "مرحباً {username}"), member),
        description: replacePlaceholders(
          String(embedConfig.description ?? "نورت {server}!"),
          member,
        ),
        color: String(embedConfig.color ?? "#3B9DF8") as `#${string}`,
        thumbnail: embedConfig.thumbnailAvatar
          ? { url: member.user.displayAvatarURL({ extension: "png", size: 256 }) }
          : undefined,
        footer: embedConfig.footer
          ? { text: replacePlaceholders(String(embedConfig.footer), member) }
          : undefined,
      },
    ];
  }
  const sent = await channel.send(payload);
  const deleteAfterSeconds = Number(config.deleteAfterSeconds ?? 0);
  if (deleteAfterSeconds > 0) {
    setTimeout(() => void sent.delete().catch(() => undefined), deleteAfterSeconds * 1000);
  }
}

async function handleAutoroles(member: GuildMember) {
  const settings = await moduleConfig(member.guild.id, "autoroles");
  if (!settings.enabled) return;
  const config = settings.config;
  const roleIds = (member.user.bot ? config.botRoles : config.userRoles) as string[];
  const delaySeconds = Number(config.delaySeconds ?? 0);
  const apply = async () => {
    const roles = roleIds
      .map((id) => member.guild.roles.cache.get(String(id)))
      .filter((role): role is NonNullable<typeof role> => Boolean(role) && !role.managed);
    if (roles.length)
      await member.roles
        .add(roles, "Glow Auto-Roles")
        .catch((error: unknown) => console.error("Auto-roles failed", error));
  };
  if (delaySeconds > 0) setTimeout(() => void apply(), delaySeconds * 1000);
  else await apply();
}

function levelFromXp(xp: number, curve: number) {
  return Math.max(0, Math.floor(Math.sqrt(xp / Math.max(curve, 1))));
}

async function handleLeveling(message: Message) {
  if (!message.guild || message.author.bot || !message.member) return;
  const settings = await moduleConfig(message.guild.id, "leveling");
  if (!settings.enabled) return;
  const config = settings.config;
  const xpConfig = (config.xp ?? {}) as Record<string, unknown>;
  const exclusions = (config.exclusions ?? {}) as Record<string, unknown>;
  const excludedChannels = (exclusions.textChannels ?? []) as string[];
  const excludedRoles = (exclusions.roles ?? []) as string[];
  if (
    excludedChannels.includes(message.channelId) ||
    message.member.roles.cache.some((role) => excludedRoles.includes(role.id))
  )
    return;

  const cooldown = Math.max(0, Number(xpConfig.textCooldown ?? 60)) * 1000;
  const key = `${message.guild.id}:${message.author.id}`;
  const now = Date.now();
  if ((messageCooldowns.get(key) ?? 0) > now) return;
  messageCooldowns.set(key, now + cooldown);

  const min = Number(xpConfig.textMin ?? 15);
  const max = Math.max(min, Number(xpConfig.textMax ?? 25));
  const baseXp = Math.floor(Math.random() * (max - min + 1)) + min;
  const channelMultipliers = (config.channelMultipliers ?? []) as Array<{
    channelId?: string;
    multiplier?: number;
  }>;
  const roleMultipliers = (config.roleMultipliers ?? []) as Array<{
    roleId?: string;
    multiplier?: number;
  }>;
  const channelMultiplier =
    channelMultipliers.find((item) => item.channelId === message.channelId)?.multiplier ?? 1;
  const roleMultiplier = message.member.roles.cache.reduce(
    (value, role) =>
      Math.max(value, roleMultipliers.find((item) => item.roleId === role.id)?.multiplier ?? 1),
    1,
  );
  const earnedXp = Math.max(
    1,
    Math.round(baseXp * Number(channelMultiplier) * Number(roleMultiplier)),
  );

  const { data: current } = await database()
    .from("member_levels")
    .select("xp, level, daily_xp, weekly_xp, monthly_xp, voice_minutes")
    .eq("guild_id", message.guild.id)
    .eq("user_id", message.author.id)
    .maybeSingle();
  const oldLevel = Number(current?.level ?? 0);
  const xp = Number(current?.xp ?? 0) + earnedXp;
  const level = levelFromXp(xp, Number(xpConfig.curve ?? 100));
  await database()
    .from("member_levels")
    .upsert(
      {
        guild_id: message.guild.id,
        user_id: message.author.id,
        username: message.member.displayName,
        avatar: message.author.displayAvatarURL({ extension: "png", size: 128 }),
        xp,
        level,
        daily_xp: Number(current?.daily_xp ?? 0) + earnedXp,
        weekly_xp: Number(current?.weekly_xp ?? 0) + earnedXp,
        monthly_xp: Number(current?.monthly_xp ?? 0) + earnedXp,
        voice_minutes: Number(current?.voice_minutes ?? 0),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "guild_id,user_id" },
    );

  if (level <= oldLevel) return;
  const announce = (config.announce ?? {}) as Record<string, unknown>;
  const announceChannel = message.guild.channels.cache.get(
    String(announce.channelId || message.channelId),
  );
  if (announceChannel?.isTextBased()) {
    await announceChannel
      .send(
        replacePlaceholders(
          String(announce.message ?? "🎉 مبروك {user}! وصلت للمستوى {level}"),
          message.member,
          { level, xp },
        ),
      )
      .catch(() => undefined);
  }
  const rewards = (config.rewards ?? []) as Array<{
    level?: number;
    roleId?: string;
    removePrevious?: boolean;
  }>;
  for (const reward of rewards.filter((item) => Number(item.level) === level)) {
    const role = reward.roleId ? message.guild.roles.cache.get(reward.roleId) : undefined;
    if (!role || role.managed) continue;
    if (reward.removePrevious) {
      for (const previous of rewards.filter((item) => Number(item.level) < level && item.roleId)) {
        if (previous.roleId)
          await message.member.roles.remove(previous.roleId).catch(() => undefined);
      }
    }
    await message.member.roles.add(role, `Glow level ${level}`).catch(() => undefined);
  }
}

async function handleProtectionMessage(message: Message) {
  if (!message.guild || !message.member || message.author.bot) return;
  const settings = await moduleConfig(message.guild.id, "protection");
  if (!settings.enabled || !message.mentions.everyone) return;
  const rules = (settings.config.rules ?? {}) as Record<string, Record<string, unknown>>;
  const rule = rules.everyoneMention;
  if (!rule?.enabled) return;
  const exemptRoles = Array.isArray(settings.config.exemptRoles) ? settings.config.exemptRoles.filter((id): id is string => typeof id === "string") : [];
  if (message.member.roles.cache.some((role) => exemptRoles.includes(role.id))) return;
  await message.delete("Glow anti-mention protection").catch(() => undefined);
  await protectGuildEvent({
    guild: message.guild,
    event: "everyoneMention",
    actorId: message.author.id,
    targetId: message.author.id,
    details: `@everyone or @here mention in #${message.channelId}`,
  });
}

async function handleAutomations(message: Message) {
  if (!message.guild) return;
  const autoReply = await moduleConfig(message.guild.id, "autoreply");
  if (autoReply.enabled && !(autoReply.config.ignoreBots && message.author.bot)) {
    const content = (message.content || message.cleanContent || "").toLowerCase().trim();
    const items = await guildItems(message.guild.id, "autoreply");
    console.log(
      `[Glow Bot] Auto Reply check guild=${message.guild.id} channel=${message.channelId} contentLength=${content.length} rules=${items.length}`,
    );
    if (items.length === 0) {
      console.warn(
        `[Glow Bot] Auto Reply is enabled but has no active rules in guild ${message.guild.id}`,
      );
    }
    for (const item of items) {
      const data = (item.data ?? {}) as Record<string, unknown>;
      const trigger = String(data.trigger ?? data.keyword ?? data.phrase ?? "")
        .toLowerCase()
        .trim();
      if (!trigger || !content.includes(trigger)) continue;
      const response = String(data.response ?? data.reply ?? data.message ?? "").trim();
      console.log(
        `[Glow Bot] Auto Reply matched rule "${String(item.name ?? trigger)}" in guild ${message.guild.id}`,
      );
      if (response) {
          await message
            .reply({ content: response, allowedMentions: { parse: [] } })
          .catch((error: unknown) =>
            console.error(
              `[Glow Bot] Auto Reply could not send a response in guild ${message.guild?.id}`,
              error,
            ),
          );
      }
      if (Boolean(autoReply.config.deleteTrigger) && message.deletable)
        await message
          .delete()
          .catch((error: unknown) =>
            console.error(
              `[Glow Bot] Auto Reply could not delete the trigger in guild ${message.guild?.id}`,
              error,
            ),
          );
      break;
    }
  }

  const autoInteraction = await moduleConfig(message.guild.id, "autointeraction");
  if (autoInteraction.enabled && !(autoInteraction.config.ignoreBots && message.author.bot)) {
    const items = await guildItems(message.guild.id, "autointeraction");
    for (const item of items) {
      const data = (item.data ?? {}) as Record<string, unknown>;
      const trigger = String(data.trigger ?? "").trim();
      const emoji = String(data.emoji ?? data.response ?? "").trim();
      if (trigger && emoji && message.content.toLowerCase().includes(trigger.toLowerCase())) {
        await message.react(emoji).catch(() => undefined);
      }
    }
  }

  const customCommands = await moduleConfig(message.guild.id, "customcommands");
  if (customCommands.enabled && !(customCommands.config.ignoreBots && message.author.bot)) {
    const prefix = String(customCommands.config.prefix ?? "!").trim() || "!";
    const raw = message.content.trim();
    if (raw.startsWith(prefix)) {
      const commandName = raw.slice(prefix.length).trim().split(/\s+/)[0]?.toLowerCase() ?? "";
      if (commandName) {
        const items = await guildItems(message.guild.id, "customcommands");
        const match = items.find((item) => {
          const data = (item.data ?? {}) as Record<string, unknown>;
          const trigger = String(data.trigger ?? item.name ?? "").trim().replace(/^!+/, "").toLowerCase();
          return trigger === commandName;
        });
        if (match) {
          const cooldownSeconds = Math.max(0, Number(customCommands.config.cooldownSeconds ?? 3));
          const cooldownKey = `${message.guild.id}:${match.id ?? match.name}:${message.author.id}`;
          const now = Date.now();
          const lastUsed = customCommandCooldowns.get(cooldownKey) ?? 0;
          if (now - lastUsed >= cooldownSeconds * 1000) {
            customCommandCooldowns.set(cooldownKey, now);
            const data = (match.data ?? {}) as Record<string, unknown>;
            const response = String(data.response ?? data.reply ?? data.message ?? "").trim();
            if (response) {
              const member = message.member;
              const rendered = member
                ? replacePlaceholders(response, member)
                : response
                    .replaceAll("{user}", `<@${message.author.id}>`)
                    .replaceAll("{username}", message.author.username)
                    .replaceAll("{server}", message.guild.name);
              await message.reply({ content: rendered, allowedMentions: { parse: [], users: [message.author.id] } }).catch((error: unknown) =>
                console.error(`[Glow Bot] Custom command could not reply in ${message.guild?.id}`, error),
              );
            }
            if (Boolean(customCommands.config.deleteTrigger) && message.deletable)
              await message.delete().catch(() => undefined);
          }
        }
      }
    }
  }
}

async function handleTempVoice(oldState: VoiceState, newState: VoiceState) {
  const guild = newState.guild;
  const settings = await moduleConfig(guild.id, "tempvoice");
  if (!settings.enabled) return;
  const config = settings.config;
  const lobbyId = String(config.lobbyChannelId ?? "");
  if (newState.channelId === lobbyId && newState.member) {
    const categoryId = String(config.categoryId ?? "") || undefined;
    const created = await guild.channels
      .create({
        name: replacePlaceholders(
          String(config.nameTemplate ?? "🔊 روم {username}"),
          newState.member,
        ),
        type: ChannelType.GuildVoice,
        parent: categoryId,
        userLimit: Number(config.defaultUserLimit ?? 0),
      })
      .catch(() => null);
    if (created) {
      voiceCreatedChannels.add(created.id);
      await newState.setChannel(created).catch(() => undefined);
    }
  }
  const oldChannel = oldState.channel;
  if (!oldChannel || !voiceCreatedChannels.has(oldChannel.id)) return;
  if (oldChannel.members.size === 0 && Boolean(config.deleteWhenEmpty ?? true)) {
    voiceCreatedChannels.delete(oldChannel.id);
    await oldChannel.delete("Glow temporary voice cleanup").catch(() => undefined);
  }
}

function interactionPayload(interaction: ChatInputCommandInteraction): DiscordInteractionPayload {
  return {
    type: 2,
    token: interaction.token,
    guild_id: interaction.guildId ?? undefined,
    channel_id: interaction.channelId ?? undefined,
    member: {
      user: {
        id: interaction.user.id,
        username: interaction.user.username,
        global_name: interaction.user.globalName,
        avatar: interaction.user.displayAvatarURL({ extension: "png", size: 128 }),
      },
      permissions: interaction.memberPermissions?.bitfield.toString(),
    },
    data: {
      name: interaction.commandName,
      options: interaction.options.data as unknown as DiscordInteractionOption[],
    },
  };
}

async function logAndProtect(
  guild: GuildMember["guild"],
  input: {
    event: string;
    auditType: AuditLogEvent;
    targetId?: string;
    details: string;
    logEvent: Parameters<typeof logGuildEvent>[0]["event"];
    title: string;
    description: string;
    fields?: Array<{ name: string; value: string; inline?: boolean }>;
    channelId?: string;
    roleIds?: string[];
    isBot?: boolean;
  },
) {
  const actorId = await recentAuditActor(guild, input.auditType, input.targetId);
  await logGuildEvent({
    guild,
    event: input.logEvent,
    title: input.title,
    description: input.description,
    fields: input.fields,
    channelId: input.channelId,
    roleIds: input.roleIds,
    isBot: input.isBot,
  });
  await protectGuildEvent({
    guild,
    event: input.event,
    actorId,
    targetId: input.targetId,
    details: input.details,
  });
}

async function logMemberJoin(member: GuildMember) {
  await logGuildEvent({
    guild: member.guild,
    event: "memberJoin",
    title: "Member joined",
    description: `<@${member.id}> joined the server.`,
    fields: [
      { name: "User", value: `${member.user.tag} (${member.id})`, inline: true },
      { name: "Account created", value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
    ],
    roleIds: roleIds(member),
    isBot: member.user.bot,
  });
}

async function logMemberLeave(member: GuildMember) {
  await logGuildEvent({
    guild: member.guild,
    event: "memberLeave",
    title: "Member left",
    description: `<@${member.id}> left the server.`,
    fields: [{ name: "User", value: `${member.user.tag} (${member.id})`, inline: true }],
    roleIds: roleIds(member),
    isBot: member.user.bot,
  });
}

async function persistSystemMessage(guildId: string, marker: string, channelId: string, messageId: string) {
  const record = { guild_id: guildId, kind: "system_messages", name: marker, enabled: true, data: { marker, messageId, channelId }, updated_at: new Date().toISOString() };
  const { data: existing } = await database().from("guild_items").select("id").eq("guild_id", guildId).eq("kind", "system_messages").eq("name", marker).limit(1).maybeSingle();
  if (existing?.id) await database().from("guild_items").update(record).eq("id", existing.id).eq("guild_id", guildId);
  else await database().from("guild_items").insert(record);
}

async function upsertBotEmbed(channelId: string, marker: string, embed: EmbedBuilder) {
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased() || !("messages" in channel) || !("send" in channel)) return false;
  const guildId = "guildId" in channel && typeof channel.guildId === "string" ? channel.guildId : null;
  const saved = guildId
    ? await database().from("guild_items").select("id, data").eq("guild_id", guildId).eq("kind", "system_messages").contains("data", { marker }).maybeSingle()
    : null;
  const savedData = (saved?.data?.data ?? {}) as Record<string, unknown>;
  const savedMessageId = typeof savedData["messageId"] === "string" ? savedData["messageId"] : null;
  const existingById = savedMessageId ? await channel.messages.fetch(savedMessageId).catch(() => null) : null;
  const messages = existingById ? null : await channel.messages.fetch({ limit: 100 }).catch(() => null);
  const existing = existingById ?? messages?.find((message) => message.author.id === client.user?.id && message.embeds.some((item) => item.footer?.text === marker));
  if (existing) {
    await existing.edit({ embeds: [embed] }).catch((error: unknown) => console.error(`[Glow Bot] Could not update fixed message ${marker}`, error));
    if (guildId) await persistSystemMessage(guildId, marker, channelId, existing.id);
    return true;
  }
  const sent = await channel.send({ embeds: [embed] }).catch((error: unknown) => {
    console.error(`[Glow Bot] Could not send fixed message ${marker}`, error);
    return null;
  });
  if (sent && guildId) await persistSystemMessage(guildId, marker, channelId, sent.id);
  return Boolean(sent);
}

function fixedEmbed(marker: string, title: string, description: string, color: number) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp()
    .setFooter({ text: marker });
}

async function syncCommunityMessages() {
  await upsertBotEmbed(
    GLOW_CHANNELS.rules,
    "glow-rules",
    fixedEmbed(
      "glow-rules",
      "Glow · Server & Bot Rules",
      "Please keep the community respectful and safe. No spam, harassment, raids, scams, mass mentions or unsafe links. Follow Discord Terms of Service and the server team instructions.\n\nNeed help? Open a ticket from the Support panel.",
      0x7c5cff,
    ),
  );
  await upsertBotEmbed(
    GLOW_CHANNELS.getStarted,
    "glow-get-started",
    fixedEmbed(
      "glow-get-started",
      "Get Started with Glow",
      "Glow is a Discord community control center for protection, moderation, leveling, tickets, automation and useful server insights.\n\nStart by checking `/help`, `/profile`, `/rank`, `/balance` and `/daily`. Server managers can configure everything from the Glow Dashboard.",
      0x22c55e,
    ),
  );
  await upsertBotEmbed(
    GLOW_CHANNELS.about,
    "glow-about",
    fixedEmbed(
      "glow-about",
      "About Glow",
      "Glow brings your Discord server tools into one calm workspace: Anti-Nuke protection, AutoMod, advanced logs, support tickets, XP and leveling, economy, suggestions and automation.\n\nUseful commands include `/help`, `/user`, `/profile`, `/rank`, `/top`, `/server`, `/balance`, `/daily`, `/ticket` and `/report`.\n\nDashboard: https://glowbot.up.railway.app/",
      0x38bdf8,
    ),
  );
  const release = (process.env["RAILWAY_GIT_COMMIT_SHA"] || process.env["GLOW_RELEASE"] || "current-release").slice(0, 12);
  await upsertBotEmbed(
    GLOW_CHANNELS.updates,
    `glow-update:${release}`,
    fixedEmbed(
      `glow-update:${release}`,
      "Glow bot update",
      `${RELEASE_NOTES}\n\nThis release is active across the bot and Dashboard. Settings remain stored per server, so a restart does not reset your configuration.`,
      0x8b5cf6,
    ),
  );
}

async function syncBotStatus(status: "online" | "offline") {
  const isOnline = status === "online";
  await upsertBotEmbed(
    GLOW_CHANNELS.status,
    "glow-status",
    fixedEmbed(
      "glow-status",
      isOnline ? "Glow is Online" : "Glow is Offline",
      isOnline
        ? "The bot is connected and ready.\n\nStatus: **Idle**\nLast heartbeat: <t:${Math.floor(Date.now() / 1000)}:R>"
        : "The bot is currently offline or restarting. Discord will show the live connection state automatically.",
      isOnline ? 0x22c55e : 0xef4444,
    ),
  );
}

async function handleFixedCommunityChannels(message: Message) {
  if (message.author.bot) return;
  if (message.channelId === GLOW_CHANNELS.blueHeart) {
    await message.react("💙").catch((error: unknown) => console.error("Blue heart reaction failed", error));
  }
  if (message.channelId === GLOW_CHANNELS.suggestions) {
    await message.reply("Thanks for your suggestion! The Glow team will review it.").catch((error: unknown) => console.error("Suggestion reply failed", error));
  }
}

async function cachedMessageGuardSettings(guildId: string) {
  const cached = messageGuardCache.get(guildId);
  if (cached && cached.expiresAt > Date.now()) return cached.settings;
  const settings = await getMessageGuardSettings(guildId);
  messageGuardCache.set(guildId, { settings, expiresAt: Date.now() + 30_000 });
  return settings;
}

async function handleMessageGuard(message: Message): Promise<boolean> {
  if (!message.guild || message.author.bot) return false;
  const settings = await cachedMessageGuardSettings(message.guild.id);
  const config = settings.config;
  if (!settings.enabled || !config.channelId || config.channelId !== message.channelId) return false;

  const member = message.member ?? (await message.guild.members.fetch(message.author.id).catch(() => null));
  if (!member || member.id === message.guild.ownerId) return true;

  const reason = "Glow Message Guard: message sent in a protected room";
  let punished = false;
  if (config.punishment === "ban") {
    if (member.bannable) {
      punished = await member.ban({ reason }).then(() => true).catch((error: unknown) => {
        console.error("Message Guard ban failed", error);
        return false;
      });
    }
  } else if (member.kickable) {
    punished = await member.kick(reason).then(() => true).catch((error: unknown) => {
      console.error("Message Guard kick failed", error);
      return false;
    });
  }

  let deleted = false;
  if (punished) {
    deleted = await message.delete().then(() => true).catch((error: unknown) => {
      console.error("Message Guard could not delete message after punishment", error);
      return false;
    });
    await updateMessageGuardCounter(message.guild.id).catch((error: unknown) =>
      console.error("Message Guard counter update failed", error),
    );
    messageGuardCache.delete(message.guild.id);
  }
  await logGuildEvent({
    guild: message.guild,
    event: "moderation",
    title: "Message Guard enforcement",
    description: `${punished ? "A member was punished" : "A message was removed"} in <#${message.channelId}>.`,
    fields: [
      { name: "Member", value: `${message.author.tag} (${message.author.id})`, inline: true },
      { name: "Action", value: punished ? `${config.punishment}${deleted ? " + message deleted" : ""}` : "punishment failed; message kept", inline: true },
    ],
  }).catch((error: unknown) => console.error("Message Guard log failed", error));
  return true;
}

let shuttingDown = false;

async function shutdownBot() {
  if (shuttingDown) return;
  shuttingDown = true;
  await syncBotStatus("offline").catch((error: unknown) => console.error("Offline status update failed", error));
  client.destroy();
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(
    `[Glow Bot] Online as ${readyClient.user.tag} in ${readyClient.guilds.cache.size} server(s)`,
  );
  readyClient.user.setPresence({
    status: "idle",
    activities: [{ name: "Glow Community", type: ActivityType.Watching }],
  });
  await registerSlashCommands([...SLASH_COMMANDS]);
  console.log(`[Glow Bot] Registered ${SLASH_COMMANDS.length} slash commands`);
  await syncBotStatus("online").catch((error: unknown) => console.error("Online status sync failed", error));
  await syncCommunityMessages().catch((error: unknown) => console.error("Community message sync failed", error));
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isButton() && isMessageGuardCounterButton(interaction.customId)) {
    await interaction.reply({
      content: "This counter is informational only. No action is taken when you press it.",
      ephemeral: true,
    });
    return;
  }
  if (interaction.isButton() && isScamReviewButton(interaction.customId)) {
    await handleScamReviewButton(interaction).catch((error: unknown) => {
      console.error("[Glow Bot] Scam review interaction failed", error);
      if (!interaction.replied && !interaction.deferred) {
        void interaction.reply({ content: "Could not review this scam report.", ephemeral: true }).catch(() => undefined);
      }
    });
    return;
  }
  if (interaction.isModalSubmit() && interaction.customId === "glow_ticket_open_modal") {
    await createTicketFromModal(interaction).catch((error: unknown) => {
      console.error("[Glow Bot] Ticket modal failed", error);
      if (!interaction.replied && !interaction.deferred) void interaction.reply({ content: "Could not open the ticket. Please check Glow's permissions and try again.", ephemeral: true }).catch(() => undefined);
      else void interaction.editReply("Could not open the ticket. Please check Glow's permissions and try again.").catch(() => undefined);
    });
    return;
  }
  if (interaction.isButton() && interaction.customId.startsWith("glow_ticket_")) {
    await handleTicketButton(interaction).catch((error: unknown) => {
      console.error("[Glow Bot] Ticket interaction failed", error);
      if (!interaction.replied && !interaction.deferred)
        void interaction.reply({ content: "حدث خطأ في التذكرة.", ephemeral: true }).catch(() => undefined);
    });
    return;
  }
  if (!interaction.isChatInputCommand()) return;
  try {
    const settings = await moduleConfig(interaction.guildId ?? "", "commands");
    const disabled = Array.isArray(settings.config.disabled)
      ? settings.config.disabled.filter((item): item is string => typeof item === "string")
      : [];
    if (!settings.enabled || disabled.includes(interaction.commandName)) {
      await interaction.reply({ content: "هذا الأمر معطل من لوحة Glow لهذا السيرفر.", ephemeral: true });
      return;
    }
    const payload = interactionPayload(interaction);
    if (interaction.commandName === "user" || interaction.commandName === "profile" || interaction.commandName === "balance") {
      const card = await handleDiscordCardCommand(payload);
      if (!card) throw new Error("Card command did not return an image");
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x7c5cff)
            .setTitle(card.title)
            .setDescription(card.description ?? "English profile card · live Discord and Glow data")
            .setImage(`attachment://${card.filename}`)
            .setFooter({ text: "Glow · Community progression" }),
        ],
        files: [{ attachment: card.buffer, name: card.filename }],
      });
      return;
    }
    const response = await handleDiscordInteraction(payload, SITE_URL);
    const body = (await response.json()) as {
      data?: { content?: string; embeds?: Array<Record<string, unknown>>; flags?: number };
    };
    await interaction.reply({
      content: body.data?.content,
      embeds: (body.data?.embeds ?? []) as never[],
      ephemeral: Boolean((body.data?.flags ?? 0) & 64),
    });
  } catch (error) {
    console.error("[Glow Bot] Slash command failed", error);
    if (interaction.replied || interaction.deferred)
      await interaction
        .followUp({ content: "حدث خطأ غير متوقع.", ephemeral: true })
        .catch(() => undefined);
    else
      await interaction
        .reply({ content: "حدث خطأ غير متوقع.", ephemeral: true })
        .catch(() => undefined);
  }
});

client.on(Events.GuildMemberAdd, async (member) => {
  await ensureUser(member).catch((error: unknown) => console.error("User setup failed", error));
  await handleWelcome(member).catch((error: unknown) => console.error("Welcome failed", error));
  await handleAutoroles(member).catch((error: unknown) =>
    console.error("Auto-roles failed", error),
  );
  await logMemberJoin(member).catch((error: unknown) => console.error("Member join log failed", error));
  if (member.user.bot) {
    await logAndProtect(member.guild, {
      event: "botAdd",
      auditType: AuditLogEvent.BotAdd,
      targetId: member.id,
      details: `Bot added: ${member.user.tag}`,
      logEvent: "memberJoin",
      title: "Bot added",
      description: `<@${member.id}> was added to the server.`,
      fields: [{ name: "Bot", value: `${member.user.tag} (${member.id})`, inline: true }],
      isBot: true,
    }).catch((error: unknown) => console.error("Bot add protection failed", error));
  }
});

client.on(Events.GuildMemberRemove, async (member) => {
  await logMemberLeave(member).catch((error: unknown) => console.error("Member leave log failed", error));
  const actorId = await recentAuditActor(member.guild, AuditLogEvent.MemberKick, member.id);
  if (actorId) {
    await protectGuildEvent({ guild: member.guild, event: "memberKick", actorId, targetId: member.id, details: `Member kicked: ${member.user.tag}` }).catch((error: unknown) => console.error("Kick protection failed", error));
  }
});

client.on(Events.GuildBanAdd, async (ban) => {
  await logAndProtect(ban.guild, {
    event: "memberBan",
    auditType: AuditLogEvent.MemberBanAdd,
    targetId: ban.user.id,
    details: `Member ban for ${ban.user.tag}`,
    logEvent: "memberBan",
    title: "Member banned",
    description: `<@${ban.user.id}> was banned from the server.`,
    fields: [{ name: "User", value: `${ban.user.tag} (${ban.user.id})`, inline: true }],
    isBot: ban.user.bot,
  }).catch((error: unknown) => console.error("Ban log/protection failed", error));
});

client.on(Events.GuildUpdate, async (oldGuild, newGuild) => {
  if (oldGuild.name === newGuild.name && oldGuild.icon === newGuild.icon && oldGuild.verificationLevel === newGuild.verificationLevel) return;
  await logAndProtect(newGuild, {
    event: "serverUpdate",
    auditType: AuditLogEvent.GuildUpdate,
    targetId: newGuild.id,
    details: "Server settings were updated",
    logEvent: "moderation",
    title: "Server updated",
    description: "Server name, icon or verification settings changed.",
    fields: [{ name: "Server", value: newGuild.name, inline: true }],
  }).catch((error: unknown) => console.error("Server update log/protection failed", error));
});

client.on(Events.GuildBanRemove, async (ban) => {
  const actorId = await recentAuditActor(ban.guild, AuditLogEvent.MemberBanRemove, ban.user.id);
  await logGuildEvent({
    guild: ban.guild,
    event: "memberUnban",
    title: "Member unbanned",
    description: `<@${ban.user.id}> was unbanned from the server.`,
    fields: [
      { name: "User", value: `${ban.user.tag} (${ban.user.id})`, inline: true },
      ...(actorId ? [{ name: "Moderator", value: `<@${actorId}>`, inline: true }] : []),
    ],
    isBot: ban.user.bot,
  }).catch((error: unknown) => console.error("Unban log failed", error));
});

client.on(Events.MessageDelete, async (message) => {
  if (!message.guild) return;
  await logGuildEvent({
    guild: message.guild,
    event: "messageDelete",
    title: "Message deleted",
    description: `A message was deleted in <#${message.channelId}>.`,
    fields: [
      ...(message.author ? [{ name: "Author", value: `${message.author.tag} (${message.author.id})`, inline: true }] : []),
      { name: "Channel", value: `<#${message.channelId}>`, inline: true },
    ],
    channelId: message.channelId,
    isBot: message.author?.bot,
    messageContent: message.content || undefined,
  });
});

client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
  if (!newMessage.guild) return;
  const before = oldMessage.content || "(content unavailable)";
  const after = newMessage.content || "(content unavailable)";
  if (before === after) return;
  await logGuildEvent({
    guild: newMessage.guild,
    event: "messageUpdate",
    title: "Message edited",
    description: `A message was edited in <#${newMessage.channelId}>.`,
    fields: [
      ...(newMessage.author ? [{ name: "Author", value: `${newMessage.author.tag} (${newMessage.author.id})`, inline: true }] : []),
      { name: "Jump", value: `[Open message](${newMessage.url})`, inline: true },
    ],
    channelId: newMessage.channelId,
    isBot: newMessage.author?.bot,
    messageContent: `Before: ${before}\nAfter: ${after}`,
  });
});

client.on(Events.ChannelCreate, async (channel) => {
  await logAndProtect(channel.guild, {
    event: "channelCreate",
    auditType: AuditLogEvent.ChannelCreate,
    targetId: channel.id,
    details: `Channel created: ${channel.name}`,
    logEvent: "channelCreate",
    title: "Channel created",
    description: `**${channel.name}** was created.`,
    fields: [{ name: "Channel", value: `<#${channel.id}> (${channel.type})`, inline: true }],
    channelId: channel.id,
  }).catch((error: unknown) => console.error("Channel create log/protection failed", error));
});

client.on(Events.ChannelDelete, async (channel) => {
  await logAndProtect(channel.guild, {
    event: "channelDelete",
    auditType: AuditLogEvent.ChannelDelete,
    targetId: channel.id,
    details: `Channel deleted: ${channel.name}`,
    logEvent: "channelDelete",
    title: "Channel deleted",
    description: `**${channel.name}** was deleted.`,
    fields: [{ name: "Channel", value: `${channel.name} (${channel.id})`, inline: true }],
  }).catch((error: unknown) => console.error("Channel delete log/protection failed", error));
});

client.on(Events.ChannelUpdate, async (oldChannel, newChannel) => {
  if (oldChannel.name === newChannel.name && oldChannel.parentId === newChannel.parentId) return;
  await logGuildEvent({
    guild: newChannel.guild,
    event: "channelUpdate",
    title: "Channel updated",
    description: `**${newChannel.name}** was updated.`,
    fields: [
      { name: "Before", value: oldChannel.name, inline: true },
      { name: "After", value: newChannel.name, inline: true },
    ],
    channelId: newChannel.id,
  }).catch((error: unknown) => console.error("Channel update log failed", error));
});

client.on(Events.RoleCreate, async (role) => {
  await logAndProtect(role.guild, {
    event: "roleCreate",
    auditType: AuditLogEvent.RoleCreate,
    targetId: role.id,
    details: `Role created: ${role.name}`,
    logEvent: "roleCreate",
    title: "Role created",
    description: `The role **${role.name}** was created.`,
    fields: [{ name: "Role", value: roleDetails(role), inline: true }],
  }).catch((error: unknown) => console.error("Role create log/protection failed", error));
});

client.on(Events.RoleDelete, async (role) => {
  await logAndProtect(role.guild, {
    event: "roleDelete",
    auditType: AuditLogEvent.RoleDelete,
    targetId: role.id,
    details: `Role deleted: ${role.name}`,
    logEvent: "roleDelete",
    title: "Role deleted",
    description: `The role **${role.name}** was deleted.`,
    fields: [{ name: "Role", value: roleDetails(role), inline: true }],
  }).catch((error: unknown) => console.error("Role delete log/protection failed", error));
});

client.on(Events.RoleUpdate, async (oldRole, newRole) => {
  if (oldRole.name === newRole.name && oldRole.color === newRole.color && oldRole.permissions.bitfield === newRole.permissions.bitfield) return;
  await logGuildEvent({
    guild: newRole.guild,
    event: "roleUpdate",
    title: "Role updated",
    description: `The role **${newRole.name}** was updated.`,
    fields: [
      { name: "Before", value: oldRole.name, inline: true },
      { name: "After", value: newRole.name, inline: true },
    ],
  }).catch((error: unknown) => console.error("Role update log failed", error));
});

client.on(Events.WebhooksUpdate, async (channel) => {
  await logAndProtect(channel.guild, {
    event: "webhookCreate",
    auditType: AuditLogEvent.WebhookCreate,
    details: `Webhook activity in ${channel.name}`,
    logEvent: "channelUpdate",
    title: "Webhook activity",
    description: `A webhook was created or updated in **${channel.name}**.`,
    channelId: channel.id,
  }).catch((error: unknown) => console.error("Webhook log/protection failed", error));
});

client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
  const rolesChanged = oldMember.roles.cache.size !== newMember.roles.cache.size || oldMember.roles.cache.some((role) => !newMember.roles.cache.has(role.id));
  if (!rolesChanged && oldMember.nickname === newMember.nickname) return;
  await logAndProtect(newMember.guild, {
    event: rolesChanged ? "massRoleChange" : "memberUpdate",
    auditType: rolesChanged ? AuditLogEvent.MemberRoleUpdate : AuditLogEvent.MemberUpdate,
    targetId: newMember.id,
    details: `Member update for ${newMember.user.tag}`,
    logEvent: "memberUpdate",
    title: rolesChanged ? "Member roles updated" : "Member updated",
    description: `<@${newMember.id}> had a profile or role update.`,
    fields: [{ name: "Member", value: `${newMember.user.tag} (${newMember.id})`, inline: true }],
    roleIds: roleIds(newMember),
    isBot: newMember.user.bot,
  }).catch((error: unknown) => console.error("Member update log/protection failed", error));
});

client.on(Events.MessageCreate, async (message) => {
  if (message.guild) {
    const contentLength = (message.content || message.cleanContent || "").length;
    console.log(
      `[Glow Bot] MessageCreate guild=${message.guild.id} channel=${message.channelId} authorBot=${message.author.bot} contentLength=${contentLength}`,
    );
  }
  const guarded = await handleMessageGuard(message).catch((error: unknown) => {
    console.error("Message Guard failed", error);
    return false;
  });
  if (guarded) return;
  await handleFixedCommunityChannels(message).catch((error: unknown) =>
    console.error("Fixed community channel action failed", error),
  );
  await handleProtectionMessage(message).catch((error: unknown) =>
    console.error("Protection message check failed", error),
  );
  await handleAutomations(message).catch((error: unknown) =>
    console.error("Automation failed", error),
  );
  await handleLeveling(message).catch((error: unknown) => console.error("Leveling failed", error));
});

client.on(Events.MessageReactionAdd, async (reaction, user) => {
  if (user.bot) return;
  const guildId = reaction.message.guildId;
  if (!guildId) return;
  const settings = await cachedMessageGuardSettings(guildId).catch((error: unknown) => {
    console.error("Message Guard reaction check failed", error);
    return null;
  });
  if (!settings?.enabled || settings.config.channelId !== reaction.message.channelId) return;
  if (reaction.partial) await reaction.fetch().catch(() => undefined);
  await reaction.users.remove(user.id).catch((error: unknown) =>
    console.error("Message Guard reaction removal failed", error),
  );
});

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  await handleTempVoice(oldState, newState).catch((error: unknown) =>
    console.error("Temp voice failed", error),
  );
  if (oldState.channelId === newState.channelId && oldState.serverMute === newState.serverMute && oldState.serverDeaf === newState.serverDeaf) return;
  const member = newState.member ?? oldState.member;
  if (member) {
    await logGuildEvent({
      guild: newState.guild,
      event: "voiceState",
      title: "Voice activity",
      description: `<@${member.id}> changed voice state.`,
      fields: [
        { name: "Before", value: oldState.channelId ? `<#${oldState.channelId}>` : "Not connected", inline: true },
        { name: "After", value: newState.channelId ? `<#${newState.channelId}>` : "Not connected", inline: true },
      ],
      isBot: member.user.bot,
    });
  }
});

client.on(Events.Error, (error) => console.error("[Glow Bot] Discord client error", error));

process.on("SIGTERM", () => void shutdownBot());
process.on("SIGINT", () => void shutdownBot());

client.login(botToken()).catch((error: unknown) => {
  console.error("[Glow Bot] Login failed. Check DISCORD_BOT_TOKEN and enabled intents.", error);
  process.exitCode = 1;
});
