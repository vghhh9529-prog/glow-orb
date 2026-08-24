import { handleDiscordInteraction } from "../src/lib/discord-interactions.server";
import { SLASH_COMMANDS } from "../src/lib/slash-commands";

const required = [
  "daily",
  "balance",
  "rank",
  "leaderboard",
  "suggest",
  "glow",
  "profile",
  "server",
  "user",
  "avatar",
  "help",
];
const names = SLASH_COMMANDS.map((command) => command.name);
for (const name of required) {
  if (!names.includes(name as (typeof names)[number]))
    throw new Error(`Missing slash command: ${name}`);
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
const body = (await response.json()) as { type?: number; data?: { content?: string } };
if (
  body.type !== 4 ||
  !body.data?.content?.includes("/server") ||
  !body.data.content.includes("/avatar")
) {
  throw new Error("/help smoke response is invalid");
}

console.log(`[Glow Test] ${required.length} slash commands registered and /help response passed`);
