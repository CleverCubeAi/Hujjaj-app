-- =============================================
-- Reset Bookings & Inventory + Seed Fresh Data
-- =============================================
-- Run this in Supabase SQL Editor to clear all booking/inventory data
-- and seed sample seasons, flights, accommodations.
--
-- WARNING: This will DELETE all bookings, pilgrims, clients, inventory data.
-- Agencies and users are preserved.
-- =============================================

BEGIN;

-- Get first agency for seeding (modify if you have multiple agencies)
DO $$
DECLARE
  v_agency_id UUID;
  v_season_id UUID;
  v_accommodation_id UUID;
  v_room_type_double UUID;
BEGIN
  SELECT id INTO v_agency_id FROM agencies LIMIT 1;
  IF v_agency_id IS NULL THEN
    RAISE EXCEPTION 'No agency found. Create an agency first.';
  END IF;

  -- =============================================
  -- STEP 1: Delete in correct order (child tables first)
  -- =============================================

  -- Allocation tables
  DELETE FROM booking_bed_allocations;
  DELETE FROM booking_flight_allocations;

  -- Booking locks
  DELETE FROM booking_locks;

  -- Room assignments
  DELETE FROM room_assignments;

  -- Invoice & payments
  DELETE FROM invoice_items;
  DELETE FROM payments;

  -- Discount usage log
  DELETE FROM discount_usage_log WHERE booking_id IS NOT NULL;

  -- Pilgrims (must delete before clients - they reference client_id)
  DELETE FROM pilgrims WHERE agency_id = v_agency_id;

  -- Bookings
  DELETE FROM bookings;

  -- Inventory tables
  DELETE FROM hotel_bed_inventory;
  DELETE FROM flight_seat_inventory;

  -- Clients (after pilgrims - pilgrims reference clients)
  DELETE FROM clients WHERE agency_id = v_agency_id;

  -- Reset sent_messages booking references (optional)
  UPDATE sent_messages SET booking_id = NULL WHERE agency_id = v_agency_id;

  -- =============================================
  -- STEP 2: Seed fresh data
  -- =============================================

  -- Create season: Summer Holiday (Omra)
  INSERT INTO seasons (agency_id, name, type, start_date, end_date, status)
  VALUES (v_agency_id, 'عطلة صيفية', 'omra', '2026-06-01', '2026-09-30', 'active')
  RETURNING id INTO v_season_id;

  -- Create flights
  INSERT INTO flights (agency_id, season_id, code, departure_city, arrival_city, departure_date, return_date, carrier, is_direct)
  VALUES
    (v_agency_id, v_season_id, 'AT-350', 'CMN', 'JED', '2026-03-13', '2026-03-20', 'Royal Air Maroc', true),
    (v_agency_id, v_season_id, 'CMN-SV', 'CMN', 'JED', '2026-02-12', '2026-02-19', 'Saudia', true);

  -- Create accommodation
  INSERT INTO accommodations (agency_id, season_id, name, name_ar, city, country)
  VALUES (v_agency_id, v_season_id, 'Aswaf', 'أسواف', 'madinah', 'SA')
  RETURNING id INTO v_accommodation_id;

  -- Create room types for the accommodation
  INSERT INTO room_types (accommodation_id, type, total_rooms, total_beds, price_per_bed)
  VALUES
    (v_accommodation_id, 'double', 5, 10, 500),
    (v_accommodation_id, 'triple', 3, 9, 450),
    (v_accommodation_id, 'quad', 2, 8, 400);

  SELECT id INTO v_room_type_double FROM room_types WHERE accommodation_id = v_accommodation_id AND type = 'double' LIMIT 1;

  -- Create flight seat inventory (for AT-350)
  INSERT INTO flight_seat_inventory (agency_id, season_id, flight_id, seats_purchased, purchase_price_per_seat, sell_price_per_seat)
  SELECT v_agency_id, v_season_id, f.id, 15, 7500, 9500
  FROM flights f WHERE f.agency_id = v_agency_id AND f.code = 'AT-350' AND f.season_id = v_season_id LIMIT 1;

  -- Create flight seat inventory (for CMN-SV)
  INSERT INTO flight_seat_inventory (agency_id, season_id, flight_id, seats_purchased, purchase_price_per_seat, sell_price_per_seat)
  SELECT v_agency_id, v_season_id, f.id, 40, 7000, 8000
  FROM flights f WHERE f.agency_id = v_agency_id AND f.code = 'CMN-SV' AND f.season_id = v_season_id LIMIT 1;

  -- Create hotel bed inventory
  INSERT INTO hotel_bed_inventory (agency_id, season_id, accommodation_id, room_type_id, beds_purchased, purchase_price_per_bed, sell_price_per_bed, check_in_date, check_out_date)
  SELECT v_agency_id, v_season_id, v_accommodation_id, v_room_type_double, 10, 400, 500, '2026-06-01', '2026-06-08';

  RAISE NOTICE 'Reset and seed completed successfully. Agency: %, Season: %', v_agency_id, v_season_id;
END $$;

COMMIT;
