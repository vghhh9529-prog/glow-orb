export const DEFAULT_PUBLIC_ORIGIN = "https://glowbot.up.railway.app";
const DISCORD_CALLBACK_PATH = "/api/public/auth/discord/callback";

function isValidPublicOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || parsed.hostname.endsWith(".lovable.app")) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

export function configuredPublicOrigin(): string {
  return isValidPublicOrigin(process.env["PUBLIC_APP_URL"]?.trim()) ?? DEFAULT_PUBLIC_ORIGIN;
}
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
  const configured = isValidPublicOrigin(process.env["PUBLIC_APP_URL"]?.trim());
  if (configured) return configured;

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
