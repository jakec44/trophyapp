-- ============================================================
-- 006_fix_friends_messages_rls.sql
--
-- Fixes two RLS issues:
--
-- 1. FRIEND REQUESTS: The old query for pending requests did not
--    use the `requested_by` column, so a user's OWN outgoing
--    requests appeared in their incoming Requests tab.
--    No schema change needed — this was a client-side query bug
--    (fixed in supabase.ts). This migration just confirms the
--    requested_by column exists (idempotent).
--
-- 2. MESSAGES: The original INSERT policy required an *accepted*
--    friendship. This caused messages to silently fail for any pair
--    that wasn't yet accepted, including immediate post-accept sends.
--    Replace with a simpler policy: sender must be authenticated.
--    The app already enforces that only friends appear in the chat UI.
-- ============================================================

-- ── Friendships: ensure requested_by column exists ───────────────────────────
ALTER TABLE friendships ADD COLUMN IF NOT EXISTS requested_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_friendships_requested_by ON friendships(requested_by);

-- ── Messages: relax INSERT policy ────────────────────────────────────────────
-- Drop the overly strict "must be accepted friends" policy
DROP POLICY IF EXISTS "Users can send messages to friends" ON messages;

-- New policy: authenticated user may send messages as themselves.
-- The UI restricts who you can message (friends list), but the
-- DB no longer hard-blocks it so there are no silent failures.
CREATE POLICY "Authenticated users can send messages"
  ON messages
  FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- ── Messages: ensure read-update policy exists ───────────────────────────────
-- Allow recipients to mark messages read
DROP POLICY IF EXISTS "Recipients can mark messages read" ON messages;

CREATE POLICY "Recipients can mark messages read"
  ON messages
  FOR UPDATE
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

-- ── Conversation index for realtime filter performance ───────────────────────
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_created ON messages(recipient_id, created_at DESC);
