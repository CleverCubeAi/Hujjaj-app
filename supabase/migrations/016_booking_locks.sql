-- =============================================
-- Migration 016: Booking Locks (Pending Reservations)
-- =============================================
-- Implements a locking mechanism to prevent double booking
-- when multiple agents are booking the same limited resources
-- Locks auto-expire after a configurable time

-- =============================================
-- Create booking_locks table
-- =============================================
CREATE TABLE IF NOT EXISTS booking_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Lock target resource
  resource_type TEXT NOT NULL CHECK (resource_type IN ('bed', 'flight_seat')),
  
  -- For beds: accommodation_id + room_type_id + season_id
  accommodation_id UUID REFERENCES accommodations(id) ON DELETE CASCADE,
  room_type_id UUID REFERENCES room_types(id) ON DELETE CASCADE,
  
  -- For flight seats
  flight_id UUID REFERENCES flights(id) ON DELETE CASCADE,
  
  -- Common
  season_id UUID REFERENCES seasons(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  
  -- Lock metadata
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Booking wizard session ID (to identify the booking in progress)
  session_id TEXT NOT NULL,
  
  -- User info for display
  user_name TEXT,
  user_email TEXT
);

-- =============================================
-- Indexes for Performance
-- =============================================
CREATE INDEX IF NOT EXISTS idx_booking_locks_agency ON booking_locks(agency_id);
CREATE INDEX IF NOT EXISTS idx_booking_locks_expires ON booking_locks(expires_at);
CREATE INDEX IF NOT EXISTS idx_booking_locks_session ON booking_locks(session_id);
CREATE INDEX IF NOT EXISTS idx_booking_locks_bed ON booking_locks(accommodation_id, room_type_id, season_id) 
  WHERE resource_type = 'bed';
CREATE INDEX IF NOT EXISTS idx_booking_locks_flight ON booking_locks(flight_id, season_id) 
  WHERE resource_type = 'flight_seat';

-- =============================================
-- Function to clean up expired locks
-- =============================================
CREATE OR REPLACE FUNCTION cleanup_expired_booking_locks()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM booking_locks
  WHERE expires_at < now();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- Function to get active locks for beds (excluding expired)
-- =============================================
CREATE OR REPLACE FUNCTION get_active_bed_locks(
  p_accommodation_id UUID,
  p_room_type_id UUID,
  p_season_id UUID,
  p_exclude_session_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  user_name TEXT,
  user_email TEXT,
  quantity INTEGER,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  session_id TEXT
) AS $$
BEGIN
  -- First cleanup expired locks
  PERFORM cleanup_expired_booking_locks();
  
  RETURN QUERY
  SELECT 
    bl.id,
    bl.user_id,
    bl.user_name,
    bl.user_email,
    bl.quantity,
    bl.expires_at,
    bl.created_at,
    bl.session_id
  FROM booking_locks bl
  WHERE bl.resource_type = 'bed'
    AND bl.accommodation_id = p_accommodation_id
    AND bl.room_type_id = p_room_type_id
    AND bl.season_id = p_season_id
    AND bl.expires_at > now()
    AND (p_exclude_session_id IS NULL OR bl.session_id != p_exclude_session_id);
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- Function to get active locks for flights (excluding expired)
-- =============================================
CREATE OR REPLACE FUNCTION get_active_flight_locks(
  p_flight_id UUID,
  p_season_id UUID,
  p_exclude_session_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  user_name TEXT,
  user_email TEXT,
  quantity INTEGER,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  session_id TEXT
) AS $$
BEGIN
  -- First cleanup expired locks
  PERFORM cleanup_expired_booking_locks();
  
  RETURN QUERY
  SELECT 
    bl.id,
    bl.user_id,
    bl.user_name,
    bl.user_email,
    bl.quantity,
    bl.expires_at,
    bl.created_at,
    bl.session_id
  FROM booking_locks bl
  WHERE bl.resource_type = 'flight_seat'
    AND bl.flight_id = p_flight_id
    AND bl.season_id = p_season_id
    AND bl.expires_at > now()
    AND (p_exclude_session_id IS NULL OR bl.session_id != p_exclude_session_id);
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- Function to check if resources are available (considering locks)
-- =============================================
CREATE OR REPLACE FUNCTION check_bed_availability_with_locks(
  p_accommodation_id UUID,
  p_room_type_id UUID,
  p_season_id UUID,
  p_agency_id UUID,
  p_quantity_needed INTEGER,
  p_exclude_session_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  beds_available INTEGER,
  beds_locked INTEGER,
  beds_truly_available INTEGER,
  is_available BOOLEAN
) AS $$
DECLARE
  v_beds_available INTEGER;
  v_beds_locked INTEGER;
BEGIN
  -- Get available beds from inventory
  SELECT COALESCE(SUM(hbi.beds_available), 0) INTO v_beds_available
  FROM hotel_bed_inventory hbi
  WHERE hbi.accommodation_id = p_accommodation_id
    AND hbi.room_type_id = p_room_type_id
    AND hbi.season_id = p_season_id
    AND hbi.agency_id = p_agency_id;
  
  -- Get locked beds (excluding current session)
  SELECT COALESCE(SUM(bl.quantity), 0) INTO v_beds_locked
  FROM booking_locks bl
  WHERE bl.resource_type = 'bed'
    AND bl.accommodation_id = p_accommodation_id
    AND bl.room_type_id = p_room_type_id
    AND bl.season_id = p_season_id
    AND bl.expires_at > now()
    AND (p_exclude_session_id IS NULL OR bl.session_id != p_exclude_session_id);
  
  RETURN QUERY SELECT 
    v_beds_available,
    v_beds_locked,
    (v_beds_available - v_beds_locked)::INTEGER,
    (v_beds_available - v_beds_locked) >= p_quantity_needed;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- RLS Policies
-- =============================================
ALTER TABLE booking_locks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view locks in their agency" ON booking_locks;
DROP POLICY IF EXISTS "Users can create locks for their agency" ON booking_locks;
DROP POLICY IF EXISTS "Users can delete their own locks" ON booking_locks;

-- All users in agency can view locks (to see who's booking)
CREATE POLICY "Users can view locks in their agency"
  ON booking_locks FOR SELECT
  USING (agency_id IN (
    SELECT agency_id FROM users WHERE id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'
  ));

-- Users can create locks for their agency
CREATE POLICY "Users can create locks for their agency"
  ON booking_locks FOR INSERT
  WITH CHECK (agency_id IN (
    SELECT agency_id FROM users WHERE id = auth.uid()
  ));

-- Users can delete their own locks or admins can delete any
CREATE POLICY "Users can delete their own locks"
  ON booking_locks FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('agency_admin', 'super_admin')
    )
  );

-- =============================================
-- Scheduled cleanup (run this via pg_cron or application)
-- SELECT cleanup_expired_booking_locks();
-- =============================================
