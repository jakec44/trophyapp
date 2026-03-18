-- Species Mastery Badges: Hunter (3), Master (6), Elite (10), Legend (15) per species
-- Stored as badge_key in user_profile_display_items for pinning (e.g. species-redfish-hunter)

CREATE TABLE IF NOT EXISTS species_mastery_badges (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  species         text NOT NULL,
  badge_tier      text NOT NULL CHECK (badge_tier IN ('hunter', 'master', 'elite', 'legend')),
  badge_key       text NOT NULL,
  unlocked_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge_key)
);

CREATE INDEX IF NOT EXISTS idx_species_mastery_user ON species_mastery_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_species_mastery_badge_key ON species_mastery_badges(user_id, badge_key);

ALTER TABLE species_mastery_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own species badges" ON species_mastery_badges;
CREATE POLICY "Users read own species badges"
  ON species_mastery_badges FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own species badges via RPC" ON species_mastery_badges;
-- Insert only via RPC; no direct client insert
CREATE POLICY "Allow insert for service"
  ON species_mastery_badges FOR INSERT
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE species_mastery_badges IS 'Species mastery badges: Hunter (3), Master (6), Elite (10), Legend (15) per species.';
