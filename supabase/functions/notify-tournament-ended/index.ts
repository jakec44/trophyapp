// Supabase Edge Function: notify-tournament-ended
// Run via cron (e.g. every minute). Finds tournaments that have ended (cycle_ends_at <= now(),
// last_ended_cycle_id is null), sends push only to users who ENTERED that tournament (have a
// tournament_entry for that tournament and cycle). Then runs run_tournament_cycle_end() to
// finalize and advance cycles.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

async function sendExpoPush(tokens: string[], title: string, body: string): Promise<void> {
  if (tokens.length === 0) return;
  const messages = tokens.map((to) => ({ to, title, body, sound: "default" as const }));
  const res = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(messages),
  });
  if (!res.ok) {
    const t = await res.text();
    console.error("Expo push failed:", res.status, t);
  }
}

Deno.serve(async (_req: Request) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase env" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Tournaments that have ended and not yet been advanced
    const { data: endedTournaments, error: tourError } = await supabase
      .from("tournaments")
      .select("id, title, cycle_id")
      .eq("is_active", true)
      .lte("cycle_ends_at", new Date().toISOString())
      .is("last_ended_cycle_id", null);

    if (tourError) {
      return new Response(
        JSON.stringify({ error: tourError.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    let totalSent = 0;
    for (const t of endedTournaments ?? []) {
      const tournamentId = t.id as string;
      const title = (t.title as string) || "Tournament";
      const cycleId = t.cycle_id as number;

      // Only users who actually entered this tournament (this cycle)
      const { data: entries } = await supabase
        .from("tournament_entries")
        .select("user_id")
        .eq("tournament_id", tournamentId)
        .eq("cycle_id", cycleId);
      const userIds = [...new Set((entries ?? []).map((e) => e.user_id as string))];
      if (userIds.length === 0) continue;

      const { data: profiles } = await supabase
        .from("profiles")
        .select("push_token")
        .in("id", userIds)
        .not("push_token", "is", null);
      const tokens = (profiles ?? [])
        .map((p) => (p as { push_token?: string }).push_token?.trim())
        .filter((tkn): tkn is string => !!tkn);

      if (tokens.length > 0) {
        await sendExpoPush(
          tokens,
          title + " has ended",
          "Check your results in Compete."
        );
        totalSent += tokens.length;
      }
    }

    // Finalize and advance cycles (so next run doesn't re-notify)
    const { error: rpcError } = await supabase.rpc("run_tournament_cycle_end");
    if (rpcError) {
      console.error("run_tournament_cycle_end error:", rpcError);
      return new Response(
        JSON.stringify({ error: rpcError.message, notifications_sent: totalSent }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        tournaments_checked: endedTournaments?.length ?? 0,
        notifications_sent: totalSent,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("notify-tournament-ended error:", e);
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
