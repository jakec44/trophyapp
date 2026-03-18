-- Ensure anon and authenticated can call angler leaderboard RPCs.
-- 20260329000000 recreated these functions without re-granting.

GRANT EXECUTE ON FUNCTION get_angler_leaderboard(int, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_angler_leaderboard(int, text, text) TO anon;
GRANT EXECUTE ON FUNCTION get_angler_rank(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_angler_rank(uuid, text, text) TO anon;
