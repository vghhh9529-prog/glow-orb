delete process.env.PUBLIC_APP_URL;
process.env.NODE_ENV = "production";

const { withSecurityHeaders } = await import("../src/lib/security-headers");
const { requestOrigin } = await import("../src/lib/origin.server");
const { withDefaults } = await import("../src/lib/module-defaults");
const { allowRateLimit } = await import("../src/lib/rate-limit.server");
const { isFreshDiscordTimestamp } = await import("../src/lib/discord-interactions.server");

const secured = withSecurityHeaders(new Response("ok"));
for (const [name, expected] of [
  ["x-frame-options", "DENY"],
  ["x-content-type-options", "nosniff"],
  ["referrer-policy", "strict-origin-when-cross-origin"],
  ["strict-transport-security", "max-age=31536000; includeSubDomains"],
] as const) {
  if (secured.headers.get(name) !== expected) throw new Error(`missing security header: ${name}`);
}
if (!secured.headers.get("content-security-policy")?.includes("frame-ancestors 'none'")) {
  throw new Error("CSP frame protection missing");
}

const origin = requestOrigin(
  new Request("https://glowbot.up.railway.app/api/public/auth/discord/login", {
    headers: { "x-forwarded-host": "attacker.example", "x-forwarded-proto": "http" },
  }),
);
if (origin !== "https://glowbot.up.railway.app") throw new Error(`forwarded host was trusted: ${origin}`);

process.env.PUBLIC_APP_URL = "https://id-preview--fa584a01-062d-40c8-a629-78cea86c73db.lovable.app";
const previewOrigin = requestOrigin(new Request("https://glowbot.up.railway.app/"));
if (previewOrigin !== "https://glowbot.up.railway.app") throw new Error(`preview origin was trusted: ${previewOrigin}`);
delete process.env.PUBLIC_APP_URL;

const rateKey = `security-smoke-${Date.now()}`;
if (!allowRateLimit(rateKey, 1, 60_000)) throw new Error("rate limit rejected the first request");
if (allowRateLimit(rateKey, 1, 60_000)) throw new Error("rate limit allowed an excessive request");

const now = Date.now();
if (!isFreshDiscordTimestamp(String(Math.floor(now / 1000)), now)) throw new Error("fresh Discord timestamp was rejected");
if (isFreshDiscordTimestamp(String(Math.floor((now - 6 * 60_000) / 1000)), now)) throw new Error("stale Discord timestamp was accepted");

const config = withDefaults(
  "welcome",
  JSON.parse('{"__proto__":{"polluted":true},"embed":{"constructor":{"polluted":true}}}'),
);
if (({} as { polluted?: boolean }).polluted) throw new Error("prototype pollution detected");
if ((config["__proto__"] as { polluted?: boolean } | undefined)?.polluted) {
  throw new Error("unsafe config key persisted");
}

console.log("[Glow Test] security headers, origin, rate-limit, replay-window, and config-key checks passed");
