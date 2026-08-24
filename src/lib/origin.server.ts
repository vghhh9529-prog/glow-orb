const DISCORD_PREVIEW_REDIRECT_URI =
  "https://id-preview--fa584a01-062d-40c8-a629-78cea86c73db.lovable.app/api/public/auth/discord/callback";

function configuredRedirectUri() {
  return process.env["DISCORD_REDIRECT_URI"]?.trim() || DISCORD_PREVIEW_REDIRECT_URI;
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

export function callbackUrl(_request: Request): string {
  return configuredRedirectUri();
}
