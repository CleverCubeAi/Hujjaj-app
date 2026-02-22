-- =============================================
-- Migration: 014_branches.sql
-- Description: Add branches (physical office locations) support
-- =============================================

-- Branches table for managing physical office locations
CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  city TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  contact_person TEXT,
  logo_url TEXT,
  bank_name TEXT,
  bank_account TEXT,
  bank_iban TEXT,
  is_headquarters BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add branch_id to users table (nullable - agency admins may not have a branch)
ALTER TABLE users ADD COLUMN branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

-- Index for faster lookups
CREATE INDEX idx_branches_agency_id ON branches(agency_id);
CREATE INDEX idx_branches_is_active ON branches(is_active);
CREATE INDEX idx_users_branch_id ON users(branch_id);

-- Function to ensure only one headquarters per agency
CREATE OR REPLACE FUNCTION ensure_single_headquarters()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_headquarters = true THEN
    UPDATE branches 
    SET is_headquarters = false 
    WHERE agency_id = NEW.agency_id 
      AND id != NEW.id 
      AND is_headquarters = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ensure_single_headquarters
BEFORE INSERT OR UPDATE ON branches
FOR EACH ROW
EXECUTE FUNCTION ensure_single_headquarters();

-- Function to auto-set first branch as headquarters
CREATE OR REPLACE FUNCTION auto_set_headquarters()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM branches 
    WHERE agency_id = NEW.agency_id 
      AND is_headquarters = true
  ) THEN
    NEW.is_headquarters := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_set_headquarters
BEFORE INSERT ON branches
FOR EACH ROW
EXECUTE FUNCTION auto_set_headquarters();

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_branches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_branches_updated_at
BEFORE UPDATE ON branches
FOR EACH ROW
EXECUTE FUNCTION update_branches_updated_at();

-- =============================================
-- RLS Policies for branches
-- =============================================

ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

-- Agency admin can see all branches in their agency
CREATE POLICY "branches_select_policy" ON branches
  FOR SELECT
  USING (
    agency_id IN (
      SELECT agency_id FROM users WHERE id = auth.uid()
    )
  );

-- Only agency_admin and super_admin can insert branches
CREATE POLICY "branches_insert_policy" ON branches
  FOR INSERT
  WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM users 
      WHERE id = auth.uid() 
        AND role IN ('agency_admin', 'super_admin')
    )
  );

-- Only agency_admin and super_admin can update branches
CREATE POLICY "branches_update_policy" ON branches
  FOR UPDATE
  USING (
    agency_id IN (
      SELECT agency_id FROM users 
      WHERE id = auth.uid() 
        AND role IN ('agency_admin', 'super_admin')
    )
  );

-- Only agency_admin and super_admin can delete branches
CREATE POLICY "branches_delete_policy" ON branches
  FOR DELETE
  USING (
    agency_id IN (
      SELECT agency_id FROM users 
      WHERE id = auth.uid() 
        AND role IN ('agency_admin', 'super_admin')
    )
  );

-- =============================================
-- Add branch_id to related tables for data isolation
-- =============================================

-- Add branch_id to bookings for branch-level data isolation
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_branch_id ON bookings(branch_id);

-- Add branch_id to clients for branch-level data isolation
ALTER TABLE clients ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_clients_branch_id ON clients(branch_id);

-- Add branch_id to expenses for branch-level tracking
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_branch_id ON expenses(branch_id);

-- =============================================
-- View for users with branch info
-- =============================================

CREATE OR REPLACE VIEW users_with_branch AS
SELECT 
  u.*,
  b.name as branch_name,
  b.city as branch_city,
  b.is_headquarters as branch_is_headquarters
FROM users u
LEFT JOIN branches b ON u.branch_id = b.id;

-- =============================================
-- Function to get branch statistics
-- =============================================

CREATE OR REPLACE FUNCTION get_branch_stats(p_branch_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_users', (SELECT COUNT(*) FROM users WHERE branch_id = p_branch_id),
    'total_bookings', (SELECT COUNT(*) FROM bookings WHERE branch_id = p_branch_id),
    'total_clients', (SELECT COUNT(*) FROM clients WHERE branch_id = p_branch_id)
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
