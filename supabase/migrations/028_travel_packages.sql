-- Travel packages: a season bundle of one flight lot, hotel lots, and services,
-- sold below the sum of those standalone sell prices.

ALTER TABLE packages ADD COLUMN IF NOT EXISTS name_ar TEXT;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';
ALTER TABLE packages ADD COLUMN IF NOT EXISTS flight_seat_inventory_id UUID REFERENCES flight_seat_inventory(id) ON DELETE SET NULL;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS calculated_price NUMERIC(12,2);
ALTER TABLE packages ADD COLUMN IF NOT EXISTS selling_price NUMERIC(12,2);
ALTER TABLE packages ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

UPDATE packages
SET status = 'draft'
WHERE status IS NULL;

UPDATE packages
SET selling_price = price,
    calculated_price = price
WHERE selling_price IS NULL AND price IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'packages_status_check'
  ) THEN
    ALTER TABLE packages
      ADD CONSTRAINT packages_status_check
      CHECK (status IN ('draft', 'published', 'archived'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS package_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  component_type TEXT NOT NULL CHECK (component_type IN ('flight', 'hotel', 'service')),
  flight_seat_inventory_id UUID REFERENCES flight_seat_inventory(id) ON DELETE RESTRICT,
  hotel_bed_inventory_id UUID REFERENCES hotel_bed_inventory(id) ON DELETE RESTRICT,
  extra_service_id UUID REFERENCES extra_services(id) ON DELETE RESTRICT,
  snapshot_sell_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  snapshot_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  CHECK (
    (component_type = 'flight' AND flight_seat_inventory_id IS NOT NULL AND hotel_bed_inventory_id IS NULL AND extra_service_id IS NULL)
    OR (component_type = 'hotel' AND hotel_bed_inventory_id IS NOT NULL AND flight_seat_inventory_id IS NULL AND extra_service_id IS NULL)
    OR (component_type = 'service' AND extra_service_id IS NOT NULL AND flight_seat_inventory_id IS NULL AND hotel_bed_inventory_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_packages_agency ON packages(agency_id);
CREATE INDEX IF NOT EXISTS idx_packages_season ON packages(season_id);
CREATE INDEX IF NOT EXISTS idx_packages_status ON packages(status);
CREATE INDEX IF NOT EXISTS idx_package_components_package ON package_components(package_id);
CREATE UNIQUE INDEX IF NOT EXISTS package_components_one_flight
  ON package_components(package_id) WHERE component_type = 'flight';
CREATE UNIQUE INDEX IF NOT EXISTS package_components_hotel_once
  ON package_components(package_id, hotel_bed_inventory_id) WHERE hotel_bed_inventory_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS package_components_service_once
  ON package_components(package_id, extra_service_id) WHERE extra_service_id IS NOT NULL;

ALTER TABLE package_components ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Package components by agency" ON package_components;
CREATE POLICY "Package components by agency" ON package_components
FOR ALL USING (
  package_id IN (
    SELECT id FROM packages
    WHERE agency_id = (auth.jwt() ->> 'agency_id')::uuid
      OR agency_id::text = NULLIF(current_setting('app.agency_id', true), '')
  )
  OR current_setting('app.is_super_admin', true) = 'true'
)
WITH CHECK (
  package_id IN (
    SELECT id FROM packages
    WHERE agency_id = (auth.jwt() ->> 'agency_id')::uuid
      OR agency_id::text = NULLIF(current_setting('app.agency_id', true), '')
  )
  OR current_setting('app.is_super_admin', true) = 'true'
);

COMMENT ON COLUMN packages.calculated_price IS 'Sum of component standalone sell prices, snapshotted on save';
COMMENT ON COLUMN packages.selling_price IS 'Admin bundle price, at or below calculated_price';
COMMENT ON TABLE package_components IS 'Flight lot, hotel lots, and services that make up a travel package';
