import { createFileRoute } from "@tanstack/react-router";
import { CLIENT_ID } from "@/lib/discord-api.server";
import { callbackUrl } from "@/lib/origin.server";

export const Route = createFileRoute("/api/public/auth/discord/login")({
  server: {
    handlers: {
      GET: async ({ request }) => {
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
