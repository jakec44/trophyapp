-- Store Expo push token for sending notifications (TestFlight and production).
-- Users can update their own push_token; backend/cron can read to send pushes.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token text;

COMMENT ON COLUMN profiles.push_token IS 'Expo push token (ExponentPushToken[...]) for remote notifications.';
