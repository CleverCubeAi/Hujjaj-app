-- Enable RLS on all tables
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE flights ENABLE ROW LEVEL SECURITY;
ALTER TABLE accommodations ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE pilgrims ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- 1. Agencies: Self access
CREATE POLICY "Agency self access" ON agencies
FOR SELECT USING (
  id = (auth.jwt() ->> 'agency_id')::uuid
);

-- 2. Users: Users in same agency
CREATE POLICY "Users in same agency" ON users
FOR ALL USING (
  agency_id = (auth.jwt() ->> 'agency_id')::uuid
);

-- 3. Seasons: Agency isolation
CREATE POLICY "Season agency isolation" ON seasons
FOR ALL USING (
  agency_id = (auth.jwt() ->> 'agency_id')::uuid
);

-- 4. Flights: Agency isolation
CREATE POLICY "Flights agency isolation" ON flights
FOR ALL USING (
  agency_id = (auth.jwt() ->> 'agency_id')::uuid
);

-- 5. Accommodations: Agency isolation
CREATE POLICY "Accommodation agency isolation" ON accommodations
FOR ALL USING (
  agency_id = (auth.jwt() ->> 'agency_id')::uuid
);

-- 6. Room Types: Agency isolation (via accommodations)
CREATE POLICY "Room types by agency" ON room_types
FOR ALL USING (
  accommodation_id IN (
    SELECT id FROM accommodations
    WHERE agency_id = (auth.jwt() ->> 'agency_id')::uuid
  )
);

-- 7. Packages: Agency isolation
CREATE POLICY "Packages by agency" ON packages
FOR ALL USING (
  agency_id = (auth.jwt() ->> 'agency_id')::uuid
);

-- 8. Pilgrims: Agency isolation
CREATE POLICY "Pilgrims by agency" ON pilgrims
FOR ALL USING (
  agency_id = (auth.jwt() ->> 'agency_id')::uuid
);

-- 9. Expenses: Agency isolation
CREATE POLICY "Expenses by agency" ON expenses
FOR ALL USING (
  agency_id = (auth.jwt() ->> 'agency_id')::uuid
);
