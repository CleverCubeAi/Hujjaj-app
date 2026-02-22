-- Add photo_url to pilgrims for profile/avatar display in bed map and seat map
ALTER TABLE pilgrims
  ADD COLUMN IF NOT EXISTS photo_url TEXT;

COMMENT ON COLUMN pilgrims.photo_url IS 'Profile photo URL (Supabase storage) for display in inventory maps';
