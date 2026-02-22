-- View for bed status
CREATE OR REPLACE VIEW room_bed_status AS
SELECT
  rt.id AS room_type_id,
  rt.accommodation_id,
  rt.type,
  rt.total_beds,
  COALESCE(COUNT(p.id), 0) AS allocated_beds,
  rt.total_beds - COALESCE(COUNT(p.id), 0) AS remaining_beds,
  rt.total_rooms,
  CEIL(COALESCE(COUNT(p.id), 0)::NUMERIC / 
    CASE rt.type 
      WHEN 'double' THEN 2 
      WHEN 'triple' THEN 3 
      WHEN 'quad' THEN 4 
      WHEN 'quint' THEN 5 
      ELSE 1
    END) AS allocated_rooms,
  rt.total_rooms - CEIL(COALESCE(COUNT(p.id), 0)::NUMERIC / 
    CASE rt.type 
      WHEN 'double' THEN 2 
      WHEN 'triple' THEN 3 
      WHEN 'quad' THEN 4 
      WHEN 'quint' THEN 5 
      ELSE 1
    END) AS remaining_rooms
FROM room_types rt
LEFT JOIN pilgrims p ON p.room_type_id = rt.id
GROUP BY rt.id;

-- View for expense summary
CREATE OR REPLACE VIEW expense_summary AS
SELECT 
  season_id,
  category,
  SUM(amount) as total_amount
FROM expenses
GROUP BY season_id, category;

-- Trigger to validate bed allocation (Optional but recommended)
CREATE OR REPLACE FUNCTION check_bed_capacity()
RETURNS TRIGGER AS $$
DECLARE
  beds_available INTEGER;
  beds_needed INTEGER := 1; -- Assuming 1 pilgrim = 1 bed
BEGIN
  SELECT (total_beds - (
    SELECT count(*) FROM pilgrims WHERE room_type_id = NEW.room_type_id AND id != NEW.id
  )) INTO beds_available
  FROM room_types
  WHERE id = NEW.room_type_id;

  IF beds_available < beds_needed THEN
    RAISE EXCEPTION 'No beds available in this room type';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Uncomment to enable strict capacity check
-- CREATE TRIGGER enforce_bed_capacity
-- BEFORE INSERT OR UPDATE ON pilgrims
-- FOR EACH ROW EXECUTE FUNCTION check_bed_capacity();

-- Indexing for performance
CREATE INDEX idx_seasons_agency ON seasons(agency_id);
CREATE INDEX idx_flights_season ON flights(season_id);
CREATE INDEX idx_accommodations_season ON accommodations(season_id);
CREATE INDEX idx_room_types_accommodation ON room_types(accommodation_id);
CREATE INDEX idx_pilgrims_season ON pilgrims(season_id);
CREATE INDEX idx_pilgrims_flight ON pilgrims(flight_id);
CREATE INDEX idx_pilgrims_accommodation ON pilgrims(accommodation_id);
CREATE INDEX idx_expenses_season ON expenses(season_id);
