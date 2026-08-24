import { handleDiscordInteraction } from "../src/lib/discord-interactions.server";
import { SLASH_COMMANDS } from "../src/lib/slash-commands";
import { COMMAND_CATALOG } from "../src/lib/command-catalog";

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
] as const;
const names = SLASH_COMMANDS.map((command) => command.name);
if (names.length !== required.length) {
  throw new Error(`Expected ${required.length} slash commands, found ${names.length}`);
}
if (COMMAND_CATALOG.length !== 87) {
  throw new Error(`Expected 87 catalog entries, found ${COMMAND_CATALOG.length}`);
}
const liveCatalog = COMMAND_CATALOG.filter((command) => command.supported).map((command) => command.name);
if (liveCatalog.length !== names.length || names.some((name) => !liveCatalog.includes(name))) {
  throw new Error("Command catalog and registered commands are out of sync");
}
for (const name of required) {
  if (!names.includes(name)) throw new Error(`Missing slash command: ${name}`);
}

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

console.log(`[Glow Test] ${names.length} slash commands registered and /help response passed`);
