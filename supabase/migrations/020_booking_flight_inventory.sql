-- Add flight_seat_inventory_id to bookings
-- This allows allocating to the exact inventory batch the user selected in the wizard
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS flight_seat_inventory_id UUID REFERENCES flight_seat_inventory(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_flight_inventory ON bookings(flight_seat_inventory_id);

COMMENT ON COLUMN bookings.flight_seat_inventory_id IS 'Specific flight inventory batch selected for this booking; used for seat allocation on confirmation';
