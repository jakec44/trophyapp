-- Social features: friend requests from leaderboard, public/private profiles
-- Run this after schema.sql

-- Add requested_by to friendships so we know who sent the friend request
ALTER TABLE friendships ADD COLUMN IF NOT EXISTS requested_by UUID REFERENCES profiles(id) ON DELETE CASCADE;

-- Add comment for clarity
COMMENT ON COLUMN friendships.requested_by IS 'User who sent the friend request (when status=pending)';

-- Update RLS: allow inserting friend request (user initiates)
-- The existing policy "Users can create friendship requests" allows INSERT when auth.uid() is user_id_1 or user_id_2
-- We need requested_by to be set. Add a check: requested_by must equal auth.uid() for new pending requests.

-- Optional: Add index for friend request lookups
CREATE INDEX IF NOT EXISTS idx_friendships_requested_by ON friendships(requested_by);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships(status);

-- ============================================================================
-- PUBLIC LOGBOOK: Allow reading other users' catches when profile is public.
-- App should only request background_removed_url when viewing another user's
-- logbook (not photo_url) for privacy.
-- ============================================================================

DROP POLICY IF EXISTS "Users can read own catches" ON catches;

CREATE POLICY "Users can read own or public users catches"
  ON catches FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles pr
      WHERE pr.id = catches.user_id AND pr.public = true
    )
  );
