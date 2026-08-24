import "dotenv/config";

import { REST, Routes } from "discord.js";

import { CLIENT_ID, botToken } from "../src/lib/discord-api.server";
import { SLASH_COMMANDS } from "../src/lib/slash-commands";

const rest = new REST({ version: "10" }).setToken(botToken());

try {
  const result = await rest.put(Routes.applicationCommands(CLIENT_ID), {
    body: [...SLASH_COMMANDS],
  });
  console.log(
    `[Glow Bot] Registered ${Array.isArray(result) ? result.length : 0} global slash commands.`,
  );
} catch (error) {
  console.error("[Glow Bot] Slash command registration failed", error);
  process.exitCode = 1;
}
