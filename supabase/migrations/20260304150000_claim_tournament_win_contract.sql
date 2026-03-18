-- Document claim_tournament_win contract: p_tournament_id is TEXT (tournaments.id).
-- Return: jsonb { status, badge? }. badge has placement (place), coins_awarded, xp_awarded, cycle_id; claimed = (status = 'claimed').
-- No function change; client uses tournaments.id (TEXT) everywhere.
COMMENT ON FUNCTION claim_tournament_win(text) IS 'Claim tournament win for ended cycle. p_tournament_id = tournaments.id (TEXT). Returns { status: not_signed_in | tournament_not_found | tournament_not_ended | not_winner | claimed | awarded, badge?: { place, coins_awarded, xp_awarded, cycle_id, ... } }. Idempotent.';
