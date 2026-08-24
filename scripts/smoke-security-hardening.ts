delete process.env.PUBLIC_APP_URL;
process.env.NODE_ENV = "production";

const { withSecurityHeaders } = await import("../src/lib/security-headers");
const { requestOrigin } = await import("../src/lib/origin.server");
const { withDefaults } = await import("../src/lib/module-defaults");

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

const config = withDefaults(
  "welcome",
  JSON.parse('{"__proto__":{"polluted":true},"embed":{"constructor":{"polluted":true}}}'),
);
if (({} as { polluted?: boolean }).polluted) throw new Error("prototype pollution detected");
if ((config["__proto__"] as { polluted?: boolean } | undefined)?.polluted) {
  throw new Error("unsafe config key persisted");
}

console.log("[Glow Test] security headers, origin hardening and config-key checks passed");
