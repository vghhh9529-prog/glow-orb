const DISCORD_PREVIEW_REDIRECT_URI =
  "https://id-preview--fa584a01-062d-40c8-a629-78cea86c73db.lovable.app/api/public/auth/discord/callback";
const DISCORD_CALLBACK_PATH = "/api/public/auth/discord/callback";

function configuredRedirectUri(request?: Request) {
  const configured = process.env["DISCORD_REDIRECT_URI"]?.trim();
  if (configured) return configured;

  // Use the actual deployment origin so the live Lovable site does not send
  // users back to the preview project after Discord authorization.
  if (request) return `${requestOrigin(request)}${DISCORD_CALLBACK_PATH}`;

  return DISCORD_PREVIEW_REDIRECT_URI;
}

export function requestOrigin(request: Request): string {
  const configured = process.env["PUBLIC_APP_URL"]?.trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // Fall through to the origin from the server-owned Request URL.
    }
  }

  // Do not trust x-forwarded-host/proto supplied by an untrusted client. Railway's
  // server Request URL already represents the public host at this boundary.
  return new URL(request.url).origin;
}

export function callbackUrl(request: Request): string {
  return configuredRedirectUri(request);
}
