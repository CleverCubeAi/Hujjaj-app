-- Store per-pilgrim hotel inventory IDs when each pilgrim has different hotels (multi-hotel season coverage)
ALTER TABLE pilgrims
  ADD COLUMN IF NOT EXISTS hotel_inventory_ids UUID[] DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_pilgrims_hotel_inventory ON pilgrims USING GIN (hotel_inventory_ids);
COMMENT ON COLUMN pilgrims.hotel_inventory_ids IS 'Array of hotel_bed_inventory IDs for this pilgrim when different per pilgrim (covers multiple hotels/periods)';

-- Ensure bookings has same_selection_for_all for room allocation logic
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS same_selection_for_all BOOLEAN DEFAULT true;
COMMENT ON COLUMN bookings.same_selection_for_all IS 'If true, all pilgrims share same flight/accommodation. If false, each pilgrim may have different selections.';

-- Allow per-pilgrim bed allocation tracking
ALTER TABLE booking_bed_allocations
  ADD COLUMN IF NOT EXISTS pilgrim_id UUID REFERENCES pilgrims(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_bed_allocations_pilgrim ON booking_bed_allocations(pilgrim_id);
