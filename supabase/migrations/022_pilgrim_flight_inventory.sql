-- Allow per-pilgrim flight class selection (e.g. one pilgrim first class, another business)
ALTER TABLE pilgrims 
  ADD COLUMN IF NOT EXISTS flight_seat_inventory_id UUID REFERENCES flight_seat_inventory(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pilgrims_flight_inventory ON pilgrims(flight_seat_inventory_id);
COMMENT ON COLUMN pilgrims.flight_seat_inventory_id IS 'Specific flight inventory/seat class for this pilgrim when different per pilgrim';
