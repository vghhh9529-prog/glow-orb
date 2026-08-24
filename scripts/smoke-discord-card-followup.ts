import { sendDiscordCardFollowup, type DiscordCardInteractionResult } from "../src/lib/discord-interactions.server";

const originalFetch = globalThis.fetch;
let captured: { url: string; method?: string; body?: BodyInit | null } | null = null;
globalThis.fetch = (async (input, init) => {
  captured = { url: String(input), method: init?.method, body: init?.body };
  return new Response(null, { status: 204 });
}) as typeof fetch;

try {
  const card: DiscordCardInteractionResult = {
    buffer: Buffer.from("fake-png-bytes"),
    filename: "glow-user-card.png",
    title: "Glow User Card",
  };
  await sendDiscordCardFollowup(
    { type: 2, token: "smoke-interaction-token", data: { name: "user" } },
    card,
  );
  if (!captured || captured.method !== "POST" || !captured.url.includes("/webhooks/1450816538377715782/")) {
    throw new Error("Follow-up webhook was not called correctly");
  }
  if (!(captured.body instanceof FormData)) throw new Error("Follow-up body is not multipart FormData");
  if (!captured.body.has("payload_json") || !captured.body.has("files[0]")) {
    throw new Error("Follow-up is missing payload_json or PNG attachment");
  }
  console.log("discord card follow-up ok: deferred interaction -> multipart PNG");
} finally {
  globalThis.fetch = originalFetch;
}
