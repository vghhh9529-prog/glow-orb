import { createFileRoute } from "@tanstack/react-router";
import { exchangeCode, fetchCurrentUser } from "@/lib/discord-api.server";
import { callbackUrl, requestOrigin } from "@/lib/origin.server";
import { SESSION_TTL_DAYS, buildSessionCookie } from "@/lib/session.server";

function cookies(request: Request): Record<string, string> {
  const out: Record<string, string> = {};
  const header = request.headers.get("cookie");
  if (!header) return out;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k) out[k] = decodeURIComponent(rest.join("="));
  }
  return out;
}

export const Route = createFileRoute("/api/public/auth/discord/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = requestOrigin(request);
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const jar = cookies(request);

        const fail = (reason: string) =>
          new Response(null, {
            status: 302,
            headers: { Location: `${origin}/?auth_error=${encodeURIComponent(reason)}` },
          });

        if (!code) return fail(url.searchParams.get("error") ?? "missing_code");
        if (!state || state !== jar["glow_oauth_state"]) return fail("state_mismatch");

        try {
          const token = await exchangeCode(code, callbackUrl(request));
          const profile = await fetchCurrentUser(token.access_token);

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();

          const { error: userError } = await supabaseAdmin.from("discord_users").upsert(
            {
              id: profile.id,
              username: profile.username,
              global_name: profile.global_name,
              avatar: profile.avatar,
              email: profile.email,
              access_token: token.access_token,
              refresh_token: token.refresh_token,
              token_expires_at: expiresAt,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "id" },
          );
          if (userError) throw userError;

          await supabaseAdmin.from("glow_wallets").upsert(
            { user_id: profile.id },
            { onConflict: "user_id", ignoreDuplicates: true },
          );

          const sessionToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
          const sessionExpires = new Date(Date.now() + SESSION_TTL_DAYS * 86400_000);
          const { error: sessionError } = await supabaseAdmin.from("app_sessions").insert({
            token: sessionToken,
            user_id: profile.id,
            expires_at: sessionExpires.toISOString(),
          });
          if (sessionError) throw sessionError;

          const next = jar["glow_oauth_next"] ?? "/dashboard";
          const headers = new Headers();
          headers.append("Location", `${origin}${next.startsWith("/") ? next : "/dashboard"}`);
          headers.append("Set-Cookie", buildSessionCookie(sessionToken, SESSION_TTL_DAYS * 86400));
          headers.append("Set-Cookie", "glow_oauth_state=; Path=/; HttpOnly; Secure; Max-Age=0");
          headers.append("Set-Cookie", "glow_oauth_next=; Path=/; HttpOnly; Secure; Max-Age=0");
          return new Response(null, { status: 302, headers });
        } catch (error) {
          console.error("Discord OAuth callback failed", error);
          return fail("oauth_failed");
        }
      },
    },
  },
});
