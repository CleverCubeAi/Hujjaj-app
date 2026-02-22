-- =============================================
-- Flight Transits - Support for indirect flights
-- =============================================

-- Add flight type column
ALTER TABLE flights 
  ADD COLUMN IF NOT EXISTS is_direct BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS total_duration_minutes INTEGER;

-- Transit stops table
CREATE TABLE IF NOT EXISTS flight_transits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_id UUID REFERENCES flights(id) ON DELETE CASCADE,
  stop_order INTEGER NOT NULL,  -- 1, 2, 3...
  city TEXT NOT NULL,
  airport_code TEXT,
  arrival_time TIMESTAMPTZ,
  departure_time TIMESTAMPTZ,
  layover_minutes INTEGER,
  carrier TEXT,  -- In case different carrier for this leg
  flight_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_flight_transits_flight ON flight_transits(flight_id);
CREATE INDEX IF NOT EXISTS idx_flight_transits_order ON flight_transits(flight_id, stop_order);

-- RLS Policies for flight_transits
ALTER TABLE flight_transits ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view transits for flights they can see
CREATE POLICY "Users can view flight transits" ON flight_transits
  FOR SELECT USING (
    flight_id IN (
      SELECT id FROM flights WHERE agency_id IN (
        SELECT agency_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- Policy: Users can manage transits for their agency's flights
CREATE POLICY "Users can manage flight transits" ON flight_transits
  FOR ALL USING (
    flight_id IN (
      SELECT id FROM flights WHERE agency_id IN (
        SELECT agency_id FROM users WHERE id = auth.uid()
      )
    )
  );
