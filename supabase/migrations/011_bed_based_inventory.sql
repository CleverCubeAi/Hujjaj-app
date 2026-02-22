-- =============================================
-- Migration 011: Bed-Based Inventory & Country/City Support
-- =============================================
-- Changes inventory from room-based to bed-based pricing
-- Adds country support for accommodations

-- =============================================
-- Add country column to accommodations
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accommodations' AND column_name = 'country') THEN
    ALTER TABLE accommodations ADD COLUMN country TEXT DEFAULT 'SA';
  END IF;
END $$;

-- =============================================
-- Drop and recreate hotel_room_inventory with bed-based pricing
-- =============================================

-- First, check if we need to migrate data (safely)
DO $$
DECLARE
  has_data BOOLEAN;
  table_exists BOOLEAN;
BEGIN
  -- Check if the old table exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'hotel_room_inventory' 
    AND table_type = 'BASE TABLE'
  ) INTO table_exists;
  
  IF table_exists THEN
    SELECT EXISTS (SELECT 1 FROM hotel_room_inventory LIMIT 1) INTO has_data;
    
    IF has_data THEN
      -- Create backup table
      CREATE TABLE IF NOT EXISTS hotel_room_inventory_backup AS 
      SELECT * FROM hotel_room_inventory;
    END IF;
  END IF;
END $$;

-- Drop dependent objects (safely check if they exist)
DO $$
BEGIN
  -- Drop trigger if table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'booking_room_allocations') THEN
    DROP TRIGGER IF EXISTS trigger_update_hotel_inventory ON booking_room_allocations;
  END IF;
END $$;

DROP FUNCTION IF EXISTS update_hotel_inventory_on_allocation() CASCADE;

-- Drop old indexes (these are safe - IF EXISTS handles missing indexes)
DROP INDEX IF EXISTS idx_hotel_inventory_agency;
DROP INDEX IF EXISTS idx_hotel_inventory_season;
DROP INDEX IF EXISTS idx_hotel_inventory_accommodation;
DROP INDEX IF EXISTS idx_hotel_inventory_room_type;
DROP INDEX IF EXISTS idx_hotel_inventory_dates;

-- Drop old tables (safe with IF EXISTS)
DROP TABLE IF EXISTS booking_room_allocations;

-- Drop old table or view
DO $$
BEGIN
  -- Check if it's a view first
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'hotel_room_inventory') THEN
    DROP VIEW IF EXISTS hotel_room_inventory;
  ELSE
    DROP TABLE IF EXISTS hotel_room_inventory;
  END IF;
END $$;

-- =============================================
-- Create new hotel_bed_inventory table (bed-based)
-- =============================================
CREATE TABLE IF NOT EXISTS hotel_bed_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  season_id UUID REFERENCES seasons(id) ON DELETE CASCADE,
  accommodation_id UUID REFERENCES accommodations(id) ON DELETE CASCADE,
  room_type_id UUID REFERENCES room_types(id) ON DELETE CASCADE,
  
  -- Purchase Details (BUYING) - Now bed-based
  beds_purchased INTEGER NOT NULL CHECK (beds_purchased > 0),
  purchase_price_per_bed NUMERIC(12,2) NOT NULL CHECK (purchase_price_per_bed >= 0),
  total_purchase_cost NUMERIC(12,2) GENERATED ALWAYS AS 
    (beds_purchased * purchase_price_per_bed) STORED,
  
  -- Booking Period
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  nights INTEGER GENERATED ALWAYS AS 
    (check_out_date - check_in_date) STORED,
  
  -- Cost Analysis (per bed)
  cost_per_bed_per_night NUMERIC(12,2) GENERATED ALWAYS AS 
    (CASE 
      WHEN (check_out_date - check_in_date) > 0 
      THEN purchase_price_per_bed / (check_out_date - check_in_date)
      ELSE NULL
    END) STORED,
  
  -- Selling Price (SET BY ADMIN) - per bed
  sell_price_per_bed NUMERIC(12,2) CHECK (sell_price_per_bed >= 0),
  
  -- Inventory Tracking (bed-based)
  beds_sold INTEGER DEFAULT 0 CHECK (beds_sold >= 0),
  beds_available INTEGER GENERATED ALWAYS AS 
    (beds_purchased - beds_sold) STORED,
  
  -- Financial Metrics (bed-based)
  potential_revenue NUMERIC(12,2) GENERATED ALWAYS AS 
    (beds_purchased * COALESCE(sell_price_per_bed, 0)) STORED,
  margin_per_bed NUMERIC(12,2) GENERATED ALWAYS AS 
    (COALESCE(sell_price_per_bed, 0) - purchase_price_per_bed) STORED,
  
  -- Audit
  supplier_name TEXT,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints
  CHECK (check_out_date > check_in_date),
  CHECK (beds_sold <= beds_purchased)
);

-- =============================================
-- Create new booking_bed_allocations table
-- =============================================
CREATE TABLE IF NOT EXISTS booking_bed_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  hotel_bed_inventory_id UUID REFERENCES hotel_bed_inventory(id) ON DELETE RESTRICT,
  beds_allocated INTEGER NOT NULL CHECK (beds_allocated > 0),
  price_charged NUMERIC(12,2) NOT NULL CHECK (price_charged >= 0),
  allocated_at TIMESTAMPTZ DEFAULT now(),
  allocated_by UUID REFERENCES users(id),
  notes TEXT
);

-- =============================================
-- Indexes for Performance
-- =============================================
CREATE INDEX IF NOT EXISTS idx_bed_inventory_agency ON hotel_bed_inventory(agency_id);
CREATE INDEX IF NOT EXISTS idx_bed_inventory_season ON hotel_bed_inventory(season_id);
CREATE INDEX IF NOT EXISTS idx_bed_inventory_accommodation ON hotel_bed_inventory(accommodation_id);
CREATE INDEX IF NOT EXISTS idx_bed_inventory_room_type ON hotel_bed_inventory(room_type_id);
CREATE INDEX IF NOT EXISTS idx_bed_inventory_dates ON hotel_bed_inventory(check_in_date, check_out_date);
CREATE INDEX IF NOT EXISTS idx_bed_allocations_booking ON booking_bed_allocations(booking_id);
CREATE INDEX IF NOT EXISTS idx_bed_allocations_inventory ON booking_bed_allocations(hotel_bed_inventory_id);

-- =============================================
-- Trigger to Update Inventory on Allocation
-- =============================================
CREATE OR REPLACE FUNCTION update_bed_inventory_on_allocation()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE hotel_bed_inventory
    SET beds_sold = beds_sold + NEW.beds_allocated,
        updated_at = now()
    WHERE id = NEW.hotel_bed_inventory_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE hotel_bed_inventory
    SET beds_sold = beds_sold - OLD.beds_allocated,
        updated_at = now()
    WHERE id = OLD.hotel_bed_inventory_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_bed_inventory ON booking_bed_allocations;
CREATE TRIGGER trigger_update_bed_inventory
AFTER INSERT OR DELETE ON booking_bed_allocations
FOR EACH ROW EXECUTE FUNCTION update_bed_inventory_on_allocation();

-- =============================================
-- RLS Policies
-- =============================================
ALTER TABLE hotel_bed_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_bed_allocations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view bed inventory in their agency" ON hotel_bed_inventory;
DROP POLICY IF EXISTS "Admins can manage bed inventory in their agency" ON hotel_bed_inventory;
DROP POLICY IF EXISTS "Users can view bed allocations in their agency" ON booking_bed_allocations;
DROP POLICY IF EXISTS "Admins can manage bed allocations in their agency" ON booking_bed_allocations;

-- Hotel bed inventory policies
CREATE POLICY "Users can view bed inventory in their agency"
  ON hotel_bed_inventory FOR SELECT
  USING (agency_id IN (
    SELECT agency_id FROM users WHERE id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'
  ));

CREATE POLICY "Admins can manage bed inventory in their agency"
  ON hotel_bed_inventory FOR ALL
  USING (
    agency_id IN (
      SELECT agency_id FROM users WHERE id = auth.uid() AND role IN ('agency_admin', 'super_admin')
    ) OR EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Bed allocations policies
CREATE POLICY "Users can view bed allocations in their agency"
  ON booking_bed_allocations FOR SELECT
  USING (
    booking_id IN (
      SELECT id FROM bookings WHERE agency_id IN (
        SELECT agency_id FROM users WHERE id = auth.uid()
      )
    ) OR EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY "Admins can manage bed allocations in their agency"
  ON booking_bed_allocations FOR ALL
  USING (
    booking_id IN (
      SELECT id FROM bookings WHERE agency_id IN (
        SELECT agency_id FROM users WHERE id = auth.uid() AND role IN ('agency_admin', 'super_admin')
      )
    ) OR EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- =============================================
-- Create view for compatibility (hotel_room_inventory)
-- =============================================
CREATE OR REPLACE VIEW hotel_room_inventory AS
SELECT 
  id,
  agency_id,
  season_id,
  accommodation_id,
  room_type_id,
  beds_purchased as rooms_purchased,
  purchase_price_per_bed as purchase_price_per_room,
  total_purchase_cost,
  check_in_date,
  check_out_date,
  nights,
  cost_per_bed_per_night as cost_per_room_per_night,
  sell_price_per_bed as sell_price_per_room,
  beds_sold as rooms_sold,
  beds_available as rooms_available,
  potential_revenue,
  margin_per_bed as margin_per_room,
  supplier_name,
  notes,
  created_by,
  created_at,
  updated_at
FROM hotel_bed_inventory;

-- =============================================
-- Function to get beds per room based on room type
-- =============================================
CREATE OR REPLACE FUNCTION get_beds_per_room(room_type_name TEXT)
RETURNS INTEGER AS $$
BEGIN
  CASE room_type_name
    WHEN 'double' THEN RETURN 2;
    WHEN 'triple' THEN RETURN 3;
    WHEN 'quad' THEN RETURN 4;
    WHEN 'quint' THEN RETURN 5;
    ELSE RETURN 2; -- default to double
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================
-- Function to update room_types when inventory changes
-- =============================================
CREATE OR REPLACE FUNCTION update_room_type_capacity_on_inventory()
RETURNS TRIGGER AS $$
DECLARE
  room_type_record RECORD;
  total_beds_in_inventory INTEGER;
  beds_per_room INTEGER;
  calculated_rooms INTEGER;
BEGIN
  -- Get the room type info
  SELECT id, type INTO room_type_record
  FROM room_types
  WHERE id = COALESCE(NEW.room_type_id, OLD.room_type_id);
  
  IF room_type_record IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Calculate total beds from all inventory for this room type
  SELECT COALESCE(SUM(beds_purchased), 0) INTO total_beds_in_inventory
  FROM hotel_bed_inventory
  WHERE room_type_id = room_type_record.id;
  
  -- Get beds per room based on type
  beds_per_room := get_beds_per_room(room_type_record.type);
  
  -- Calculate rooms (round up to handle odd numbers)
  calculated_rooms := CEIL(total_beds_in_inventory::NUMERIC / beds_per_room);
  
  -- Update the room_types table
  UPDATE room_types
  SET total_beds = total_beds_in_inventory,
      total_rooms = calculated_rooms
  WHERE id = room_type_record.id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- Trigger to update room_types on inventory changes
-- =============================================
DROP TRIGGER IF EXISTS trigger_update_room_type_capacity ON hotel_bed_inventory;

CREATE TRIGGER trigger_update_room_type_capacity
AFTER INSERT OR UPDATE OR DELETE ON hotel_bed_inventory
FOR EACH ROW EXECUTE FUNCTION update_room_type_capacity_on_inventory();
