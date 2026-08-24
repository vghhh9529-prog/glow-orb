import { MODULE_KEYS } from "../src/lib/discord";
import { MODULE_DEFAULTS, withDefaults } from "../src/lib/module-defaults";

const requiredModules = ["protection", "logging", "tickets"] as const;
for (const module of requiredModules) {
  if (!MODULE_KEYS.includes(module)) throw new Error(`Missing module key: ${module}`);
  if (!MODULE_DEFAULTS[module]) throw new Error(`Missing defaults: ${module}`);
}

const protection = withDefaults("protection", { rules: { channelDelete: { enabled: true } } });
if (!(protection.rules as Record<string, Record<string, unknown>>).channelDelete.enabled) throw new Error("Protection defaults did not merge");

const logging = withDefaults("logging", { enabledEvents: ["messageDelete"], colors: { message: "#ffffff" } });
if (!(logging.enabledEvents as string[]).includes("messageDelete")) throw new Error("Logging defaults did not merge");
if ((logging.colors as Record<string, unknown>).message !== "#ffffff") throw new Error("Logging color did not merge");

const tickets = withDefaults("tickets", { maxOpenPerUser: 2, allowPriorityChange: false });
if (tickets.maxOpenPerUser !== 2 || tickets.allowPriorityChange !== false) throw new Error("Ticket defaults did not merge");

console.log("security/ticket defaults ok");
