import { upsertChannelMessage } from "../src/lib/discord-api.server";

process.env["DISCORD_BOT_TOKEN"] = "smoke-token";
const calls: Array<{ method: string; url: string }> = [];
const originalFetch = globalThis.fetch;
let attempt = 0;
globalThis.fetch = (async (input, init) => {
  const url = String(input);
  calls.push({ method: init?.method ?? "GET", url });
  attempt += 1;
  if (attempt === 1) return new Response("message not found", { status: 404 });
  return new Response(JSON.stringify({ id: "fresh-message-id" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}) as typeof fetch;

try {
  const result = await upsertChannelMessage("123456789012345678", "old-message-id", {
    embeds: [{ title: "Smoke panel" }],
  });
  if (!result.ok || result.id !== "fresh-message-id") throw new Error("Fallback did not create a new panel");
  if (calls[0]?.method !== "PATCH" || calls[1]?.method !== "POST") throw new Error("Expected PATCH then POST fallback");
  console.log("ticket publish fallback ok: PATCH 404 -> POST fresh panel");
} finally {
  globalThis.fetch = originalFetch;
}
