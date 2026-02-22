-- =============================================
-- Migration 004: Booking Workflow Schema
-- =============================================

-- Clients (separate from pilgrims - the customer who makes the booking)
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  full_name_ar TEXT,
  email TEXT,
  phone TEXT NOT NULL,
  address TEXT,
  id_number TEXT,  -- National ID (CIN) or passport
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Mahram Groups (family relationships - created before bookings to allow reference)
CREATE TABLE mahram_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  name TEXT,  -- e.g., "عائلة أحمد"
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Bookings (groups pilgrims together under one invoice)
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_number TEXT UNIQUE NOT NULL,  -- e.g., "BK-2024-0001"
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  season_id UUID REFERENCES seasons(id),
  flight_id UUID REFERENCES flights(id),
  accommodation_id UUID REFERENCES accommodations(id),
  room_type_id UUID REFERENCES room_types(id),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','confirmed','paid','cancelled')),
  total_amount NUMERIC(12,2) DEFAULT 0,
  paid_amount NUMERIC(12,2) DEFAULT 0,
  remaining_balance NUMERIC(12,2) GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Extra Services Catalog (transport, guide, meals, etc.)
CREATE TABLE extra_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_ar TEXT,
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  category TEXT CHECK (category IN ('transport','guide','meals','tours','insurance','other')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Invoice Items (package + services per pilgrim)
CREATE TABLE invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  pilgrim_id UUID REFERENCES pilgrims(id) ON DELETE CASCADE,
  item_type TEXT CHECK (item_type IN ('package','service','discount')),
  description TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,
  total_price NUMERIC(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  extra_service_id UUID REFERENCES extra_services(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Payment History (supports installments)
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  pilgrim_id UUID REFERENCES pilgrims(id),  -- Optional: track per pilgrim
  amount NUMERIC(10,2) NOT NULL,
  payment_method TEXT CHECK (payment_method IN ('cash','card','bank_transfer','check')),
  reference_number TEXT,
  notes TEXT,
  paid_by UUID REFERENCES users(id),
  payment_date TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Room Assignments (actual room allocations)
CREATE TABLE room_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  accommodation_id UUID REFERENCES accommodations(id),
  room_type_id UUID REFERENCES room_types(id),
  room_number TEXT,
  pilgrim_id UUID REFERENCES pilgrims(id),
  assigned_by UUID REFERENCES users(id),
  assigned_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- Modify existing pilgrims table
-- =============================================
ALTER TABLE pilgrims 
  ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male','female')),
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id),
  ADD COLUMN IF NOT EXISTS mahram_group_id UUID REFERENCES mahram_groups(id),
  ADD COLUMN IF NOT EXISTS spouse_id UUID,  -- Self-reference added later
  ADD COLUMN IF NOT EXISTS parent_id UUID;  -- Self-reference added later

-- Add self-referential foreign keys separately
ALTER TABLE pilgrims 
  ADD CONSTRAINT fk_pilgrim_spouse FOREIGN KEY (spouse_id) REFERENCES pilgrims(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_pilgrim_parent FOREIGN KEY (parent_id) REFERENCES pilgrims(id) ON DELETE SET NULL;

-- Modify packages table to support both templates and booking-specific packages
ALTER TABLE packages
  ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES bookings(id),
  ADD COLUMN IF NOT EXISTS is_template BOOLEAN DEFAULT true;

-- =============================================
-- Create indexes for performance
-- =============================================
CREATE INDEX IF NOT EXISTS idx_clients_agency ON clients(agency_id);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);
CREATE INDEX IF NOT EXISTS idx_bookings_agency ON bookings(agency_id);
CREATE INDEX IF NOT EXISTS idx_bookings_client ON bookings(client_id);
CREATE INDEX IF NOT EXISTS idx_bookings_season ON bookings(season_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_number ON bookings(booking_number);
CREATE INDEX IF NOT EXISTS idx_extra_services_agency ON extra_services(agency_id);
CREATE INDEX IF NOT EXISTS idx_extra_services_category ON extra_services(category);
CREATE INDEX IF NOT EXISTS idx_invoice_items_booking ON invoice_items(booking_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_pilgrim ON invoice_items(pilgrim_id);
CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_room_assignments_booking ON room_assignments(booking_id);
CREATE INDEX IF NOT EXISTS idx_pilgrims_booking ON pilgrims(booking_id);
CREATE INDEX IF NOT EXISTS idx_pilgrims_gender ON pilgrims(gender);
CREATE INDEX IF NOT EXISTS idx_pilgrims_mahram_group ON pilgrims(mahram_group_id);

-- =============================================
-- Function to generate booking numbers
-- =============================================
CREATE OR REPLACE FUNCTION generate_booking_number(p_agency_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_year TEXT;
  v_sequence INTEGER;
  v_booking_number TEXT;
BEGIN
  v_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  
  -- Get next sequence number for this agency and year
  SELECT COALESCE(MAX(
    NULLIF(REGEXP_REPLACE(booking_number, 'BK-' || v_year || '-', ''), '')::INTEGER
  ), 0) + 1
  INTO v_sequence
  FROM bookings
  WHERE agency_id = p_agency_id
    AND booking_number LIKE 'BK-' || v_year || '-%';
  
  v_booking_number := 'BK-' || v_year || '-' || LPAD(v_sequence::TEXT, 4, '0');
  
  RETURN v_booking_number;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- Trigger to update booking paid_amount on payment insert/update/delete
-- =============================================
CREATE OR REPLACE FUNCTION update_booking_paid_amount()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE bookings 
    SET paid_amount = COALESCE((
      SELECT SUM(amount) FROM payments WHERE booking_id = OLD.booking_id
    ), 0)
    WHERE id = OLD.booking_id;
    RETURN OLD;
  ELSE
    UPDATE bookings 
    SET paid_amount = COALESCE((
      SELECT SUM(amount) FROM payments WHERE booking_id = NEW.booking_id
    ), 0)
    WHERE id = NEW.booking_id;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_booking_paid_amount
AFTER INSERT OR UPDATE OR DELETE ON payments
FOR EACH ROW EXECUTE FUNCTION update_booking_paid_amount();

-- =============================================
-- Trigger to update booking total_amount on invoice items change
-- =============================================
CREATE OR REPLACE FUNCTION update_booking_total_amount()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE bookings 
    SET total_amount = COALESCE((
      SELECT SUM(quantity * unit_price) FROM invoice_items WHERE booking_id = OLD.booking_id
    ), 0)
    WHERE id = OLD.booking_id;
    RETURN OLD;
  ELSE
    UPDATE bookings 
    SET total_amount = COALESCE((
      SELECT SUM(quantity * unit_price) FROM invoice_items WHERE booking_id = NEW.booking_id
    ), 0)
    WHERE id = NEW.booking_id;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_booking_total_amount
AFTER INSERT OR UPDATE OR DELETE ON invoice_items
FOR EACH ROW EXECUTE FUNCTION update_booking_total_amount();

-- =============================================
-- RLS Policies
-- =============================================

-- Enable RLS on all new tables
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE extra_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE mahram_groups ENABLE ROW LEVEL SECURITY;

-- Clients policies
CREATE POLICY "clients_select" ON clients FOR SELECT
  USING (agency_id = (auth.jwt() ->> 'agency_id')::uuid);

CREATE POLICY "clients_insert" ON clients FOR INSERT
  WITH CHECK (agency_id = (auth.jwt() ->> 'agency_id')::uuid);

CREATE POLICY "clients_update" ON clients FOR UPDATE
  USING (agency_id = (auth.jwt() ->> 'agency_id')::uuid);

CREATE POLICY "clients_delete" ON clients FOR DELETE
  USING (agency_id = (auth.jwt() ->> 'agency_id')::uuid);

-- Bookings policies
CREATE POLICY "bookings_select" ON bookings FOR SELECT
  USING (agency_id = (auth.jwt() ->> 'agency_id')::uuid);

CREATE POLICY "bookings_insert" ON bookings FOR INSERT
  WITH CHECK (agency_id = (auth.jwt() ->> 'agency_id')::uuid);

CREATE POLICY "bookings_update" ON bookings FOR UPDATE
  USING (agency_id = (auth.jwt() ->> 'agency_id')::uuid);

CREATE POLICY "bookings_delete" ON bookings FOR DELETE
  USING (agency_id = (auth.jwt() ->> 'agency_id')::uuid);

-- Extra services policies
CREATE POLICY "extra_services_select" ON extra_services FOR SELECT
  USING (agency_id = (auth.jwt() ->> 'agency_id')::uuid);

CREATE POLICY "extra_services_insert" ON extra_services FOR INSERT
  WITH CHECK (agency_id = (auth.jwt() ->> 'agency_id')::uuid);

CREATE POLICY "extra_services_update" ON extra_services FOR UPDATE
  USING (agency_id = (auth.jwt() ->> 'agency_id')::uuid);

CREATE POLICY "extra_services_delete" ON extra_services FOR DELETE
  USING (agency_id = (auth.jwt() ->> 'agency_id')::uuid);

-- Invoice items policies (via booking agency)
CREATE POLICY "invoice_items_select" ON invoice_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM bookings b 
    WHERE b.id = invoice_items.booking_id 
    AND b.agency_id = (auth.jwt() ->> 'agency_id')::uuid
  ));

CREATE POLICY "invoice_items_insert" ON invoice_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM bookings b 
    WHERE b.id = invoice_items.booking_id 
    AND b.agency_id = (auth.jwt() ->> 'agency_id')::uuid
  ));

CREATE POLICY "invoice_items_update" ON invoice_items FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM bookings b 
    WHERE b.id = invoice_items.booking_id 
    AND b.agency_id = (auth.jwt() ->> 'agency_id')::uuid
  ));

CREATE POLICY "invoice_items_delete" ON invoice_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM bookings b 
    WHERE b.id = invoice_items.booking_id 
    AND b.agency_id = (auth.jwt() ->> 'agency_id')::uuid
  ));

-- Payments policies (via booking agency)
CREATE POLICY "payments_select" ON payments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM bookings b 
    WHERE b.id = payments.booking_id 
    AND b.agency_id = (auth.jwt() ->> 'agency_id')::uuid
  ));

CREATE POLICY "payments_insert" ON payments FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM bookings b 
    WHERE b.id = payments.booking_id 
    AND b.agency_id = (auth.jwt() ->> 'agency_id')::uuid
  ));

CREATE POLICY "payments_update" ON payments FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM bookings b 
    WHERE b.id = payments.booking_id 
    AND b.agency_id = (auth.jwt() ->> 'agency_id')::uuid
  ));

CREATE POLICY "payments_delete" ON payments FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM bookings b 
    WHERE b.id = payments.booking_id 
    AND b.agency_id = (auth.jwt() ->> 'agency_id')::uuid
  ));

-- Room assignments policies (via booking agency)
CREATE POLICY "room_assignments_select" ON room_assignments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM bookings b 
    WHERE b.id = room_assignments.booking_id 
    AND b.agency_id = (auth.jwt() ->> 'agency_id')::uuid
  ));

CREATE POLICY "room_assignments_insert" ON room_assignments FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM bookings b 
    WHERE b.id = room_assignments.booking_id 
    AND b.agency_id = (auth.jwt() ->> 'agency_id')::uuid
  ));

CREATE POLICY "room_assignments_update" ON room_assignments FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM bookings b 
    WHERE b.id = room_assignments.booking_id 
    AND b.agency_id = (auth.jwt() ->> 'agency_id')::uuid
  ));

CREATE POLICY "room_assignments_delete" ON room_assignments FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM bookings b 
    WHERE b.id = room_assignments.booking_id 
    AND b.agency_id = (auth.jwt() ->> 'agency_id')::uuid
  ));

-- Mahram groups policies
CREATE POLICY "mahram_groups_select" ON mahram_groups FOR SELECT
  USING (agency_id = (auth.jwt() ->> 'agency_id')::uuid);

CREATE POLICY "mahram_groups_insert" ON mahram_groups FOR INSERT
  WITH CHECK (agency_id = (auth.jwt() ->> 'agency_id')::uuid);

CREATE POLICY "mahram_groups_update" ON mahram_groups FOR UPDATE
  USING (agency_id = (auth.jwt() ->> 'agency_id')::uuid);

CREATE POLICY "mahram_groups_delete" ON mahram_groups FOR DELETE
  USING (agency_id = (auth.jwt() ->> 'agency_id')::uuid);

-- =============================================
-- Views for dashboard and reporting
-- =============================================

-- Booking summary view
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
  b.confirmed_at
FROM bookings b
LEFT JOIN clients c ON b.client_id = c.id
LEFT JOIN seasons s ON b.season_id = s.id
LEFT JOIN pilgrims p ON p.booking_id = b.id
GROUP BY b.id, c.id, s.id;
