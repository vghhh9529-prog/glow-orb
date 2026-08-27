import { createFileRoute } from "@tanstack/react-router";
import { DiscordOAuthError, exchangeCode, fetchCurrentUser } from "@/lib/discord-api.server";
import { callbackUrl, requestOrigin } from "@/lib/origin.server";
import { SESSION_TTL_DAYS, buildSessionCookie } from "@/lib/session.server";
import { assertEncryptionKeyConfigured, encryptSecret } from "@/lib/secret-crypto.server";
import { allowRateLimit, requestAddress } from "@/lib/rate-limit.server";

function cookies(request: Request): Record<string, string> {
  const out: Record<string, string> = {};
  const header = request.headers.get("cookie");
  if (!header) return out;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key) {
      try {
        out[key] = decodeURIComponent(rest.join("="));
      } catch {
        // Ignore malformed cookie values and let the state check fail safely.
      }
    }
  }
  return out;
}

function safeErrorCode(value: string) {
  return value.replace(/[^a-z0-9_-]/gi, "_").slice(0, 80) || "unknown";
}

export const Route = createFileRoute("/api/public/auth/discord/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!allowRateLimit(`oauth-callback:${requestAddress(request)}`, 20, 10 * 60_000)) {
          return new Response("Too many OAuth callbacks. Try again later.", {
            status: 429,
            headers: { "Retry-After": "600", "Content-Type": "text/plain; charset=utf-8" },
          });
        }
        const origin = requestOrigin(request);
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const jar = cookies(request);
        let stage = "validate";

        const fail = (reason: string, detail?: string) => {
          const params = new URLSearchParams({ auth_error: reason });
          if (detail) params.set("auth_stage", safeErrorCode(detail));
          return new Response(null, {
            status: 302,
            headers: { Location: `${origin}/?${params.toString()}` },
          });
        };

        if (!code) return fail(url.searchParams.get("error") ?? "missing_code");
        if (!state || state !== jar["glow_oauth_state"]) return fail("state_mismatch");

        try {
          // Validate server-side encryption configuration before consuming Discord's one-time code.
          stage = "configuration_encryption";
          assertEncryptionKeyConfigured();
          stage = "configuration_supabase";
          const { assertSupabaseAdminConfigured } = await import("@/integrations/supabase/client.server");
          assertSupabaseAdminConfigured();

          stage = "token_exchange";
          const token = await exchangeCode(code, callbackUrl(request));

          stage = "fetch_profile";
          const profile = await fetchCurrentUser(token.access_token);

          stage = "save_profile";
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();
          const { error: userError } = await supabaseAdmin.from("discord_users").upsert(
            {
              id: profile.id,
              username: profile.username,
              global_name: profile.global_name,
              avatar: profile.avatar,
              email: profile.email,
              access_token: encryptSecret(token.access_token),
              refresh_token: encryptSecret(token.refresh_token),
              token_expires_at: expiresAt,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "id" },
          );
          if (userError) throw userError;

          stage = "create_wallet";
          const { error: walletError } = await supabaseAdmin
            .from("glow_wallets")
            .upsert({ user_id: profile.id }, { onConflict: "user_id", ignoreDuplicates: true });
          if (walletError) throw walletError;

          stage = "create_session";
          const sessionToken =
            crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
          const sessionExpires = new Date(Date.now() + SESSION_TTL_DAYS * 86400_000);
          const { error: sessionError } = await supabaseAdmin.from("app_sessions").insert({
            token: sessionToken,
            user_id: profile.id,
            expires_at: sessionExpires.toISOString(),
          });
          if (sessionError) throw sessionError;

          stage = "redirect";
          const next = jar["glow_oauth_next"] ?? "/dashboard";
          const headers = new Headers();
          headers.append("Location", `${origin}${next.startsWith("/") ? next : "/dashboard"}`);
          headers.append("Set-Cookie", buildSessionCookie(sessionToken, SESSION_TTL_DAYS * 86400));
          headers.append("Set-Cookie", "glow_oauth_state=; Path=/; HttpOnly; Secure; Max-Age=0");
          headers.append("Set-Cookie", "glow_oauth_next=; Path=/; HttpOnly; Secure; Max-Age=0");
          return new Response(null, { status: 302, headers });
        } catch (error) {
          console.error(`[OAuth] Discord callback failed at ${stage}`, error);
          if (stage === "configuration_encryption") return fail("server_misconfigured", "encryption_key");
          if (stage === "configuration_supabase") return fail("server_misconfigured", "supabase");
          if (stage === "token_exchange" && error instanceof DiscordOAuthError) {
            return fail("oauth_failed", `${stage}_${error.status}_${error.code}`);
          }
          return fail("oauth_failed", stage);
        }
      },
    },
  },
});
