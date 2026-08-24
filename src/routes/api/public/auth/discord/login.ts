import { createFileRoute } from "@tanstack/react-router";
import { CLIENT_ID } from "@/lib/discord-api.server";
import { callbackUrl } from "@/lib/origin.server";
import { allowRateLimit, requestAddress } from "@/lib/rate-limit.server";

export const Route = createFileRoute("/api/public/auth/discord/login")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!allowRateLimit(`oauth-login:${requestAddress(request)}`, 12, 10 * 60_000)) {
          return new Response("Too many login attempts. Try again later.", {
            status: 429,
            headers: { "Retry-After": "600", "Content-Type": "text/plain; charset=utf-8" },
          });
        }
        const state = crypto.randomUUID();
        const url = new URL(request.url);
        const next = url.searchParams.get("next") ?? "/dashboard";

        const params = new URLSearchParams({
          client_id: CLIENT_ID,
          redirect_uri: callbackUrl(request),
          response_type: "code",
          scope: "identify email guilds",
          prompt: "consent",
          state,
        });

        const headers = new Headers();
        headers.append("Location", `https://discord.com/oauth2/authorize?${params.toString()}`);
        headers.append(
          "Set-Cookie",
          `glow_oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=600`,
        );
        headers.append(
          "Set-Cookie",
          `glow_oauth_next=${encodeURIComponent(next.startsWith("/") ? next : "/dashboard")}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=600`,
        );
        return new Response(null, { status: 302, headers });
      },
    },
  },
});
