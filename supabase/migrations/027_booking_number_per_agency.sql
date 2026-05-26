-- =============================================
-- Migration 027: Scope booking_number UNIQUE per agency (Issue #18 schema fix)
-- =============================================
-- Background: migration 004 declared `booking_number TEXT UNIQUE NOT NULL`
-- (globally unique across all tenants), but generate_booking_number(p_agency_id)
-- only looks within one agency. This made the FIRST booking in any second tenant
-- always collide on "BK-YYYY-0001".
--
-- Fix: drop the global UNIQUE, add a composite UNIQUE on (agency_id, booking_number)
-- so each agency can have its own BK-YYYY-0001 sequence.
--
-- After applying, you may also revert the workaround in
-- backend/src/controllers/bookings.controller.ts (the inline max-query) back to
-- calling supabase.rpc('generate_booking_number', { p_agency_id: agencyId }).

DO $$
DECLARE
  ct text;
BEGIN
  -- 1. Find the existing UNIQUE constraint on booking_number (name may vary)
  SELECT conname INTO ct
  FROM pg_constraint
  WHERE conrelid = 'bookings'::regclass
    AND contype = 'u'
    AND pg_get_constraintdef(oid) ILIKE 'UNIQUE (booking_number)';

  IF ct IS NOT NULL THEN
    EXECUTE format('ALTER TABLE bookings DROP CONSTRAINT %I', ct);
    RAISE NOTICE 'Dropped global UNIQUE constraint: %', ct;
  ELSE
    RAISE NOTICE 'No global UNIQUE (booking_number) constraint found — skipping drop.';
  END IF;
END $$;

-- 2. Add composite UNIQUE (agency_id, booking_number). idempotent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'bookings'::regclass
      AND conname = 'bookings_agency_booking_number_unique'
  ) THEN
    ALTER TABLE bookings
      ADD CONSTRAINT bookings_agency_booking_number_unique
      UNIQUE (agency_id, booking_number);
    RAISE NOTICE 'Added composite UNIQUE (agency_id, booking_number).';
  END IF;
END $$;

-- =============================================
-- Verification
-- =============================================
-- After applying, this query should return ONLY the composite constraint:
--   SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--   WHERE conrelid = 'bookings'::regclass AND contype = 'u';
