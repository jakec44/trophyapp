-- ============================================================
-- 008_fix_messages_conversation_id.sql
--
-- The messages table was originally created with:
--   conversation_id UUID NOT NULL
--
-- But the app generates conversation IDs as text strings:
--   e.g.  "userId1_userId2"
--
-- PostgreSQL rejects TEXT values cast to UUID, so every
-- message INSERT fails silently. This changes the column to TEXT.
-- ============================================================

-- 1. Change UUID → TEXT on the existing column (no-op if already TEXT)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages'
      AND column_name = 'conversation_id'
      AND data_type = 'uuid'
  ) THEN
    ALTER TABLE messages
      ALTER COLUMN conversation_id TYPE TEXT USING conversation_id::TEXT;
  END IF;
END;
$$;

-- 2. Add column if it never existed (fresh install case)
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS conversation_id TEXT;

-- 3. Allow NULL so older rows without a conversation_id stay valid
ALTER TABLE messages
  ALTER COLUMN conversation_id DROP NOT NULL;

-- 4. Index for fast lookups by conversation
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id
  ON messages (conversation_id);
