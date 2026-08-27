import { handleDiscordInteraction } from "../src/lib/discord-interactions.server";
import { SLASH_COMMANDS } from "../src/lib/slash-commands";
import { COMMAND_CATALOG } from "../src/lib/command-catalog";
import { configuredPublicOrigin, DEFAULT_PUBLIC_ORIGIN } from "../src/lib/origin.server";

const required = [
  "daily",
  "balance",
  "rank",
  "leaderboard",
  "suggest",
  "glow",
  "profile",
  "server",
  "roles",
  "colors",
  "points-list",
  "roll",
  "top",
  "banner",
  "server-avatar",
  "server-banner",
  "clear",
  "kick",
  "ban",
  "unban",
  "timeout",
  "untimeout",
  "warn-add",
  "warnings",
  "ping",
  "user",
  "avatar",
  "help",
  "get-emojis",
  "color-set",
  "invites",
  "reset",
  "setlevel",
  "setxp",
  "hide",
  "show",
  "lock",
  "unlock",
  "slowmode",
  "inrole",
  "move",
  "mute-check",
  "role",
  "rar",
  "setnick",
  "vkick",
  "warn-remove",
  "points",
  "points-reset",
] as const;
const names = SLASH_COMMANDS.map((command) => command.name);
if (names.length !== required.length) {
  throw new Error(`Expected ${required.length} slash commands, found ${names.length}`);
}
if (COMMAND_CATALOG.length !== 86) {
  throw new Error(`Expected 86 catalog entries, found ${COMMAND_CATALOG.length}`);
}
const liveCatalog = COMMAND_CATALOG.filter((command) => command.supported).map((command) => command.name);
if (liveCatalog.length !== names.length || names.some((name) => !liveCatalog.includes(name))) {
  throw new Error("Command catalog and registered commands are out of sync");
}
for (const name of required) {
  if (!names.includes(name)) throw new Error(`Missing slash command: ${name}`);
}

const originalPublicAppUrl = process.env["PUBLIC_APP_URL"];
process.env["PUBLIC_APP_URL"] = "https://id-preview--fa584a01-062d-40c8-a629-78cea86c73db.lovable.app";
if (configuredPublicOrigin() !== DEFAULT_PUBLIC_ORIGIN) {
  throw new Error("Production dashboard origin must not use the old Lovable preview domain");
}
if (originalPublicAppUrl === undefined) delete process.env["PUBLIC_APP_URL"];
else process.env["PUBLIC_APP_URL"] = originalPublicAppUrl;

const response = await handleDiscordInteraction(
  {
    type: 2,
    guild_id: "test-guild",
    member: { user: { id: "test-user", username: "tester", global_name: "Tester" } },
    data: { name: "help", options: [] },
  },
  "https://example.test",
);
const body = (await response.json()) as {
  type?: number;
  data?: { content?: string; embeds?: Array<{ description?: string }> };
};
const helpDescription = body.data?.embeds?.[0]?.description ?? body.data?.content ?? "";
if (
  body.type !== 4 ||
  !helpDescription.includes("/server") ||
  !helpDescription.includes("/roles") ||
  !helpDescription.includes("/colors") ||
  !helpDescription.includes("/server-banner") ||
  !helpDescription.includes("/ping") ||
  !helpDescription.includes("/avatar") ||
  !helpDescription.includes("/clear")
) {
  throw new Error("/help smoke response is invalid");
}

const deniedResponse = await handleDiscordInteraction(
  {
    type: 2,
    guild_id: "test-guild",
    channel_id: "test-channel",
    member: { user: { id: "test-user", username: "tester" }, permissions: "0" },
    data: { name: "clear", options: [{ name: "amount", value: 10 }] },
  },
  "https://example.test",
);
const deniedBody = (await deniedResponse.json()) as { type?: number; data?: { content?: string; embeds?: Array<{ description?: string }> } };
const deniedText = deniedBody.data?.embeds?.[0]?.description ?? deniedBody.data?.content ?? "";
if (deniedBody.type !== 4 || !deniedText.includes("صلاحية")) {
  throw new Error("Permission denial smoke response is invalid");
}

const invalidResponse = await handleDiscordInteraction(
  {
    type: 2,
    guild_id: "test-guild",
    member: { user: { id: "test-user", username: "tester" }, permissions: "8" },
    data: { name: "points-reset", options: [] },
  },
  "https://example.test",
);
const invalidBody = (await invalidResponse.json()) as { type?: number; data?: { content?: string; embeds?: Array<{ description?: string }> } };
const invalidText = invalidBody.data?.embeds?.[0]?.description ?? invalidBody.data?.content ?? "";
if (invalidBody.type !== 4 || !invalidText.includes("اختر عضواً")) {
  throw new Error("Invalid option smoke response is invalid");
}

console.log(`[Glow Test] ${names.length} slash commands registered; /help, permission denial, invalid-option responses, and production origin fallback passed`);
