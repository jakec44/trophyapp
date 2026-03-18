// Supabase Edge Function: notify-friend-posted
// Invoke via Database Webhook on feed_posts INSERT.
// Sends a push notification to each of the post author's friends (accepted friendships)
// who have a push_token. Only notification type: "friend posted a catch".

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

Deno.serve(async (req: Request) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase env" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const payload = await req.json();
    const record = payload?.record ?? payload?.new ?? null;
    if (!record?.user_id) {
      return new Response(
        JSON.stringify({ ok: false, error: "No record.user_id in payload" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    const authorId = record.user_id as string;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get author's display name for the message
    const { data: author } = await supabase
      .from("profiles")
      .select("display_name, username")
      .eq("id", authorId)
      .single();
    const authorName =
      (author?.display_name ?? author?.username ?? "A friend") as string;

    // Get accepted friends of the author (the other user in each friendship)
    const { data: friendships } = await supabase
      .from("friendships")
      .select("user_id_1, user_id_2")
      .eq("status", "accepted")
      .or(`user_id_1.eq.${authorId},user_id_2.eq.${authorId}`);
    const friendIds: string[] = [];
    for (const row of friendships ?? []) {
      const other = row.user_id_1 === authorId ? row.user_id_2 : row.user_id_1;
      if (other && other !== authorId) friendIds.push(other);
    }
    if (friendIds.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, sent: 0, reason: "no_friends" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get push tokens for friends (only non-empty)
    const { data: profiles } = await supabase
      .from("profiles")
      .select("push_token")
      .in("id", friendIds)
      .not("push_token", "is", null);
    const tokens = (profiles ?? [])
      .map((p) => (p as { push_token?: string }).push_token?.trim())
      .filter((t): t is string => !!t);

    if (tokens.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, sent: 0, reason: "no_tokens" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    await sendExpoPush(
      tokens,
      "New catch from " + authorName,
      authorName + " just posted a catch. Tap to see it."
    );

    return new Response(
      JSON.stringify({ ok: true, sent: tokens.length }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("notify-friend-posted error:", e);
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
