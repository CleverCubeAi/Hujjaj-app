-- Add seat_class to flight_seat_inventory (economy, business, first_class)
ALTER TABLE flight_seat_inventory 
  ADD COLUMN IF NOT EXISTS seat_class TEXT DEFAULT 'economy' 
  CHECK (seat_class IN ('economy', 'business', 'first_class'));

COMMENT ON COLUMN flight_seat_inventory.seat_class IS 'Seat class: economy, business, or first_class';
