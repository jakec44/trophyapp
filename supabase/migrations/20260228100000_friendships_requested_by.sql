-- Add requested_by column to friendships so we know who initiated the request
ALTER TABLE friendships ADD COLUMN IF NOT EXISTS requested_by UUID REFERENCES profiles(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_friendships_requested_by ON friendships(requested_by);

COMMENT ON COLUMN friendships.requested_by IS 'User who sent the friend request (when status=pending)';
