-- Add lat/lng coordinates and location_sharing opt-in to profiles
-- Run in Supabase SQL Editor

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS lat FLOAT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS lng FLOAT;
-- Users must explicitly opt in before their location is used for discovery
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location_sharing BOOLEAN DEFAULT false;

-- Index for geospatial bounding-box queries
CREATE INDEX IF NOT EXISTS idx_profiles_lat_lng ON profiles(lat, lng)
  WHERE lat IS NOT NULL AND lng IS NOT NULL AND location_sharing = true AND public = true;
