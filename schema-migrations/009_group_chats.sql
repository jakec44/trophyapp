-- ════════════════════════════════════════════════════════════
-- 009 — Group Chats
-- ════════════════════════════════════════════════════════════

-- Group chat rooms
CREATE TABLE IF NOT EXISTS group_chats (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  image_url   TEXT,
  created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Members of each group chat
CREATE TABLE IF NOT EXISTS group_chat_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID NOT NULL REFERENCES group_chats(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

-- Messages sent in a group chat
CREATE TABLE IF NOT EXISTS group_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID NOT NULL REFERENCES group_chats(id) ON DELETE CASCADE,
  sender_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for fast querying
CREATE INDEX IF NOT EXISTS group_chat_members_group_idx ON group_chat_members (group_id);
CREATE INDEX IF NOT EXISTS group_chat_members_user_idx  ON group_chat_members (user_id);
CREATE INDEX IF NOT EXISTS group_messages_group_idx     ON group_messages (group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS group_messages_sender_idx    ON group_messages (sender_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE group_chats         ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_chat_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_messages      ENABLE ROW LEVEL SECURITY;

-- group_chats: visible to members only
CREATE POLICY "members can view their group chats"
  ON group_chats FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_chat_members
      WHERE group_chat_members.group_id = group_chats.id
        AND group_chat_members.user_id  = auth.uid()
    )
  );

CREATE POLICY "authenticated users can create group chats"
  ON group_chats FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "members can update group chat image"
  ON group_chats FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM group_chat_members
      WHERE group_chat_members.group_id = group_chats.id
        AND group_chat_members.user_id  = auth.uid()
    )
  );

-- group_chat_members: view own memberships
CREATE POLICY "members can view memberships"
  ON group_chat_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_chat_members m2
      WHERE m2.group_id = group_chat_members.group_id
        AND m2.user_id  = auth.uid()
    )
  );

CREATE POLICY "authenticated users can insert members"
  ON group_chat_members FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- group_messages: view messages in groups you belong to
CREATE POLICY "members can view group messages"
  ON group_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_chat_members
      WHERE group_chat_members.group_id = group_messages.group_id
        AND group_chat_members.user_id  = auth.uid()
    )
  );

CREATE POLICY "members can send group messages"
  ON group_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM group_chat_members
      WHERE group_chat_members.group_id = group_messages.group_id
        AND group_chat_members.user_id  = auth.uid()
    )
  );
