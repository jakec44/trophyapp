-- Run this in Supabase Dashboard: SQL Editor → New query → paste → Run
-- Fixes: "Could not find the 'ai_status' column of 'catches'"

ALTER TABLE catches ADD COLUMN IF NOT EXISTS photo_path TEXT;
ALTER TABLE catches ADD COLUMN IF NOT EXISTS estimated_weight_lb FLOAT;
ALTER TABLE catches ADD COLUMN IF NOT EXISTS estimated_length_in FLOAT;
ALTER TABLE catches ADD COLUMN IF NOT EXISTS ai_status TEXT DEFAULT 'done' CHECK (ai_status IN ('pending', 'done', 'failed'));
UPDATE catches SET ai_status = 'done' WHERE ai_status IS NULL;
