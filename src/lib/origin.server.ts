const DEFAULT_PUBLIC_ORIGIN = "https://glowbot.up.railway.app";
const DISCORD_CALLBACK_PATH = "/api/public/auth/discord/callback";
const DEFAULT_DISCORD_REDIRECT_URI = `${DEFAULT_PUBLIC_ORIGIN}${DISCORD_CALLBACK_PATH}`;

function configuredRedirectUri(request?: Request) {
  const configured = process.env["DISCORD_REDIRECT_URI"]?.trim();
  if (configured) {
    try {
      const parsed = new URL(configured);
      const isValidHttpsCallback =
        parsed.protocol === "https:" &&
        parsed.pathname === DISCORD_CALLBACK_PATH &&
        !parsed.search &&
        !parsed.hash;
      if (isValidHttpsCallback) return parsed.toString();
    } catch {
      // Fall through to the fixed HTTPS callback.
    }
  }

  return request ? `${requestOrigin(request)}${DISCORD_CALLBACK_PATH}` : DEFAULT_DISCORD_REDIRECT_URI;
}

export function requestOrigin(request: Request): string {
  const configured = process.env["PUBLIC_APP_URL"]?.trim();
  if (configured) {
    try {
      const parsed = new URL(configured);
      if (parsed.protocol === "https:") return parsed.origin;
    } catch {
      // Fall through to the server-owned Request URL.
    }
  }

  const requestUrl = new URL(request.url);
  // Railway should terminate TLS before the app. If an old HTTP environment
  // variable or proxy URL slips through in production, never emit an HTTP OAuth URI.
  if (process.env["NODE_ENV"] === "production" && requestUrl.protocol !== "https:") {
    return DEFAULT_PUBLIC_ORIGIN;
  }
  return requestUrl.origin;
}

export function callbackUrl(request: Request): string {
  return configuredRedirectUri(request);
}
