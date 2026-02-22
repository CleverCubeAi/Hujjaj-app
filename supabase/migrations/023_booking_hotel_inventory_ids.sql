-- Store multiple hotel inventory batch IDs for multi-hotel season coverage
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS hotel_inventory_ids UUID[] DEFAULT NULL;

COMMENT ON COLUMN bookings.hotel_inventory_ids IS 'Array of hotel_bed_inventory IDs when booking spans multiple hotels/periods to cover full season';
