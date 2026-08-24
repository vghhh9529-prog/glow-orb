import { requireSessionUser } from "./session.server";

export async function getMyProfile() {
  const user = await requireSessionUser();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: levels } = await supabaseAdmin
    .from("member_levels")
    .select("guild_id, username, avatar, xp, level, daily_xp, weekly_xp, monthly_xp, voice_minutes, updated_at")
    .eq("user_id", user.id)
    .order("xp", { ascending: false });
  const rows = levels ?? [];
  const primary = rows[0] ?? null;
  let rank = 0;
  if (primary) {
    const { count } = await supabaseAdmin
      .from("member_levels")
      .select("user_id", { count: "exact", head: true })
      .eq("guild_id", primary.guild_id)
      .gt("xp", primary.xp ?? 0);
    rank = (count ?? 0) + 1;
  }
  const { data: wallet } = await supabaseAdmin
    .from("glow_wallets")
    .select("balance, total_earned, streak")
    .eq("user_id", user.id)
    .maybeSingle();
  return {
    user,
    primary: primary
      ? {
          ...primary,
          rank,
        }
      : null,
    totals: {
      xp: rows.reduce((sum, row) => sum + Number(row.xp ?? 0), 0),
      level: rows.reduce((max, row) => Math.max(max, Number(row.level ?? 0)), 0),
      servers: rows.length,
      voiceMinutes: rows.reduce((sum, row) => sum + Number(row.voice_minutes ?? 0), 0),
    },
    wallet: wallet ?? { balance: 0, total_earned: 0, streak: 0 },
    servers: rows,
  };
}
