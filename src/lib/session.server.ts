import { getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";

export const SESSION_COOKIE = "glow_session";
export const SESSION_TTL_DAYS = 30;
const SESSION_REFRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export interface SessionUser {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
  email: string | null;
}

function readCookie(name: string): string | null {
  const header = getRequestHeader("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = readCookie(SESSION_COOKIE);
  if (!token) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: session } = await supabaseAdmin
    .from("app_sessions")
    .select("user_id, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (!session) return null;
  const expiresAt = new Date(session.expires_at).getTime();
  if (expiresAt < Date.now()) {
    await supabaseAdmin.from("app_sessions").delete().eq("token", token);
    return null;
  }

  if (expiresAt - Date.now() < SESSION_REFRESH_WINDOW_MS) {
    const refreshedExpiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
    const { error } = await supabaseAdmin
      .from("app_sessions")
      .update({ expires_at: refreshedExpiresAt.toISOString() })
      .eq("token", token);
    if (!error) {
      setResponseHeader("Set-Cookie", buildSessionCookie(token, SESSION_TTL_DAYS * 24 * 60 * 60));
    }
  }

  const { data: user } = await supabaseAdmin
    .from("discord_users")
    .select("id, username, global_name, avatar, email")
    .eq("id", session.user_id)
    .maybeSingle();
  return user ?? null;
}

export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

export function currentSessionToken(): string | null {
  return readCookie(SESSION_COOKIE);
}

export function buildSessionCookie(token: string, maxAgeSeconds: number) {
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Secure",
    `Max-Age=${maxAgeSeconds}`,
  ].join("; ");
}
