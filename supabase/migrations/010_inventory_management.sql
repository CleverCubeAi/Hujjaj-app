-- =============================================
-- Migration 010: Inventory Management Separation
-- =============================================
-- Separates prepaid inventory (hotel rooms, flight seats) from operational expenses

-- =============================================
-- Hotel Room Inventory Table
-- =============================================
CREATE TABLE IF NOT EXISTS hotel_room_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  season_id UUID REFERENCES seasons(id) ON DELETE CASCADE,
  accommodation_id UUID REFERENCES accommodations(id) ON DELETE CASCADE,
  room_type_id UUID REFERENCES room_types(id) ON DELETE CASCADE,
  
  -- Purchase Details (BUYING)
  rooms_purchased INTEGER NOT NULL CHECK (rooms_purchased > 0),
  purchase_price_per_room NUMERIC(12,2) NOT NULL CHECK (purchase_price_per_room >= 0),
  total_purchase_cost NUMERIC(12,2) GENERATED ALWAYS AS 
    (rooms_purchased * purchase_price_per_room) STORED,
  
  -- Booking Period
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  nights INTEGER GENERATED ALWAYS AS 
    (check_out_date - check_in_date) STORED,
  
  -- Cost Analysis
  cost_per_room_per_night NUMERIC(12,2) GENERATED ALWAYS AS 
    (CASE 
      WHEN (check_out_date - check_in_date) > 0 
      THEN purchase_price_per_room / (check_out_date - check_in_date)
      ELSE NULL
    END) STORED,
  
  -- Selling Price (SET BY ADMIN)
  sell_price_per_room NUMERIC(12,2) CHECK (sell_price_per_room >= 0),
  
  -- Inventory Tracking
  rooms_sold INTEGER DEFAULT 0 CHECK (rooms_sold >= 0),
  rooms_available INTEGER GENERATED ALWAYS AS 
    (rooms_purchased - rooms_sold) STORED,
  
  -- Financial Metrics
  potential_revenue NUMERIC(12,2) GENERATED ALWAYS AS 
    (rooms_purchased * COALESCE(sell_price_per_room, 0)) STORED,
  margin_per_room NUMERIC(12,2) GENERATED ALWAYS AS 
    (COALESCE(sell_price_per_room, 0) - purchase_price_per_room) STORED,
  
  -- Audit
  supplier_name TEXT,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints
  CHECK (check_out_date > check_in_date),
  CHECK (rooms_sold <= rooms_purchased)
);

-- =============================================
-- Flight Seat Inventory Table
-- =============================================
CREATE TABLE IF NOT EXISTS flight_seat_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  season_id UUID REFERENCES seasons(id) ON DELETE CASCADE,
  flight_id UUID REFERENCES flights(id) ON DELETE CASCADE,
  
  -- Purchase Details (BUYING)
  seats_purchased INTEGER NOT NULL CHECK (seats_purchased > 0),
  purchase_price_per_seat NUMERIC(12,2) NOT NULL CHECK (purchase_price_per_seat >= 0),
  total_purchase_cost NUMERIC(12,2) GENERATED ALWAYS AS 
    (seats_purchased * purchase_price_per_seat) STORED,
  
  -- Selling Price (SET BY ADMIN)
  sell_price_per_seat NUMERIC(12,2) CHECK (sell_price_per_seat >= 0),
  
  -- Inventory Tracking
  seats_sold INTEGER DEFAULT 0 CHECK (seats_sold >= 0),
  seats_available INTEGER GENERATED ALWAYS AS 
    (seats_purchased - seats_sold) STORED,
  
  -- Financial Metrics
  potential_revenue NUMERIC(12,2) GENERATED ALWAYS AS 
    (seats_purchased * COALESCE(sell_price_per_seat, 0)) STORED,
  margin_per_seat NUMERIC(12,2) GENERATED ALWAYS AS 
    (COALESCE(sell_price_per_seat, 0) - purchase_price_per_seat) STORED,
  
  -- Audit
  airline_reference TEXT,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints
  CHECK (seats_sold <= seats_purchased)
);

-- =============================================
-- Booking Room Allocations Table
-- =============================================
CREATE TABLE IF NOT EXISTS booking_room_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  hotel_room_inventory_id UUID REFERENCES hotel_room_inventory(id) ON DELETE RESTRICT,
  rooms_allocated INTEGER NOT NULL CHECK (rooms_allocated > 0),
  price_charged NUMERIC(12,2) NOT NULL CHECK (price_charged >= 0),
  allocated_at TIMESTAMPTZ DEFAULT now(),
  allocated_by UUID REFERENCES users(id),
  notes TEXT
);

-- =============================================
-- Booking Flight Allocations Table
-- =============================================
CREATE TABLE IF NOT EXISTS booking_flight_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  flight_seat_inventory_id UUID REFERENCES flight_seat_inventory(id) ON DELETE RESTRICT,
  seats_allocated INTEGER NOT NULL CHECK (seats_allocated > 0),
  price_charged NUMERIC(12,2) NOT NULL CHECK (price_charged >= 0),
  allocated_at TIMESTAMPTZ DEFAULT now(),
  allocated_by UUID REFERENCES users(id),
  notes TEXT
);

-- =============================================
-- Indexes for Performance
-- =============================================
CREATE INDEX IF NOT EXISTS idx_hotel_inventory_agency ON hotel_room_inventory(agency_id);
CREATE INDEX IF NOT EXISTS idx_hotel_inventory_season ON hotel_room_inventory(season_id);
CREATE INDEX IF NOT EXISTS idx_hotel_inventory_accommodation ON hotel_room_inventory(accommodation_id);
CREATE INDEX IF NOT EXISTS idx_hotel_inventory_room_type ON hotel_room_inventory(room_type_id);
CREATE INDEX IF NOT EXISTS idx_hotel_inventory_dates ON hotel_room_inventory(check_in_date, check_out_date);

CREATE INDEX IF NOT EXISTS idx_flight_inventory_agency ON flight_seat_inventory(agency_id);
CREATE INDEX IF NOT EXISTS idx_flight_inventory_season ON flight_seat_inventory(season_id);
CREATE INDEX IF NOT EXISTS idx_flight_inventory_flight ON flight_seat_inventory(flight_id);

CREATE INDEX IF NOT EXISTS idx_room_allocations_booking ON booking_room_allocations(booking_id);
CREATE INDEX IF NOT EXISTS idx_room_allocations_inventory ON booking_room_allocations(hotel_room_inventory_id);

CREATE INDEX IF NOT EXISTS idx_flight_allocations_booking ON booking_flight_allocations(booking_id);
CREATE INDEX IF NOT EXISTS idx_flight_allocations_inventory ON booking_flight_allocations(flight_seat_inventory_id);

-- =============================================
-- Triggers to Update Inventory on Allocation
-- =============================================

-- Function to update hotel inventory when allocation is created/deleted
CREATE OR REPLACE FUNCTION update_hotel_inventory_on_allocation()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE hotel_room_inventory
    SET rooms_sold = rooms_sold + NEW.rooms_allocated,
        updated_at = now()
    WHERE id = NEW.hotel_room_inventory_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE hotel_room_inventory
    SET rooms_sold = rooms_sold - OLD.rooms_allocated,
        updated_at = now()
    WHERE id = OLD.hotel_room_inventory_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_hotel_inventory
AFTER INSERT OR DELETE ON booking_room_allocations
FOR EACH ROW EXECUTE FUNCTION update_hotel_inventory_on_allocation();

-- Function to update flight inventory when allocation is created/deleted
CREATE OR REPLACE FUNCTION update_flight_inventory_on_allocation()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE flight_seat_inventory
    SET seats_sold = seats_sold + NEW.seats_allocated,
        updated_at = now()
    WHERE id = NEW.flight_seat_inventory_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE flight_seat_inventory
    SET seats_sold = seats_sold - OLD.seats_allocated,
        updated_at = now()
    WHERE id = OLD.flight_seat_inventory_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_flight_inventory
AFTER INSERT OR DELETE ON booking_flight_allocations
FOR EACH ROW EXECUTE FUNCTION update_flight_inventory_on_allocation();

-- =============================================
-- RLS Policies
-- =============================================

ALTER TABLE hotel_room_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE flight_seat_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_room_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_flight_allocations ENABLE ROW LEVEL SECURITY;

-- Hotel inventory policies
CREATE POLICY "Users can view hotel inventory in their agency"
  ON hotel_room_inventory FOR SELECT
  USING (agency_id IN (
    SELECT agency_id FROM users WHERE id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'
  ));

CREATE POLICY "Admins can manage hotel inventory in their agency"
  ON hotel_room_inventory FOR ALL
  USING (
    agency_id IN (
      SELECT agency_id FROM users WHERE id = auth.uid() AND role IN ('agency_admin', 'super_admin')
    ) OR EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Flight inventory policies
CREATE POLICY "Users can view flight inventory in their agency"
  ON flight_seat_inventory FOR SELECT
  USING (agency_id IN (
    SELECT agency_id FROM users WHERE id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'
  ));

CREATE POLICY "Admins can manage flight inventory in their agency"
  ON flight_seat_inventory FOR ALL
  USING (
    agency_id IN (
      SELECT agency_id FROM users WHERE id = auth.uid() AND role IN ('agency_admin', 'super_admin')
    ) OR EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Room allocations policies
CREATE POLICY "Users can view room allocations in their agency"
  ON booking_room_allocations FOR SELECT
  USING (
    booking_id IN (
      SELECT id FROM bookings WHERE agency_id IN (
        SELECT agency_id FROM users WHERE id = auth.uid()
      )
    ) OR EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY "Admins can manage room allocations in their agency"
  ON booking_room_allocations FOR ALL
  USING (
    booking_id IN (
      SELECT id FROM bookings WHERE agency_id IN (
        SELECT agency_id FROM users WHERE id = auth.uid() AND role IN ('agency_admin', 'super_admin')
      )
    ) OR EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Flight allocations policies
CREATE POLICY "Users can view flight allocations in their agency"
  ON booking_flight_allocations FOR SELECT
  USING (
    booking_id IN (
      SELECT id FROM bookings WHERE agency_id IN (
        SELECT agency_id FROM users WHERE id = auth.uid()
      )
    ) OR EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY "Admins can manage flight allocations in their agency"
  ON booking_flight_allocations FOR ALL
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
-- Add created_by to expenses table (for audit)
-- =============================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'expenses') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'created_by') THEN
      ALTER TABLE expenses ADD COLUMN created_by UUID REFERENCES users(id);
    END IF;
  END IF;
END $$;
