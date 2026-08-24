process.env.NODE_ENV = "production";
process.env.PUBLIC_APP_URL = "http://glowbot.up.railway.app";
process.env.DISCORD_REDIRECT_URI = "http://glowbot.up.railway.app/api/public/auth/discord/callback";

const { callbackUrl, requestOrigin } = await import("../src/lib/origin.server");
const request = new Request("http://glowbot.up.railway.app/api/public/auth/discord/login");
const expected = "https://glowbot.up.railway.app/api/public/auth/discord/callback";
if (callbackUrl(request) !== expected) throw new Error(`unexpected callback: ${callbackUrl(request)}`);
if (requestOrigin(request) !== "https://glowbot.up.railway.app") throw new Error("HTTP origin was not hardened");

process.env.DISCORD_REDIRECT_URI = "https://custom.example.com/api/public/auth/discord/callback";
if (callbackUrl(request) !== "https://custom.example.com/api/public/auth/discord/callback") {
  throw new Error("valid HTTPS callback was not preserved");
}

console.log("[Glow Test] OAuth callback HTTPS hardening passed");
