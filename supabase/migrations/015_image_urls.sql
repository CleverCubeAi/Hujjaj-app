-- Migration: Add image URL columns to relevant tables
-- This migration adds support for storing image URLs for agencies, users, flights, accommodations, and room types

-- Add logo_url to agencies table
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Add avatar_url to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Add airline_logo_url to flights table
ALTER TABLE flights ADD COLUMN IF NOT EXISTS airline_logo_url TEXT;

-- Add photo_url to accommodations table
ALTER TABLE accommodations ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Add photo_url to room_types table
ALTER TABLE room_types ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Create storage buckets (Note: These need to be created via Supabase Dashboard or CLI)
-- Buckets needed:
--   - agencies: For agency logos
--   - avatars: For user profile photos
--   - airlines: For airline logos
--   - hotels: For hotel and room photos

-- Comment: After running this migration, create the storage buckets in Supabase Dashboard:
-- 1. Go to Storage section
-- 2. Create buckets: agencies, avatars, airlines, hotels
-- 3. Set each bucket to public (for image display) or configure RLS policies
