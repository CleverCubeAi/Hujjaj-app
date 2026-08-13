exports.up = async function up(knex) {
  await knex.schema.createTable('refresh_sessions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.text('token_hash').notNullable().unique();
    t.timestamp('expires_at', { useTz: true }).notNullable();
    t.timestamp('revoked_at', { useTz: true });
    t.text('user_agent');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['user_id']);
  });

  await knex.raw(`
    CREATE OR REPLACE FUNCTION check_bed_availability_with_locks(
      p_accommodation_id UUID,
      p_room_type_id UUID,
      p_season_id UUID,
      p_agency_id UUID,
      p_quantity_needed INTEGER,
      p_exclude_session_id TEXT DEFAULT NULL
    )
    RETURNS TABLE (
      beds_available INTEGER,
      beds_locked INTEGER,
      beds_truly_available INTEGER,
      is_available BOOLEAN
    ) AS $$
    DECLARE
      v_beds_available INTEGER;
      v_beds_locked INTEGER;
    BEGIN
      SELECT COALESCE(SUM(hbi.beds_available), 0) INTO v_beds_available
      FROM hotel_bed_inventory hbi
      WHERE hbi.accommodation_id = p_accommodation_id
        AND hbi.room_type_id = p_room_type_id
        AND hbi.season_id = p_season_id
        AND hbi.agency_id = p_agency_id;

      SELECT COALESCE(SUM(bl.quantity), 0) INTO v_beds_locked
      FROM booking_locks bl
      WHERE bl.resource_type = 'bed'
        AND bl.accommodation_id = p_accommodation_id
        AND bl.room_type_id = p_room_type_id
        AND bl.season_id = p_season_id
        AND bl.agency_id = p_agency_id
        AND bl.expires_at > now()
        AND (p_exclude_session_id IS NULL OR bl.session_id != p_exclude_session_id);

      RETURN QUERY SELECT
        v_beds_available,
        v_beds_locked,
        (v_beds_available - v_beds_locked)::INTEGER,
        (v_beds_available - v_beds_locked) >= p_quantity_needed;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await knex.raw(`
    CREATE OR REPLACE FUNCTION get_user_discount_permissions(
      p_agency_id UUID,
      p_user_id UUID DEFAULT NULL,
      p_discount_id UUID DEFAULT NULL
    )
    RETURNS TABLE (
      id UUID,
      user_id UUID,
      discount_setting_id UUID,
      usage_limit INTEGER,
      usage_count INTEGER,
      reset_period TEXT,
      last_reset_at TIMESTAMPTZ,
      is_active BOOLEAN,
      granted_by UUID,
      granted_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ,
      user_data JSON,
      discount_setting JSON
    )
    SET search_path = public
    AS $$
    BEGIN
      RETURN QUERY
      SELECT
        udp.id,
        udp.user_id,
        udp.discount_setting_id,
        udp.usage_limit,
        udp.usage_count,
        udp.reset_period,
        udp.last_reset_at,
        udp.is_active,
        udp.granted_by,
        udp.granted_at,
        udp.updated_at,
        json_build_object(
          'id', u.id,
          'email', u.email,
          'full_name', u.full_name,
          'role', u.role,
          'agency_id', u.agency_id,
          'branch_id', u.branch_id,
          'avatar_url', u.avatar_url
        ) as user_data,
        row_to_json(ds.*)::JSON as discount_setting
      FROM user_discount_permissions udp
      LEFT JOIN users u ON u.id = udp.user_id
      LEFT JOIN discount_settings ds ON ds.id = udp.discount_setting_id
      WHERE ds.agency_id = p_agency_id
        AND (p_user_id IS NULL OR udp.user_id = p_user_id)
        AND (p_discount_id IS NULL OR udp.discount_setting_id = p_discount_id)
      ORDER BY udp.granted_at DESC;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await knex.raw(`
    CREATE OR REPLACE FUNCTION get_discount_usage_log(
      p_agency_id UUID,
      p_user_id UUID DEFAULT NULL,
      p_discount_id UUID DEFAULT NULL,
      p_date_from TIMESTAMPTZ DEFAULT NULL,
      p_date_to TIMESTAMPTZ DEFAULT NULL,
      p_limit INTEGER DEFAULT 100
    )
    RETURNS TABLE (
      id UUID,
      agency_id UUID,
      booking_id UUID,
      user_id UUID,
      discount_setting_id UUID,
      discount_name TEXT,
      discount_type TEXT,
      discount_value NUMERIC,
      discount_amount NUMERIC,
      booking_total_before NUMERIC,
      booking_total_after NUMERIC,
      created_at TIMESTAMPTZ,
      user_data JSON,
      discount_setting JSON,
      booking JSON
    )
    SET search_path = public
    AS $$
    BEGIN
      RETURN QUERY
      SELECT
        dul.id,
        dul.agency_id,
        dul.booking_id,
        dul.user_id,
        dul.discount_setting_id,
        dul.discount_name,
        dul.discount_type,
        dul.discount_value,
        dul.discount_amount,
        dul.booking_total_before,
        dul.booking_total_after,
        dul.created_at,
        json_build_object(
          'id', u.id,
          'email', u.email,
          'full_name', u.full_name,
          'role', u.role,
          'agency_id', u.agency_id,
          'branch_id', u.branch_id,
          'avatar_url', u.avatar_url
        ) as user_data,
        row_to_json(ds.*)::JSON as discount_setting,
        row_to_json(b.*)::JSON as booking
      FROM discount_usage_log dul
      LEFT JOIN users u ON u.id = dul.user_id
      LEFT JOIN discount_settings ds ON ds.id = dul.discount_setting_id
      LEFT JOIN bookings b ON b.id = dul.booking_id
      WHERE dul.agency_id = p_agency_id
        AND (p_user_id IS NULL OR dul.user_id = p_user_id)
        AND (p_discount_id IS NULL OR dul.discount_setting_id = p_discount_id)
        AND (p_date_from IS NULL OR dul.created_at >= p_date_from)
        AND (p_date_to IS NULL OR dul.created_at <= p_date_to)
      ORDER BY dul.created_at DESC
      LIMIT p_limit;
    END;
    $$ LANGUAGE plpgsql;
  `);

  const tenantTables = [
    'branches', 'users', 'seasons', 'flights', 'accommodations', 'clients',
    'mahram_groups', 'hotel_bed_inventory', 'flight_seat_inventory', 'bookings',
    'packages', 'pilgrims', 'extra_services', 'expenses', 'expense_categories',
    'booking_locks', 'email_settings', 'sms_settings', 'financial_handovers',
    'discount_settings', 'discount_usage_log', 'message_templates', 'sent_messages',
  ];

  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'hujjaj_app') THEN
        CREATE ROLE hujjaj_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
      END IF;
    END $$;
  `);

  await knex.raw('GRANT USAGE ON SCHEMA public TO hujjaj_app');
  await knex.raw('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO hujjaj_app');
  await knex.raw('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO hujjaj_app');
  await knex.raw('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO hujjaj_app');
  await knex.raw('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO hujjaj_app');

  for (const table of tenantTables) {
    await knex.raw(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
    await knex.raw(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
    await knex.raw(`DROP POLICY IF EXISTS tenant_isolation ON ${table}`);
    await knex.raw(`
      CREATE POLICY tenant_isolation ON ${table}
      FOR ALL
      USING (
        current_setting('app.is_super_admin', true) = 'true'
        OR agency_id::text = NULLIF(current_setting('app.agency_id', true), '')
      )
      WITH CHECK (
        current_setting('app.is_super_admin', true) = 'true'
        OR agency_id::text = NULLIF(current_setting('app.agency_id', true), '')
      )
    `);
  }

  await knex.raw(`ALTER TABLE refresh_sessions ENABLE ROW LEVEL SECURITY`);
  await knex.raw(`ALTER TABLE refresh_sessions FORCE ROW LEVEL SECURITY`);
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
};

exports.down = async function down(knex) {
  const tenantTables = [
    'branches', 'users', 'seasons', 'flights', 'accommodations', 'clients',
    'mahram_groups', 'hotel_bed_inventory', 'flight_seat_inventory', 'bookings',
    'packages', 'pilgrims', 'extra_services', 'expenses', 'expense_categories',
    'booking_locks', 'email_settings', 'sms_settings', 'financial_handovers',
    'discount_settings', 'discount_usage_log', 'message_templates', 'sent_messages',
  ];
  for (const table of tenantTables) {
    await knex.raw(`DROP POLICY IF EXISTS tenant_isolation ON ${table}`);
    await knex.raw(`ALTER TABLE ${table} NO FORCE ROW LEVEL SECURITY`);
    await knex.raw(`ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY`);
  }
  await knex.schema.dropTableIfExists('refresh_sessions');
};
