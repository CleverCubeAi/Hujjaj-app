-- =============================================
-- Migration 018: 24-Hour Booking Holds
-- =============================================
-- Implements a 24-hour soft reservation system where draft/unpaid bookings
-- temporarily hold inventory. Bookings auto-expire when the hold expires.

-- =============================================
-- Add hold fields to bookings table
-- =============================================
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS hold_expires_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS hold_session_id TEXT;

-- Add index for efficient expiration queries
CREATE INDEX IF NOT EXISTS idx_bookings_hold_expires ON bookings(hold_expires_at) 
  WHERE hold_expires_at IS NOT NULL AND status = 'draft';

-- =============================================
-- Add booking_id to booking_locks for linking
-- =============================================
ALTER TABLE booking_locks ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_booking_locks_booking ON booking_locks(booking_id) 
  WHERE booking_id IS NOT NULL;

-- =============================================
-- Add 'expired' to booking status enum if using CHECK constraint
-- =============================================
-- Note: If status uses a CHECK constraint, we need to update it
-- First, let's check and update the constraint
DO $$ 
BEGIN
  -- Try to add 'expired' status if there's a check constraint
  -- This will work if the column doesn't have a constraint or has one we can modify
  BEGIN
    ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Ignore if constraint doesn't exist
  END;
END $$;

-- Add check constraint with all valid statuses including 'expired'
DO $$
BEGIN
  ALTER TABLE bookings ADD CONSTRAINT bookings_status_check 
    CHECK (status IN ('draft', 'pending', 'confirmed', 'completed', 'cancelled', 'expired', 'paid'));
EXCEPTION WHEN OTHERS THEN
  -- Constraint might already exist or column uses different validation
  NULL;
END $$;

-- =============================================
-- Function to expire booking holds
-- =============================================
CREATE OR REPLACE FUNCTION expire_booking_holds()
RETURNS TABLE (
  expired_count INTEGER,
  expired_bookings TEXT[]
) AS $$
DECLARE
  v_expired_count INTEGER := 0;
  v_expired_bookings TEXT[] := ARRAY[]::TEXT[];
  v_booking RECORD;
BEGIN
  -- Find and expire draft bookings with expired holds
  FOR v_booking IN 
    SELECT id, booking_number 
    FROM bookings 
    WHERE status = 'draft' 
      AND hold_expires_at IS NOT NULL 
      AND hold_expires_at < NOW()
  LOOP
    -- Update booking status to expired
    UPDATE bookings 
    SET status = 'expired',
        updated_at = NOW()
    WHERE id = v_booking.id;
    
    -- Delete associated booking locks (if any remain)
    DELETE FROM booking_locks WHERE booking_id = v_booking.id;
    
    -- Track expired bookings
    v_expired_count := v_expired_count + 1;
    v_expired_bookings := array_append(v_expired_bookings, v_booking.booking_number);
  END LOOP;
  
  -- Also cleanup any orphaned expired locks
  PERFORM cleanup_expired_booking_locks();
  
  RETURN QUERY SELECT v_expired_count, v_expired_bookings;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- Function to create booking hold locks
-- =============================================
CREATE OR REPLACE FUNCTION create_booking_hold_lock(
  p_booking_id UUID,
  p_agency_id UUID,
  p_user_id UUID,
  p_session_id TEXT,
  p_accommodation_id UUID DEFAULT NULL,
  p_room_type_id UUID DEFAULT NULL,
  p_flight_id UUID DEFAULT NULL,
  p_season_id UUID DEFAULT NULL,
  p_quantity INTEGER DEFAULT 1,
  p_hold_hours INTEGER DEFAULT 24
)
RETURNS booking_locks AS $$
DECLARE
  v_lock booking_locks;
  v_expires_at TIMESTAMPTZ;
  v_user_name TEXT;
  v_user_email TEXT;
BEGIN
  -- Calculate expiration time
  v_expires_at := NOW() + (p_hold_hours || ' hours')::INTERVAL;
  
  -- Get user info
  SELECT full_name, email INTO v_user_name, v_user_email
  FROM users WHERE id = p_user_id;
  
  -- Determine resource type
  IF p_accommodation_id IS NOT NULL AND p_room_type_id IS NOT NULL THEN
    -- Create bed lock
    INSERT INTO booking_locks (
      agency_id, user_id, booking_id, resource_type,
      accommodation_id, room_type_id, season_id,
      quantity, session_id, expires_at,
      user_name, user_email
    ) VALUES (
      p_agency_id, p_user_id, p_booking_id, 'bed',
      p_accommodation_id, p_room_type_id, p_season_id,
      p_quantity, p_session_id, v_expires_at,
      v_user_name, v_user_email
    ) RETURNING * INTO v_lock;
  END IF;
  
  IF p_flight_id IS NOT NULL THEN
    -- Create flight seat lock
    INSERT INTO booking_locks (
      agency_id, user_id, booking_id, resource_type,
      flight_id, season_id,
      quantity, session_id, expires_at,
      user_name, user_email
    ) VALUES (
      p_agency_id, p_user_id, p_booking_id, 'flight_seat',
      p_flight_id, p_season_id,
      p_quantity, p_session_id, v_expires_at,
      v_user_name, v_user_email
    ) RETURNING * INTO v_lock;
  END IF;
  
  RETURN v_lock;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- Function to release booking hold locks
-- =============================================
CREATE OR REPLACE FUNCTION release_booking_hold_locks(p_booking_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM booking_locks 
  WHERE booking_id = p_booking_id;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- Function to extend booking hold
-- =============================================
CREATE OR REPLACE FUNCTION extend_booking_hold(
  p_booking_id UUID,
  p_extend_hours INTEGER DEFAULT 24
)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  v_new_expires_at TIMESTAMPTZ;
BEGIN
  v_new_expires_at := NOW() + (p_extend_hours || ' hours')::INTERVAL;
  
  -- Update booking hold expiration
  UPDATE bookings 
  SET hold_expires_at = v_new_expires_at,
      updated_at = NOW()
  WHERE id = p_booking_id
    AND status = 'draft';
  
  -- Update associated locks
  UPDATE booking_locks 
  SET expires_at = v_new_expires_at
  WHERE booking_id = p_booking_id;
  
  RETURN v_new_expires_at;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- View for bookings with hold status
-- =============================================
CREATE OR REPLACE VIEW bookings_with_hold_status AS
SELECT 
  b.*,
  CASE 
    WHEN b.hold_expires_at IS NULL THEN NULL
    WHEN b.hold_expires_at < NOW() THEN 'expired'
    WHEN b.hold_expires_at < NOW() + INTERVAL '2 hours' THEN 'expiring_soon'
    ELSE 'active'
  END AS hold_status,
  CASE 
    WHEN b.hold_expires_at IS NULL THEN NULL
    ELSE EXTRACT(EPOCH FROM (b.hold_expires_at - NOW())) / 3600
  END AS hours_remaining,
  (SELECT COUNT(*) FROM booking_locks bl WHERE bl.booking_id = b.id) AS active_locks_count
FROM bookings b;

-- =============================================
-- Grant permissions
-- =============================================
GRANT SELECT ON bookings_with_hold_status TO authenticated;

-- =============================================
-- Comments
-- =============================================
COMMENT ON COLUMN bookings.hold_expires_at IS 'When the 24-hour hold expires for draft bookings';
COMMENT ON COLUMN bookings.hold_session_id IS 'Session ID linking booking to its resource locks';
COMMENT ON COLUMN booking_locks.booking_id IS 'Link to the booking this lock belongs to (for 24h holds)';
COMMENT ON FUNCTION expire_booking_holds() IS 'Expires draft bookings whose hold has passed, returns count and booking numbers';
COMMENT ON FUNCTION create_booking_hold_lock IS 'Creates a 24-hour lock on beds/flights for a draft booking';
COMMENT ON FUNCTION release_booking_hold_locks IS 'Releases all locks for a booking (called on confirm)';
COMMENT ON FUNCTION extend_booking_hold IS 'Extends the hold period for a draft booking';
