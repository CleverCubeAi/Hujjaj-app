-- Add passport_scan_url to pilgrims for optional passport document upload
ALTER TABLE pilgrims
  ADD COLUMN IF NOT EXISTS passport_scan_url TEXT;

COMMENT ON COLUMN pilgrims.passport_scan_url IS 'Optional URL of uploaded passport scan (Supabase storage)';

-- Create pilgrims storage bucket for photo and passport scan uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('pilgrims', 'pilgrims', true)
ON CONFLICT (id) DO NOTHING;
