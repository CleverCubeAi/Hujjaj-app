-- =============================================
-- Migration 017: Discount Management System
-- =============================================
-- Admin-controlled discount settings with user-specific permissions,
-- usage limits, and audit logging.

-- =============================================
-- Table 1: discount_settings (agency-level discount definitions)
-- =============================================
CREATE TABLE IF NOT EXISTS discount_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                    -- Display name: "خصم 5%", "خصم 100 درهم"
  name_ar TEXT,                          -- Arabic name
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value NUMERIC(12,2) NOT NULL CHECK (discount_value > 0),
  max_discount_amount NUMERIC(12,2),     -- Cap for percent discounts (in MAD)
  min_booking_amount NUMERIC(12,2),      -- Minimum booking amount to apply discount
  is_default BOOLEAN DEFAULT false,      -- Available to all users by default
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- Table 2: user_discount_permissions (per-user access)
-- =============================================
CREATE TABLE IF NOT EXISTS user_discount_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  discount_setting_id UUID REFERENCES discount_settings(id) ON DELETE CASCADE,
  usage_limit INTEGER,                   -- NULL = unlimited, otherwise max uses per period
  usage_count INTEGER DEFAULT 0,         -- Current usage count in this period
  reset_period TEXT DEFAULT 'monthly' CHECK (reset_period IN ('daily', 'weekly', 'monthly', 'never')),
  last_reset_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  granted_by UUID REFERENCES users(id),
  granted_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, discount_setting_id)
);

-- =============================================
-- Table 3: discount_usage_log (audit trail)
-- =============================================
CREATE TABLE IF NOT EXISTS discount_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  discount_setting_id UUID REFERENCES discount_settings(id) ON DELETE SET NULL,
  discount_name TEXT,                    -- Stored for history even if discount is deleted
  discount_type TEXT,
  discount_value NUMERIC(12,2),          -- The setting value (5 for 5%, or 100 for 100 MAD)
  discount_amount NUMERIC(12,2),         -- Actual MAD amount deducted
  booking_total_before NUMERIC(12,2),    -- Total before discount
  booking_total_after NUMERIC(12,2),     -- Total after discount
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- Indexes for Performance
-- =============================================
CREATE INDEX IF NOT EXISTS idx_discount_settings_agency ON discount_settings(agency_id);
CREATE INDEX IF NOT EXISTS idx_discount_settings_active ON discount_settings(is_active);
CREATE INDEX IF NOT EXISTS idx_discount_settings_default ON discount_settings(is_default);

CREATE INDEX IF NOT EXISTS idx_user_discount_permissions_user ON user_discount_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_discount_permissions_discount ON user_discount_permissions(discount_setting_id);

CREATE INDEX IF NOT EXISTS idx_discount_usage_log_agency ON discount_usage_log(agency_id);
CREATE INDEX IF NOT EXISTS idx_discount_usage_log_user ON discount_usage_log(user_id);
CREATE INDEX IF NOT EXISTS idx_discount_usage_log_booking ON discount_usage_log(booking_id);
CREATE INDEX IF NOT EXISTS idx_discount_usage_log_date ON discount_usage_log(created_at);

-- =============================================
-- Function to reset usage counts based on period
-- =============================================
CREATE OR REPLACE FUNCTION reset_discount_usage_counts()
RETURNS INTEGER AS $$
DECLARE
  reset_count INTEGER := 0;
  tmp_count INTEGER := 0;
BEGIN
  -- Reset daily counters
  UPDATE user_discount_permissions
  SET usage_count = 0, last_reset_at = now()
  WHERE reset_period = 'daily'
    AND last_reset_at < CURRENT_DATE;
  GET DIAGNOSTICS tmp_count = ROW_COUNT;
  reset_count := reset_count + tmp_count;
  
  -- Reset weekly counters (reset on Monday)
  UPDATE user_discount_permissions
  SET usage_count = 0, last_reset_at = now()
  WHERE reset_period = 'weekly'
    AND last_reset_at < date_trunc('week', CURRENT_DATE);
  GET DIAGNOSTICS tmp_count = ROW_COUNT;
  reset_count := reset_count + tmp_count;
  
  -- Reset monthly counters
  UPDATE user_discount_permissions
  SET usage_count = 0, last_reset_at = now()
  WHERE reset_period = 'monthly'
    AND last_reset_at < date_trunc('month', CURRENT_DATE);
  GET DIAGNOSTICS tmp_count = ROW_COUNT;
  reset_count := reset_count + tmp_count;
  
  RETURN reset_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- Function to check if user can use a discount
-- =============================================
CREATE OR REPLACE FUNCTION can_user_use_discount(
  p_user_id UUID,
  p_discount_setting_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_is_default BOOLEAN;
  v_permission RECORD;
BEGIN
  -- First, reset any expired usage counts
  PERFORM reset_discount_usage_counts();
  
  -- Check if discount is default (available to all)
  SELECT is_default INTO v_is_default
  FROM discount_settings
  WHERE id = p_discount_setting_id AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- If it's a default discount, allow it
  IF v_is_default THEN
    RETURN true;
  END IF;
  
  -- Check user-specific permission
  SELECT * INTO v_permission
  FROM user_discount_permissions
  WHERE user_id = p_user_id
    AND discount_setting_id = p_discount_setting_id
    AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Check usage limit
  IF v_permission.usage_limit IS NULL THEN
    RETURN true; -- Unlimited
  END IF;
  
  RETURN v_permission.usage_count < v_permission.usage_limit;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- Function to increment discount usage
-- =============================================
CREATE OR REPLACE FUNCTION increment_discount_usage(
  p_user_id UUID,
  p_discount_setting_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_is_default BOOLEAN;
BEGIN
  -- Check if discount is default
  SELECT is_default INTO v_is_default
  FROM discount_settings
  WHERE id = p_discount_setting_id;
  
  -- Only increment for non-default discounts with user permissions
  IF NOT v_is_default THEN
    UPDATE user_discount_permissions
    SET usage_count = usage_count + 1, updated_at = now()
    WHERE user_id = p_user_id
      AND discount_setting_id = p_discount_setting_id;
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- Function to calculate discount amount
-- =============================================
CREATE OR REPLACE FUNCTION calculate_discount_amount(
  p_discount_setting_id UUID,
  p_booking_total NUMERIC
)
RETURNS NUMERIC AS $$
DECLARE
  v_discount RECORD;
  v_amount NUMERIC;
BEGIN
  SELECT * INTO v_discount
  FROM discount_settings
  WHERE id = p_discount_setting_id;
  
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  
  -- Check minimum booking amount
  IF v_discount.min_booking_amount IS NOT NULL AND p_booking_total < v_discount.min_booking_amount THEN
    RETURN 0;
  END IF;
  
  IF v_discount.discount_type = 'fixed' THEN
    v_amount := v_discount.discount_value;
  ELSE
    -- Percentage
    v_amount := p_booking_total * (v_discount.discount_value / 100);
    
    -- Apply cap if set
    IF v_discount.max_discount_amount IS NOT NULL AND v_amount > v_discount.max_discount_amount THEN
      v_amount := v_discount.max_discount_amount;
    END IF;
  END IF;
  
  -- Don't exceed booking total
  IF v_amount > p_booking_total THEN
    v_amount := p_booking_total;
  END IF;
  
  RETURN ROUND(v_amount, 2);
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- RLS Policies for discount_settings
-- =============================================
ALTER TABLE discount_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view discount settings in their agency" ON discount_settings;
DROP POLICY IF EXISTS "Admins can manage discount settings" ON discount_settings;

CREATE POLICY "Users can view discount settings in their agency"
  ON discount_settings FOR SELECT
  USING (agency_id IN (
    SELECT agency_id FROM users WHERE id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'
  ));

CREATE POLICY "Admins can manage discount settings"
  ON discount_settings FOR ALL
  USING (
    agency_id IN (
      SELECT agency_id FROM users WHERE id = auth.uid() AND role IN ('agency_admin', 'super_admin')
    ) OR EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- =============================================
-- RLS Policies for user_discount_permissions
-- =============================================
ALTER TABLE user_discount_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own discount permissions" ON user_discount_permissions;
DROP POLICY IF EXISTS "Admins can view all discount permissions" ON user_discount_permissions;
DROP POLICY IF EXISTS "Admins can manage discount permissions" ON user_discount_permissions;

CREATE POLICY "Users can view their own discount permissions"
  ON user_discount_permissions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all discount permissions"
  ON user_discount_permissions FOR SELECT
  USING (
    discount_setting_id IN (
      SELECT id FROM discount_settings WHERE agency_id IN (
        SELECT agency_id FROM users WHERE id = auth.uid() AND role IN ('agency_admin', 'super_admin')
      )
    ) OR EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY "Admins can manage discount permissions"
  ON user_discount_permissions FOR ALL
  USING (
    discount_setting_id IN (
      SELECT id FROM discount_settings WHERE agency_id IN (
        SELECT agency_id FROM users WHERE id = auth.uid() AND role IN ('agency_admin', 'super_admin')
      )
    ) OR EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- =============================================
-- RLS Policies for discount_usage_log
-- =============================================
ALTER TABLE discount_usage_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view discount usage in their agency" ON discount_usage_log;
DROP POLICY IF EXISTS "Users can create discount usage logs" ON discount_usage_log;

CREATE POLICY "Users can view discount usage in their agency"
  ON discount_usage_log FOR SELECT
  USING (agency_id IN (
    SELECT agency_id FROM users WHERE id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'
  ));

CREATE POLICY "Users can create discount usage logs"
  ON discount_usage_log FOR INSERT
  WITH CHECK (agency_id IN (
    SELECT agency_id FROM users WHERE id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'
  ));

-- =============================================
-- Function to get user discount permissions with joined data
-- =============================================
CREATE OR REPLACE FUNCTION get_user_discount_permissions(
  p_agency_id UUID,
  p_user_id UUID DEFAULT NULL,
  p_discount_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  discount_setting_id UUID,
  usage_limit INTEGER,
  usage_count INTEGER,
  reset_period TEXT,
  last_reset_at TIMESTAMPTZ,
  is_active BOOLEAN,
  granted_by UUID,
  granted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  user_data JSON,
  discount_setting JSON
) 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    udp.id,
    udp.user_id,
    udp.discount_setting_id,
    udp.usage_limit,
    udp.usage_count,
    udp.reset_period,
    udp.last_reset_at,
    udp.is_active,
    udp.granted_by,
    udp.granted_at,
    udp.updated_at,
    row_to_json(u.*)::JSON as user_data,
    row_to_json(ds.*)::JSON as discount_setting
  FROM user_discount_permissions udp
  LEFT JOIN users u ON u.id = udp.user_id
  LEFT JOIN discount_settings ds ON ds.id = udp.discount_setting_id
  WHERE ds.agency_id = p_agency_id
    AND (p_user_id IS NULL OR udp.user_id = p_user_id)
    AND (p_discount_id IS NULL OR udp.discount_setting_id = p_discount_id)
  ORDER BY udp.granted_at DESC;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- Function to get discount usage log with joined data
-- =============================================
CREATE OR REPLACE FUNCTION get_discount_usage_log(
  p_agency_id UUID,
  p_user_id UUID DEFAULT NULL,
  p_discount_id UUID DEFAULT NULL,
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  agency_id UUID,
  booking_id UUID,
  user_id UUID,
  discount_setting_id UUID,
  discount_name TEXT,
  discount_type TEXT,
  discount_value NUMERIC,
  discount_amount NUMERIC,
  booking_total_before NUMERIC,
  booking_total_after NUMERIC,
  created_at TIMESTAMPTZ,
  user_data JSON,
  discount_setting JSON,
  booking JSON
) 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dul.id,
    dul.agency_id,
    dul.booking_id,
    dul.user_id,
    dul.discount_setting_id,
    dul.discount_name,
    dul.discount_type,
    dul.discount_value,
    dul.discount_amount,
    dul.booking_total_before,
    dul.booking_total_after,
    dul.created_at,
    row_to_json(u.*)::JSON as user_data,
    row_to_json(ds.*)::JSON as discount_setting,
    row_to_json(b.*)::JSON as booking
  FROM discount_usage_log dul
  LEFT JOIN users u ON u.id = dul.user_id
  LEFT JOIN discount_settings ds ON ds.id = dul.discount_setting_id
  LEFT JOIN bookings b ON b.id = dul.booking_id
  WHERE dul.agency_id = p_agency_id
    AND (p_user_id IS NULL OR dul.user_id = p_user_id)
    AND (p_discount_id IS NULL OR dul.discount_setting_id = p_discount_id)
    AND (p_date_from IS NULL OR dul.created_at >= p_date_from)
    AND (p_date_to IS NULL OR dul.created_at <= p_date_to)
  ORDER BY dul.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- View for available discounts per user
-- =============================================
CREATE OR REPLACE VIEW user_available_discounts AS
SELECT 
  ds.id,
  ds.agency_id,
  ds.name,
  ds.name_ar,
  ds.discount_type,
  ds.discount_value,
  ds.max_discount_amount,
  ds.min_booking_amount,
  ds.is_default,
  ds.sort_order,
  u.id as user_id,
  CASE 
    WHEN ds.is_default THEN NULL  -- Unlimited for default
    ELSE udp.usage_limit 
  END as usage_limit,
  CASE 
    WHEN ds.is_default THEN 0  -- Not tracked for default
    ELSE COALESCE(udp.usage_count, 0)
  END as usage_count,
  CASE 
    WHEN ds.is_default THEN NULL  -- Unlimited remaining for default
    WHEN udp.usage_limit IS NULL THEN NULL  -- Unlimited
    ELSE udp.usage_limit - COALESCE(udp.usage_count, 0)
  END as remaining_uses,
  COALESCE(udp.reset_period, 'never') as reset_period
FROM discount_settings ds
CROSS JOIN users u
LEFT JOIN user_discount_permissions udp 
  ON udp.discount_setting_id = ds.id AND udp.user_id = u.id AND udp.is_active = true
WHERE ds.is_active = true
  AND (ds.is_default = true OR udp.id IS NOT NULL)
  AND ds.agency_id = u.agency_id;
