-- =============================================
-- Migration 012: Soft Delete and Security Settings
-- =============================================
-- Adds soft delete support for bookings and user security settings for deletion password

-- =============================================
-- Add soft delete columns to bookings table
-- =============================================
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

-- Create index for efficient filtering of non-deleted bookings
CREATE INDEX IF NOT EXISTS idx_bookings_deleted_at ON bookings(deleted_at);
CREATE INDEX IF NOT EXISTS idx_bookings_not_deleted ON bookings(agency_id) WHERE deleted_at IS NULL;

-- =============================================
-- User Security Settings Table
-- =============================================
CREATE TABLE IF NOT EXISTS user_security_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  deletion_password_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for user lookup
CREATE INDEX IF NOT EXISTS idx_user_security_settings_user ON user_security_settings(user_id);

-- =============================================
-- RLS Policies for user_security_settings
-- =============================================
ALTER TABLE user_security_settings ENABLE ROW LEVEL SECURITY;

-- Users can only view and manage their own security settings
CREATE POLICY "users_manage_own_security_settings" ON user_security_settings
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =============================================
-- Update booking_summary view to exclude soft-deleted bookings
-- =============================================
DROP VIEW IF EXISTS booking_summary;

CREATE OR REPLACE VIEW booking_summary AS
SELECT 
  b.id,
  b.booking_number,
  b.agency_id,
  b.client_id,
  c.full_name AS client_name,
  c.full_name_ar AS client_name_ar,
  c.phone AS client_phone,
  b.season_id,
  s.name AS season_name,
  b.status,
  b.total_amount,
  b.paid_amount,
  b.remaining_balance,
  COUNT(DISTINCT p.id) AS pilgrims_count,
  b.created_at,
  b.confirmed_at,
  b.deleted_at,
  b.deleted_by,
  b.deletion_reason
FROM bookings b
LEFT JOIN clients c ON b.client_id = c.id
LEFT JOIN seasons s ON b.season_id = s.id
LEFT JOIN pilgrims p ON p.booking_id = b.id
WHERE b.deleted_at IS NULL
GROUP BY b.id, c.id, s.id;

-- =============================================
-- Function to update user_security_settings updated_at
-- =============================================
CREATE OR REPLACE FUNCTION update_security_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_security_settings_updated_at
BEFORE UPDATE ON user_security_settings
FOR EACH ROW EXECUTE FUNCTION update_security_settings_updated_at();

-- =============================================
-- Comments for documentation
-- =============================================
COMMENT ON COLUMN bookings.deleted_at IS 'Timestamp when the booking was soft deleted';
COMMENT ON COLUMN bookings.deleted_by IS 'User ID who performed the soft delete';
COMMENT ON COLUMN bookings.deletion_reason IS 'Optional reason for deleting the booking';
COMMENT ON TABLE user_security_settings IS 'Stores user security settings like deletion password';
COMMENT ON COLUMN user_security_settings.deletion_password_hash IS 'Bcrypt hash of the deletion password';
