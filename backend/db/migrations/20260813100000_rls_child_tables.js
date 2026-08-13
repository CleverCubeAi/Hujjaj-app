/**
 * Fail-closed RLS follow-up:
 * - Child tables (payments, invoice_items, rooms, allocations, …)
 * - refresh_sessions bound to app.user_id (or platform super-admin)
 * - Disable login on hujjaj_app so the old default password cannot be used
 */

async function enableFkPolicy(knex, table, sqlUsing) {
  await knex.raw(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
  await knex.raw(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
  await knex.raw(`DROP POLICY IF EXISTS tenant_isolation ON ${table}`);
  await knex.raw(`
    CREATE POLICY tenant_isolation ON ${table}
    FOR ALL
    USING (
      current_setting('app.is_super_admin', true) = 'true'
      OR (${sqlUsing})
    )
    WITH CHECK (
      current_setting('app.is_super_admin', true) = 'true'
      OR (${sqlUsing})
    )
  `);
}

exports.up = async function up(knex) {
  await knex.raw(`
    DO $$
    BEGIN
      IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'hujjaj_app') THEN
        ALTER ROLE hujjaj_app NOLOGIN;
        ALTER ROLE hujjaj_app PASSWORD NULL;
      END IF;
    END $$;
  `);

  await knex.raw(`DROP POLICY IF EXISTS refresh_sessions_own ON refresh_sessions`);
  await knex.raw(`
    CREATE POLICY refresh_sessions_own ON refresh_sessions
    FOR ALL
    USING (
      current_setting('app.is_super_admin', true) = 'true'
      OR user_id::text = NULLIF(current_setting('app.user_id', true), '')
    )
    WITH CHECK (
      current_setting('app.is_super_admin', true) = 'true'
      OR user_id::text = NULLIF(current_setting('app.user_id', true), '')
    )
  `);

  await enableFkPolicy(
    knex,
    'invoice_items',
    `EXISTS (SELECT 1 FROM bookings b WHERE b.id = invoice_items.booking_id AND b.agency_id::text = NULLIF(current_setting('app.agency_id', true), ''))`
  );
  await enableFkPolicy(
    knex,
    'payments',
    `EXISTS (SELECT 1 FROM bookings b WHERE b.id = payments.booking_id AND b.agency_id::text = NULLIF(current_setting('app.agency_id', true), ''))`
  );
  await enableFkPolicy(
    knex,
    'room_assignments',
    `EXISTS (SELECT 1 FROM bookings b WHERE b.id = room_assignments.booking_id AND b.agency_id::text = NULLIF(current_setting('app.agency_id', true), ''))`
  );
  await enableFkPolicy(
    knex,
    'booking_bed_allocations',
    `EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_bed_allocations.booking_id AND b.agency_id::text = NULLIF(current_setting('app.agency_id', true), ''))`
  );
  await enableFkPolicy(
    knex,
    'booking_flight_allocations',
    `EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_flight_allocations.booking_id AND b.agency_id::text = NULLIF(current_setting('app.agency_id', true), ''))`
  );
  await enableFkPolicy(
    knex,
    'room_types',
    `EXISTS (SELECT 1 FROM accommodations a WHERE a.id = room_types.accommodation_id AND a.agency_id::text = NULLIF(current_setting('app.agency_id', true), ''))`
  );
  await enableFkPolicy(
    knex,
    'flight_transits',
    `EXISTS (SELECT 1 FROM flights f WHERE f.id = flight_transits.flight_id AND f.agency_id::text = NULLIF(current_setting('app.agency_id', true), ''))`
  );
  await enableFkPolicy(
    knex,
    'user_discount_permissions',
    `EXISTS (SELECT 1 FROM users u WHERE u.id = user_discount_permissions.user_id AND u.agency_id::text = NULLIF(current_setting('app.agency_id', true), ''))`
  );
  await enableFkPolicy(
    knex,
    'expense_allocations',
    `EXISTS (SELECT 1 FROM expenses e WHERE e.id = expense_allocations.expense_id AND e.agency_id::text = NULLIF(current_setting('app.agency_id', true), ''))`
  );
  await enableFkPolicy(
    knex,
    'financial_handover_status_history',
    `EXISTS (SELECT 1 FROM financial_handovers h WHERE h.id = financial_handover_status_history.handover_id AND h.agency_id::text = NULLIF(current_setting('app.agency_id', true), ''))`
  );
  await enableFkPolicy(
    knex,
    'user_preferences',
    `EXISTS (SELECT 1 FROM users u WHERE u.id = user_preferences.user_id AND u.agency_id::text = NULLIF(current_setting('app.agency_id', true), ''))`
  );
  await enableFkPolicy(
    knex,
    'user_security_settings',
    `EXISTS (SELECT 1 FROM users u WHERE u.id = user_security_settings.user_id AND u.agency_id::text = NULLIF(current_setting('app.agency_id', true), ''))`
  );
  await enableFkPolicy(
    knex,
    'agencies',
    `id::text = NULLIF(current_setting('app.agency_id', true), '')`
  );
};

exports.down = async function down(knex) {
  const tables = [
    'invoice_items', 'payments', 'room_assignments', 'booking_bed_allocations',
    'booking_flight_allocations', 'room_types', 'flight_transits',
    'user_discount_permissions', 'expense_allocations',
    'financial_handover_status_history', 'user_preferences',
    'user_security_settings', 'agencies',
  ];
  for (const table of tables) {
    await knex.raw(`DROP POLICY IF EXISTS tenant_isolation ON ${table}`);
    await knex.raw(`ALTER TABLE ${table} NO FORCE ROW LEVEL SECURITY`);
    await knex.raw(`ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY`);
  }
  await knex.raw(`DROP POLICY IF EXISTS refresh_sessions_own ON refresh_sessions`);
  await knex.raw(`
    CREATE POLICY refresh_sessions_own ON refresh_sessions
    FOR ALL USING (true) WITH CHECK (true)
  `);
};
