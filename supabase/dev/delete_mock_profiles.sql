-- =============================================================================
-- Delete profiles where is_mock = true
-- =============================================================================
-- Use this to remove mock/seed users before launch.
-- Cascades to catches, friendships, etc. via ON DELETE CASCADE.
-- Does NOT delete auth.users - orphan auth rows remain until cleaned separately.
-- =============================================================================

DELETE FROM public.profiles WHERE is_mock = true;
