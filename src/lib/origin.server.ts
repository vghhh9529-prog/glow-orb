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
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost ?? url.host;
  const proto =
    request.headers.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`;
}

export function callbackUrl(request: Request): string {
  return configuredRedirectUri(request);
}
