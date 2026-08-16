-- =============================================================================
-- Hujjaj — consolidated PostgreSQL schema (self-hosted, no Supabase)
-- Replaces supabase/migrations/001–027 as a single bootstrap script.
-- Idempotent-friendly: IF NOT EXISTS / OR REPLACE / DROP IF EXISTS where safe.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- Core tenants & users
-- =============================================================================

CREATE TABLE IF NOT EXISTS agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  country TEXT,
  status TEXT DEFAULT 'active',
  subscription_plan TEXT DEFAULT 'free',
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  city TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  contact_person TEXT,
  logo_url TEXT,
  bank_name TEXT,
  bank_account TEXT,
  bank_iban TEXT,
  is_headquarters BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  full_name TEXT,
  role TEXT CHECK (role IN ('super_admin','agency_admin','manager','agent')),
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- Seasons, flights, accommodations, packages
-- =============================================================================

CREATE TABLE IF NOT EXISTS seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('hajj','omra','ramadan')),
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS flights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  season_id UUID REFERENCES seasons(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  departure_city TEXT,
  arrival_city TEXT DEFAULT 'SV',
  departure_date DATE NOT NULL,
  return_date DATE NOT NULL,
  carrier TEXT,
  is_direct BOOLEAN DEFAULT true,
  total_duration_minutes INTEGER,
  airline_logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS flight_transits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_id UUID REFERENCES flights(id) ON DELETE CASCADE,
  stop_order INTEGER NOT NULL,
  city TEXT NOT NULL,
  airport_code TEXT,
  arrival_time TIMESTAMPTZ,
  departure_time TIMESTAMPTZ,
  layover_minutes INTEGER,
  carrier TEXT,
  flight_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS accommodations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  season_id UUID REFERENCES seasons(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_ar TEXT,
  city TEXT,
  country TEXT DEFAULT 'SA',
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS room_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accommodation_id UUID REFERENCES accommodations(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('double','triple','quad','quint')),
  total_rooms INTEGER NOT NULL DEFAULT 0,
  total_beds INTEGER NOT NULL DEFAULT 0,
  price_per_bed NUMERIC(10,2),
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- Clients, mahram, inventory (before bookings for FKs)
-- =============================================================================

CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  full_name_ar TEXT,
  email TEXT,
  phone TEXT NOT NULL,
  address TEXT,
  id_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mahram_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hotel_bed_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  season_id UUID REFERENCES seasons(id) ON DELETE CASCADE,
  accommodation_id UUID REFERENCES accommodations(id) ON DELETE CASCADE,
  room_type_id UUID REFERENCES room_types(id) ON DELETE CASCADE,
  beds_purchased INTEGER NOT NULL CHECK (beds_purchased > 0),
  purchase_price_per_bed NUMERIC(12,2) NOT NULL CHECK (purchase_price_per_bed >= 0),
  total_purchase_cost NUMERIC(12,2) GENERATED ALWAYS AS
    (beds_purchased * purchase_price_per_bed) STORED,
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  nights INTEGER GENERATED ALWAYS AS
    (check_out_date - check_in_date) STORED,
  cost_per_bed_per_night NUMERIC(12,2) GENERATED ALWAYS AS
    (CASE
      WHEN (check_out_date - check_in_date) > 0
      THEN purchase_price_per_bed / (check_out_date - check_in_date)
      ELSE NULL
    END) STORED,
  sell_price_per_bed NUMERIC(12,2) CHECK (sell_price_per_bed >= 0),
  beds_sold INTEGER DEFAULT 0 CHECK (beds_sold >= 0),
  beds_available INTEGER GENERATED ALWAYS AS
    (beds_purchased - beds_sold) STORED,
  potential_revenue NUMERIC(12,2) GENERATED ALWAYS AS
    (beds_purchased * COALESCE(sell_price_per_bed, 0)) STORED,
  margin_per_bed NUMERIC(12,2) GENERATED ALWAYS AS
    (COALESCE(sell_price_per_bed, 0) - purchase_price_per_bed) STORED,
  supplier_name TEXT,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CHECK (check_out_date > check_in_date),
  CHECK (beds_sold <= beds_purchased)
);

CREATE TABLE IF NOT EXISTS flight_seat_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  season_id UUID REFERENCES seasons(id) ON DELETE CASCADE,
  flight_id UUID REFERENCES flights(id) ON DELETE CASCADE,
  seats_purchased INTEGER NOT NULL CHECK (seats_purchased > 0),
  purchase_price_per_seat NUMERIC(12,2) NOT NULL CHECK (purchase_price_per_seat >= 0),
  total_purchase_cost NUMERIC(12,2) GENERATED ALWAYS AS
    (seats_purchased * purchase_price_per_seat) STORED,
  sell_price_per_seat NUMERIC(12,2) CHECK (sell_price_per_seat >= 0),
  seats_sold INTEGER DEFAULT 0 CHECK (seats_sold >= 0),
  seats_available INTEGER GENERATED ALWAYS AS
    (seats_purchased - seats_sold) STORED,
  potential_revenue NUMERIC(12,2) GENERATED ALWAYS AS
    (seats_purchased * COALESCE(sell_price_per_seat, 0)) STORED,
  margin_per_seat NUMERIC(12,2) GENERATED ALWAYS AS
    (COALESCE(sell_price_per_seat, 0) - purchase_price_per_seat) STORED,
  seat_class TEXT DEFAULT 'economy' CHECK (seat_class IN ('economy', 'business', 'first_class')),
  airline_reference TEXT,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CHECK (seats_sold <= seats_purchased)
);

-- =============================================================================
-- Bookings & related workflow
-- =============================================================================

CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_number TEXT NOT NULL,
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  season_id UUID REFERENCES seasons(id),
  flight_id UUID REFERENCES flights(id),
  accommodation_id UUID REFERENCES accommodations(id),
  room_type_id UUID REFERENCES room_types(id),
  flight_seat_inventory_id UUID REFERENCES flight_seat_inventory(id) ON DELETE SET NULL,
  hotel_inventory_ids UUID[] DEFAULT NULL,
  same_selection_for_all BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'confirmed', 'completed', 'cancelled', 'expired', 'paid')),
  total_amount NUMERIC(12,2) DEFAULT 0,
  paid_amount NUMERIC(12,2) DEFAULT 0,
  remaining_balance NUMERIC(12,2) GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  confirmed_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES users(id),
  deletion_reason TEXT,
  hold_expires_at TIMESTAMPTZ,
  hold_session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT bookings_agency_booking_number_unique UNIQUE (agency_id, booking_number)
);

CREATE TABLE IF NOT EXISTS packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  season_id UUID REFERENCES seasons(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  accommodation_id UUID REFERENCES accommodations(id),
  room_type TEXT,
  includes_visa BOOLEAN DEFAULT true,
  includes_transport BOOLEAN DEFAULT true,
  price NUMERIC(10,2),
  booking_id UUID REFERENCES bookings(id),
  is_template BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pilgrims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  season_id UUID REFERENCES seasons(id),
  flight_id UUID REFERENCES flights(id),
  accommodation_id UUID REFERENCES accommodations(id),
  room_type_id UUID REFERENCES room_types(id),
  package_id UUID REFERENCES packages(id),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id),
  mahram_group_id UUID REFERENCES mahram_groups(id),
  spouse_id UUID REFERENCES pilgrims(id) ON DELETE SET NULL,
  parent_id UUID REFERENCES pilgrims(id) ON DELETE SET NULL,
  flight_seat_inventory_id UUID REFERENCES flight_seat_inventory(id) ON DELETE SET NULL,
  hotel_inventory_ids UUID[] DEFAULT NULL,
  full_name TEXT NOT NULL,
  full_name_ar TEXT,
  passport_number TEXT,
  phone TEXT,
  gender TEXT CHECK (gender IN ('male','female')),
  date_of_birth DATE,
  relationship_type TEXT CHECK (relationship_type IN ('family', 'married', 'friends')) DEFAULT 'family',
  is_mahram BOOLEAN DEFAULT false,
  photo_url TEXT,
  passport_scan_url TEXT,
  agreed_price NUMERIC(10,2) DEFAULT 0,
  advance_payment NUMERIC(10,2) DEFAULT 0,
  remaining_balance NUMERIC(10,2) GENERATED ALWAYS AS (agreed_price - advance_payment) STORED,
  visa_included BOOLEAN DEFAULT true,
  transport_included BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS extra_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_ar TEXT,
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  category TEXT CHECK (category IN ('transport','guide','meals','tours','insurance','other')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  pilgrim_id UUID REFERENCES pilgrims(id) ON DELETE CASCADE,
  item_type TEXT CHECK (item_type IN ('package','service','discount')),
  description TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,
  total_price NUMERIC(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  extra_service_id UUID REFERENCES extra_services(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  pilgrim_id UUID REFERENCES pilgrims(id),
  amount NUMERIC(10,2) NOT NULL,
  payment_method TEXT CHECK (payment_method IN ('cash','card','bank_transfer','check')),
  reference_number TEXT,
  notes TEXT,
  paid_by UUID REFERENCES users(id),
  payment_date TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS room_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  accommodation_id UUID REFERENCES accommodations(id),
  room_type_id UUID REFERENCES room_types(id),
  room_number TEXT,
  pilgrim_id UUID REFERENCES pilgrims(id),
  assigned_by UUID REFERENCES users(id),
  assigned_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS booking_bed_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  hotel_bed_inventory_id UUID REFERENCES hotel_bed_inventory(id) ON DELETE RESTRICT,
  pilgrim_id UUID REFERENCES pilgrims(id) ON DELETE SET NULL,
  beds_allocated INTEGER NOT NULL CHECK (beds_allocated > 0),
  price_charged NUMERIC(12,2) NOT NULL CHECK (price_charged >= 0),
  allocated_at TIMESTAMPTZ DEFAULT now(),
  allocated_by UUID REFERENCES users(id),
  notes TEXT
);

CREATE TABLE IF NOT EXISTS booking_flight_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  flight_seat_inventory_id UUID REFERENCES flight_seat_inventory(id) ON DELETE RESTRICT,
  seats_allocated INTEGER NOT NULL CHECK (seats_allocated > 0),
  price_charged NUMERIC(12,2) NOT NULL CHECK (price_charged >= 0),
  allocated_at TIMESTAMPTZ DEFAULT now(),
  allocated_by UUID REFERENCES users(id),
  notes TEXT
);

CREATE TABLE IF NOT EXISTS booking_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('bed', 'flight_seat')),
  accommodation_id UUID REFERENCES accommodations(id) ON DELETE CASCADE,
  room_type_id UUID REFERENCES room_types(id) ON DELETE CASCADE,
  flight_id UUID REFERENCES flights(id) ON DELETE CASCADE,
  season_id UUID REFERENCES seasons(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  session_id TEXT NOT NULL,
  user_name TEXT,
  user_email TEXT
);

-- =============================================================================
-- Expenses
-- =============================================================================

CREATE TABLE IF NOT EXISTS expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_ar TEXT,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(agency_id, name)
);

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  season_id UUID REFERENCES seasons(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  category TEXT CHECK (category IN (
    'hotels',
    'visas',
    'transport',
    'saudi_fees',
    'khalidiya',
    'misc'
  )),
  category_id UUID REFERENCES expense_categories(id) ON DELETE SET NULL,
  expense_type TEXT CHECK (expense_type IN ('simple', 'prepayment')) DEFAULT 'simple',
  description TEXT,
  amount NUMERIC(12,2) NOT NULL,
  paid_date DATE,
  linked_resource_type TEXT CHECK (linked_resource_type IN ('accommodation', 'flight')),
  linked_resource_id UUID,
  total_quantity NUMERIC(10,2),
  used_quantity NUMERIC(10,2) DEFAULT 0,
  unit_cost NUMERIC(12,2),
  remaining_quantity NUMERIC(10,2) GENERATED ALWAYS AS (
    CASE
      WHEN expense_type = 'prepayment' THEN (total_quantity - COALESCE(used_quantity, 0))
      ELSE NULL
    END
  ) STORED,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expense_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  quantity NUMERIC(10,2) NOT NULL,
  allocated_at TIMESTAMPTZ DEFAULT now(),
  allocated_by UUID REFERENCES users(id),
  notes TEXT
);

-- =============================================================================
-- Settings, preferences, security
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  language TEXT DEFAULT 'ar',
  theme TEXT DEFAULT 'light',
  notifications_email BOOLEAN DEFAULT true,
  notifications_sms BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_settings (
  agency_id UUID PRIMARY KEY REFERENCES agencies(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('gmail', 'outlook', 'yahoo', 'custom')),
  host TEXT NOT NULL,
  port INTEGER NOT NULL,
  secure BOOLEAN DEFAULT false,
  username TEXT NOT NULL,
  password_encrypted TEXT NOT NULL,
  from_email TEXT NOT NULL,
  from_name TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  last_tested_at TIMESTAMPTZ,
  test_status TEXT CHECK (test_status IN ('success', 'failed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sms_settings (
  agency_id UUID PRIMARY KEY REFERENCES agencies(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('twilio', 'custom')),
  account_sid_encrypted TEXT,
  auth_token_encrypted TEXT,
  from_number TEXT,
  api_url TEXT,
  api_key_encrypted TEXT,
  api_secret_encrypted TEXT,
  enabled BOOLEAN DEFAULT true,
  last_tested_at TIMESTAMPTZ,
  test_status TEXT CHECK (test_status IN ('success', 'failed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_security_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  deletion_password_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- Financial handovers
-- =============================================================================

CREATE TABLE IF NOT EXISTS financial_handovers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  handover_type TEXT NOT NULL CHECK (handover_type IN ('sales_to_admin', 'expense_reimbursement')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  handover_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('wire', 'check', 'cash')),
  payment_reference TEXT,
  recipient_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'pending', 'received', 'refused', 'canceled')),
  season_id UUID REFERENCES seasons(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS financial_handover_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handover_id UUID NOT NULL REFERENCES financial_handovers(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  changed_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- Discounts
-- =============================================================================

CREATE TABLE IF NOT EXISTS discount_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_ar TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value NUMERIC(12,2) NOT NULL CHECK (discount_value > 0),
  max_discount_amount NUMERIC(12,2),
  min_booking_amount NUMERIC(12,2),
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_discount_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  discount_setting_id UUID REFERENCES discount_settings(id) ON DELETE CASCADE,
  usage_limit INTEGER,
  usage_count INTEGER DEFAULT 0,
  reset_period TEXT DEFAULT 'monthly' CHECK (reset_period IN ('daily', 'weekly', 'monthly', 'never')),
  last_reset_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  granted_by UUID REFERENCES users(id),
  granted_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, discount_setting_id)
);

CREATE TABLE IF NOT EXISTS discount_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  discount_setting_id UUID REFERENCES discount_settings(id) ON DELETE SET NULL,
  discount_name TEXT,
  discount_type TEXT,
  discount_value NUMERIC(12,2),
  discount_amount NUMERIC(12,2),
  booking_total_before NUMERIC(12,2),
  booking_total_after NUMERIC(12,2),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- Messages
-- =============================================================================

CREATE TABLE IF NOT EXISTS message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_ar TEXT,
  body TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'sms' CHECK (channel IN ('sms')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'sms' CHECK (channel IN ('sms')),
  recipient_phone TEXT NOT NULL,
  recipient_name TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  error_message TEXT,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  template_id UUID REFERENCES message_templates(id) ON DELETE SET NULL,
  sent_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- Indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_seasons_agency ON seasons(agency_id);
CREATE INDEX IF NOT EXISTS idx_flights_season ON flights(season_id);
CREATE INDEX IF NOT EXISTS idx_accommodations_season ON accommodations(season_id);
CREATE INDEX IF NOT EXISTS idx_room_types_accommodation ON room_types(accommodation_id);
CREATE INDEX IF NOT EXISTS idx_pilgrims_season ON pilgrims(season_id);
CREATE INDEX IF NOT EXISTS idx_pilgrims_flight ON pilgrims(flight_id);
CREATE INDEX IF NOT EXISTS idx_pilgrims_accommodation ON pilgrims(accommodation_id);
CREATE INDEX IF NOT EXISTS idx_expenses_season ON expenses(season_id);

CREATE INDEX IF NOT EXISTS idx_flight_transits_flight ON flight_transits(flight_id);
CREATE INDEX IF NOT EXISTS idx_flight_transits_order ON flight_transits(flight_id, stop_order);

CREATE INDEX IF NOT EXISTS idx_clients_agency ON clients(agency_id);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);
CREATE INDEX IF NOT EXISTS idx_clients_branch_id ON clients(branch_id);

CREATE INDEX IF NOT EXISTS idx_bookings_agency ON bookings(agency_id);
CREATE INDEX IF NOT EXISTS idx_bookings_client ON bookings(client_id);
CREATE INDEX IF NOT EXISTS idx_bookings_season ON bookings(season_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_number ON bookings(booking_number);
CREATE INDEX IF NOT EXISTS idx_bookings_deleted_at ON bookings(deleted_at);
CREATE INDEX IF NOT EXISTS idx_bookings_not_deleted ON bookings(agency_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_branch_id ON bookings(branch_id);
CREATE INDEX IF NOT EXISTS idx_bookings_hold_expires ON bookings(hold_expires_at)
  WHERE hold_expires_at IS NOT NULL AND status = 'draft';
CREATE INDEX IF NOT EXISTS idx_bookings_flight_inventory ON bookings(flight_seat_inventory_id);

CREATE INDEX IF NOT EXISTS idx_extra_services_agency ON extra_services(agency_id);
CREATE INDEX IF NOT EXISTS idx_extra_services_category ON extra_services(category);
CREATE INDEX IF NOT EXISTS idx_invoice_items_booking ON invoice_items(booking_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_pilgrim ON invoice_items(pilgrim_id);
CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_room_assignments_booking ON room_assignments(booking_id);

CREATE INDEX IF NOT EXISTS idx_pilgrims_booking ON pilgrims(booking_id);
CREATE INDEX IF NOT EXISTS idx_pilgrims_gender ON pilgrims(gender);
CREATE INDEX IF NOT EXISTS idx_pilgrims_mahram_group ON pilgrims(mahram_group_id);
CREATE INDEX IF NOT EXISTS idx_pilgrims_relationship_type ON pilgrims(relationship_type);
CREATE INDEX IF NOT EXISTS idx_pilgrims_is_mahram ON pilgrims(is_mahram);
CREATE INDEX IF NOT EXISTS idx_pilgrims_flight_inventory ON pilgrims(flight_seat_inventory_id);
CREATE INDEX IF NOT EXISTS idx_pilgrims_hotel_inventory ON pilgrims USING GIN (hotel_inventory_ids);

CREATE INDEX IF NOT EXISTS idx_expense_categories_agency ON expense_categories(agency_id);
CREATE INDEX IF NOT EXISTS idx_expenses_category_id ON expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_linked_resource ON expenses(linked_resource_type, linked_resource_id);
CREATE INDEX IF NOT EXISTS idx_expenses_branch_id ON expenses(branch_id);
CREATE INDEX IF NOT EXISTS idx_expense_allocations_expense ON expense_allocations(expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_allocations_booking ON expense_allocations(booking_id);

CREATE INDEX IF NOT EXISTS idx_bed_inventory_agency ON hotel_bed_inventory(agency_id);
CREATE INDEX IF NOT EXISTS idx_bed_inventory_season ON hotel_bed_inventory(season_id);
CREATE INDEX IF NOT EXISTS idx_bed_inventory_accommodation ON hotel_bed_inventory(accommodation_id);
CREATE INDEX IF NOT EXISTS idx_bed_inventory_room_type ON hotel_bed_inventory(room_type_id);
CREATE INDEX IF NOT EXISTS idx_bed_inventory_dates ON hotel_bed_inventory(check_in_date, check_out_date);
CREATE INDEX IF NOT EXISTS idx_bed_allocations_booking ON booking_bed_allocations(booking_id);
CREATE INDEX IF NOT EXISTS idx_bed_allocations_inventory ON booking_bed_allocations(hotel_bed_inventory_id);
CREATE INDEX IF NOT EXISTS idx_bed_allocations_pilgrim ON booking_bed_allocations(pilgrim_id);

CREATE INDEX IF NOT EXISTS idx_flight_inventory_agency ON flight_seat_inventory(agency_id);
CREATE INDEX IF NOT EXISTS idx_flight_inventory_season ON flight_seat_inventory(season_id);
CREATE INDEX IF NOT EXISTS idx_flight_inventory_flight ON flight_seat_inventory(flight_id);
CREATE INDEX IF NOT EXISTS idx_flight_allocations_booking ON booking_flight_allocations(booking_id);
CREATE INDEX IF NOT EXISTS idx_flight_allocations_inventory ON booking_flight_allocations(flight_seat_inventory_id);

CREATE INDEX IF NOT EXISTS idx_user_security_settings_user ON user_security_settings(user_id);

CREATE INDEX IF NOT EXISTS idx_handovers_agency ON financial_handovers(agency_id);
CREATE INDEX IF NOT EXISTS idx_handovers_created_by ON financial_handovers(created_by);
CREATE INDEX IF NOT EXISTS idx_handovers_recipient ON financial_handovers(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_handovers_status ON financial_handovers(status);
CREATE INDEX IF NOT EXISTS idx_handovers_type ON financial_handovers(handover_type);
CREATE INDEX IF NOT EXISTS idx_handovers_date ON financial_handovers(handover_date);
CREATE INDEX IF NOT EXISTS idx_handovers_season ON financial_handovers(season_id);
CREATE INDEX IF NOT EXISTS idx_handover_history_handover ON financial_handover_status_history(handover_id);

CREATE INDEX IF NOT EXISTS idx_branches_agency_id ON branches(agency_id);
CREATE INDEX IF NOT EXISTS idx_branches_is_active ON branches(is_active);
CREATE INDEX IF NOT EXISTS idx_users_branch_id ON users(branch_id);

CREATE INDEX IF NOT EXISTS idx_booking_locks_agency ON booking_locks(agency_id);
CREATE INDEX IF NOT EXISTS idx_booking_locks_expires ON booking_locks(expires_at);
CREATE INDEX IF NOT EXISTS idx_booking_locks_session ON booking_locks(session_id);
CREATE INDEX IF NOT EXISTS idx_booking_locks_bed ON booking_locks(accommodation_id, room_type_id, season_id)
  WHERE resource_type = 'bed';
CREATE INDEX IF NOT EXISTS idx_booking_locks_flight ON booking_locks(flight_id, season_id)
  WHERE resource_type = 'flight_seat';
CREATE INDEX IF NOT EXISTS idx_booking_locks_booking ON booking_locks(booking_id)
  WHERE booking_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_discount_settings_agency ON discount_settings(agency_id);
CREATE INDEX IF NOT EXISTS idx_discount_settings_active ON discount_settings(is_active);
CREATE INDEX IF NOT EXISTS idx_discount_settings_default ON discount_settings(is_default);
CREATE INDEX IF NOT EXISTS idx_user_discount_permissions_user ON user_discount_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_discount_permissions_discount ON user_discount_permissions(discount_setting_id);
CREATE INDEX IF NOT EXISTS idx_discount_usage_log_agency ON discount_usage_log(agency_id);
CREATE INDEX IF NOT EXISTS idx_discount_usage_log_user ON discount_usage_log(user_id);
CREATE INDEX IF NOT EXISTS idx_discount_usage_log_booking ON discount_usage_log(booking_id);
CREATE INDEX IF NOT EXISTS idx_discount_usage_log_date ON discount_usage_log(created_at);

CREATE INDEX IF NOT EXISTS idx_message_templates_agency ON message_templates(agency_id);
CREATE INDEX IF NOT EXISTS idx_sent_messages_agency_created ON sent_messages(agency_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sent_messages_client ON sent_messages(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sent_messages_booking ON sent_messages(booking_id) WHERE booking_id IS NOT NULL;

-- =============================================================================
-- Views
-- =============================================================================

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

CREATE OR REPLACE VIEW expense_summary AS
SELECT
  agency_id,
  season_id,
  category,
  SUM(amount) as total_amount
FROM expenses
GROUP BY agency_id, season_id, category;

CREATE OR REPLACE VIEW booking_summary AS
SELECT
  b.id,
  b.booking_number,
  b.agency_id,
  b.client_id,
  c.full_name AS client_name,
  c.full_name_ar AS client_name_ar,
  c.phone AS client_phone,
  b.season_id,
  s.name AS season_name,
  b.status,
  b.total_amount,
  b.paid_amount,
  b.remaining_balance,
  COUNT(DISTINCT p.id) AS pilgrims_count,
  b.created_at,
  b.confirmed_at,
  b.deleted_at,
  b.deleted_by,
  b.deletion_reason
FROM bookings b
LEFT JOIN clients c ON b.client_id = c.id
LEFT JOIN seasons s ON b.season_id = s.id
LEFT JOIN pilgrims p ON p.booking_id = b.id
WHERE b.deleted_at IS NULL
GROUP BY b.id, c.id, s.id;

-- Compatibility view (room-named aliases over bed inventory)
CREATE OR REPLACE VIEW hotel_room_inventory AS
SELECT
  id,
  agency_id,
  season_id,
  accommodation_id,
  room_type_id,
  beds_purchased as rooms_purchased,
  purchase_price_per_bed as purchase_price_per_room,
  total_purchase_cost,
  check_in_date,
  check_out_date,
  nights,
  cost_per_bed_per_night as cost_per_room_per_night,
  sell_price_per_bed as sell_price_per_room,
  beds_sold as rooms_sold,
  beds_available as rooms_available,
  potential_revenue,
  margin_per_bed as margin_per_room,
  supplier_name,
  notes,
  created_by,
  created_at,
  updated_at
FROM hotel_bed_inventory;

CREATE OR REPLACE VIEW handover_summary AS
SELECT
  h.id,
  h.agency_id,
  h.handover_type,
  h.amount,
  h.handover_date,
  h.payment_method,
  h.payment_reference,
  h.status,
  h.notes,
  h.created_at,
  h.updated_at,
  creator.full_name AS created_by_name,
  recipient.full_name AS recipient_name,
  s.name AS season_name
FROM financial_handovers h
LEFT JOIN users creator ON h.created_by = creator.id
LEFT JOIN users recipient ON h.recipient_user_id = recipient.id
LEFT JOIN seasons s ON h.season_id = s.id;

CREATE OR REPLACE VIEW users_with_branch AS
SELECT
  u.*,
  b.name as branch_name,
  b.city as branch_city,
  b.is_headquarters as branch_is_headquarters
FROM users u
LEFT JOIN branches b ON u.branch_id = b.id;

CREATE OR REPLACE VIEW user_available_discounts AS
SELECT
  ds.id,
  ds.agency_id,
  ds.name,
  ds.name_ar,
  ds.discount_type,
  ds.discount_value,
  ds.max_discount_amount,
  ds.min_booking_amount,
  ds.is_default,
  ds.sort_order,
  u.id as user_id,
  CASE
    WHEN ds.is_default THEN NULL
    ELSE udp.usage_limit
  END as usage_limit,
  CASE
    WHEN ds.is_default THEN 0
    ELSE COALESCE(udp.usage_count, 0)
  END as usage_count,
  CASE
    WHEN ds.is_default THEN NULL
    WHEN udp.usage_limit IS NULL THEN NULL
    ELSE udp.usage_limit - COALESCE(udp.usage_count, 0)
  END as remaining_uses,
  COALESCE(udp.reset_period, 'never') as reset_period
FROM discount_settings ds
CROSS JOIN users u
LEFT JOIN user_discount_permissions udp
  ON udp.discount_setting_id = ds.id AND udp.user_id = u.id AND udp.is_active = true
WHERE ds.is_active = true
  AND (ds.is_default = true OR udp.id IS NOT NULL)
  AND ds.agency_id = u.agency_id;

CREATE OR REPLACE VIEW bookings_with_hold_status AS
SELECT
  b.*,
  CASE
    WHEN b.hold_expires_at IS NULL THEN NULL
    WHEN b.hold_expires_at < NOW() THEN 'expired'
    WHEN b.hold_expires_at < NOW() + INTERVAL '2 hours' THEN 'expiring_soon'
    ELSE 'active'
  END AS hold_status,
  CASE
    WHEN b.hold_expires_at IS NULL THEN NULL
    ELSE EXTRACT(EPOCH FROM (b.hold_expires_at - NOW())) / 3600
  END AS hours_remaining,
  (SELECT COUNT(*) FROM booking_locks bl WHERE bl.booking_id = b.id) AS active_locks_count
FROM bookings b;

-- =============================================================================
-- Functions & triggers
-- =============================================================================

CREATE OR REPLACE FUNCTION check_bed_capacity()
RETURNS TRIGGER AS $$
DECLARE
  beds_available INTEGER;
  beds_needed INTEGER := 1;
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

CREATE OR REPLACE FUNCTION generate_booking_number(p_agency_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_year TEXT;
  v_sequence INTEGER;
  v_booking_number TEXT;
BEGIN
  v_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;

  SELECT COALESCE(MAX(
    NULLIF(REGEXP_REPLACE(booking_number, 'BK-' || v_year || '-', ''), '')::INTEGER
  ), 0) + 1
  INTO v_sequence
  FROM bookings
  WHERE agency_id = p_agency_id
    AND booking_number LIKE 'BK-' || v_year || '-%';

  v_booking_number := 'BK-' || v_year || '-' || LPAD(v_sequence::TEXT, 4, '0');

  RETURN v_booking_number;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_booking_paid_amount()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE bookings
    SET paid_amount = COALESCE((
      SELECT SUM(amount) FROM payments WHERE booking_id = OLD.booking_id
    ), 0)
    WHERE id = OLD.booking_id;
    RETURN OLD;
  ELSE
    UPDATE bookings
    SET paid_amount = COALESCE((
      SELECT SUM(amount) FROM payments WHERE booking_id = NEW.booking_id
    ), 0)
    WHERE id = NEW.booking_id;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_booking_paid_amount ON payments;
CREATE TRIGGER trigger_update_booking_paid_amount
AFTER INSERT OR UPDATE OR DELETE ON payments
FOR EACH ROW EXECUTE FUNCTION update_booking_paid_amount();

CREATE OR REPLACE FUNCTION update_booking_total_amount()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE bookings
    SET total_amount = COALESCE((
      SELECT SUM(quantity * unit_price) FROM invoice_items WHERE booking_id = OLD.booking_id
    ), 0)
    WHERE id = OLD.booking_id;
    RETURN OLD;
  ELSE
    UPDATE bookings
    SET total_amount = COALESCE((
      SELECT SUM(quantity * unit_price) FROM invoice_items WHERE booking_id = NEW.booking_id
    ), 0)
    WHERE id = NEW.booking_id;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_booking_total_amount ON invoice_items;
CREATE TRIGGER trigger_update_booking_total_amount
AFTER INSERT OR UPDATE OR DELETE ON invoice_items
FOR EACH ROW EXECUTE FUNCTION update_booking_total_amount();

CREATE OR REPLACE FUNCTION initialize_default_expense_categories(agency_uuid UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO expense_categories (agency_id, name, name_ar, is_default, is_active)
  VALUES
    (agency_uuid, 'Hotels', 'الفنادق', true, true),
    (agency_uuid, 'Visas', 'الفيز', true, true),
    (agency_uuid, 'Transport', 'النقل', true, true),
    (agency_uuid, 'Saudi Fees', 'السعودية', true, true),
    (agency_uuid, 'Khalidiya', 'الخليدية', true, true),
    (agency_uuid, 'Miscellaneous', 'المصاريف', true, true)
  ON CONFLICT (agency_id, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trigger_initialize_default_expense_categories()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM initialize_default_expense_categories(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_agency_created_initialize_categories ON agencies;
CREATE TRIGGER on_agency_created_initialize_categories
  AFTER INSERT ON agencies
  FOR EACH ROW
  EXECUTE FUNCTION trigger_initialize_default_expense_categories();

CREATE OR REPLACE FUNCTION update_flight_inventory_on_allocation()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE flight_seat_inventory
    SET seats_sold = seats_sold + NEW.seats_allocated,
        updated_at = now()
    WHERE id = NEW.flight_seat_inventory_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE flight_seat_inventory
    SET seats_sold = seats_sold - OLD.seats_allocated,
        updated_at = now()
    WHERE id = OLD.flight_seat_inventory_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_flight_inventory ON booking_flight_allocations;
CREATE TRIGGER trigger_update_flight_inventory
AFTER INSERT OR DELETE ON booking_flight_allocations
FOR EACH ROW EXECUTE FUNCTION update_flight_inventory_on_allocation();

CREATE OR REPLACE FUNCTION update_bed_inventory_on_allocation()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE hotel_bed_inventory
    SET beds_sold = beds_sold + NEW.beds_allocated,
        updated_at = now()
    WHERE id = NEW.hotel_bed_inventory_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE hotel_bed_inventory
    SET beds_sold = beds_sold - OLD.beds_allocated,
        updated_at = now()
    WHERE id = OLD.hotel_bed_inventory_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_bed_inventory ON booking_bed_allocations;
CREATE TRIGGER trigger_update_bed_inventory
AFTER INSERT OR DELETE ON booking_bed_allocations
FOR EACH ROW EXECUTE FUNCTION update_bed_inventory_on_allocation();

CREATE OR REPLACE FUNCTION get_beds_per_room(room_type_name TEXT)
RETURNS INTEGER AS $$
BEGIN
  CASE room_type_name
    WHEN 'double' THEN RETURN 2;
    WHEN 'triple' THEN RETURN 3;
    WHEN 'quad' THEN RETURN 4;
    WHEN 'quint' THEN RETURN 5;
    ELSE RETURN 2;
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION update_room_type_capacity_on_inventory()
RETURNS TRIGGER AS $$
DECLARE
  room_type_record RECORD;
  total_beds_in_inventory INTEGER;
  beds_per_room INTEGER;
  calculated_rooms INTEGER;
BEGIN
  SELECT id, type INTO room_type_record
  FROM room_types
  WHERE id = COALESCE(NEW.room_type_id, OLD.room_type_id);

  IF room_type_record IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE(SUM(beds_purchased), 0) INTO total_beds_in_inventory
  FROM hotel_bed_inventory
  WHERE room_type_id = room_type_record.id;

  beds_per_room := get_beds_per_room(room_type_record.type);
  calculated_rooms := CEIL(total_beds_in_inventory::NUMERIC / beds_per_room);

  UPDATE room_types
  SET total_beds = total_beds_in_inventory,
      total_rooms = calculated_rooms
  WHERE id = room_type_record.id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_room_type_capacity ON hotel_bed_inventory;
CREATE TRIGGER trigger_update_room_type_capacity
AFTER INSERT OR UPDATE OR DELETE ON hotel_bed_inventory
FOR EACH ROW EXECUTE FUNCTION update_room_type_capacity_on_inventory();

CREATE OR REPLACE FUNCTION update_security_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_security_settings_updated_at ON user_security_settings;
CREATE TRIGGER trigger_update_security_settings_updated_at
BEFORE UPDATE ON user_security_settings
FOR EACH ROW EXECUTE FUNCTION update_security_settings_updated_at();

CREATE OR REPLACE FUNCTION update_handover_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_handover_timestamp ON financial_handovers;
CREATE TRIGGER trigger_update_handover_timestamp
BEFORE UPDATE ON financial_handovers
FOR EACH ROW EXECUTE FUNCTION update_handover_updated_at();

CREATE OR REPLACE FUNCTION log_handover_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO financial_handover_status_history (handover_id, old_status, new_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, NULL);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_log_handover_status ON financial_handovers;
CREATE TRIGGER trigger_log_handover_status
AFTER UPDATE ON financial_handovers
FOR EACH ROW EXECUTE FUNCTION log_handover_status_change();

CREATE OR REPLACE FUNCTION generate_handover_number(p_agency_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_year TEXT;
  v_sequence INTEGER;
  v_handover_number TEXT;
BEGIN
  v_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;

  SELECT COALESCE(MAX(
    NULLIF(REGEXP_REPLACE(
      COALESCE(notes, ''),
      '^.*HO-' || v_year || '-(\d+).*$',
      '\1'
    ), '')::INTEGER
  ), 0) + 1
  INTO v_sequence
  FROM financial_handovers
  WHERE agency_id = p_agency_id
    AND created_at >= (v_year || '-01-01')::DATE;

  v_handover_number := 'HO-' || v_year || '-' || LPAD(v_sequence::TEXT, 4, '0');

  RETURN v_handover_number;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION ensure_single_headquarters()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_headquarters = true THEN
    UPDATE branches
    SET is_headquarters = false
    WHERE agency_id = NEW.agency_id
      AND id != NEW.id
      AND is_headquarters = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ensure_single_headquarters ON branches;
CREATE TRIGGER trigger_ensure_single_headquarters
BEFORE INSERT OR UPDATE ON branches
FOR EACH ROW
EXECUTE FUNCTION ensure_single_headquarters();

CREATE OR REPLACE FUNCTION auto_set_headquarters()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM branches
    WHERE agency_id = NEW.agency_id
      AND is_headquarters = true
  ) THEN
    NEW.is_headquarters := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_set_headquarters ON branches;
CREATE TRIGGER trigger_auto_set_headquarters
BEFORE INSERT ON branches
FOR EACH ROW
EXECUTE FUNCTION auto_set_headquarters();

CREATE OR REPLACE FUNCTION update_branches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_branches_updated_at ON branches;
CREATE TRIGGER trigger_branches_updated_at
BEFORE UPDATE ON branches
FOR EACH ROW
EXECUTE FUNCTION update_branches_updated_at();

CREATE OR REPLACE FUNCTION get_branch_stats(p_branch_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_users', (SELECT COUNT(*) FROM users WHERE branch_id = p_branch_id),
    'total_bookings', (SELECT COUNT(*) FROM bookings WHERE branch_id = p_branch_id),
    'total_clients', (SELECT COUNT(*) FROM clients WHERE branch_id = p_branch_id)
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cleanup_expired_booking_locks()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM booking_locks
  WHERE expires_at < now();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_active_bed_locks(
  p_accommodation_id UUID,
  p_room_type_id UUID,
  p_season_id UUID,
  p_exclude_session_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  user_name TEXT,
  user_email TEXT,
  quantity INTEGER,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  session_id TEXT
) AS $$
BEGIN
  PERFORM cleanup_expired_booking_locks();

  RETURN QUERY
  SELECT
    bl.id,
    bl.user_id,
    bl.user_name,
    bl.user_email,
    bl.quantity,
    bl.expires_at,
    bl.created_at,
    bl.session_id
  FROM booking_locks bl
  WHERE bl.resource_type = 'bed'
    AND bl.accommodation_id = p_accommodation_id
    AND bl.room_type_id = p_room_type_id
    AND bl.season_id = p_season_id
    AND bl.expires_at > now()
    AND (p_exclude_session_id IS NULL OR bl.session_id != p_exclude_session_id);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_active_flight_locks(
  p_flight_id UUID,
  p_season_id UUID,
  p_exclude_session_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  user_name TEXT,
  user_email TEXT,
  quantity INTEGER,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  session_id TEXT
) AS $$
BEGIN
  PERFORM cleanup_expired_booking_locks();

  RETURN QUERY
  SELECT
    bl.id,
    bl.user_id,
    bl.user_name,
    bl.user_email,
    bl.quantity,
    bl.expires_at,
    bl.created_at,
    bl.session_id
  FROM booking_locks bl
  WHERE bl.resource_type = 'flight_seat'
    AND bl.flight_id = p_flight_id
    AND bl.season_id = p_season_id
    AND bl.expires_at > now()
    AND (p_exclude_session_id IS NULL OR bl.session_id != p_exclude_session_id);
END;
$$ LANGUAGE plpgsql;

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

CREATE OR REPLACE FUNCTION reset_discount_usage_counts()
RETURNS INTEGER AS $$
DECLARE
  reset_count INTEGER := 0;
  tmp_count INTEGER := 0;
BEGIN
  UPDATE user_discount_permissions
  SET usage_count = 0, last_reset_at = now()
  WHERE reset_period = 'daily'
    AND last_reset_at < CURRENT_DATE;
  GET DIAGNOSTICS tmp_count = ROW_COUNT;
  reset_count := reset_count + tmp_count;

  UPDATE user_discount_permissions
  SET usage_count = 0, last_reset_at = now()
  WHERE reset_period = 'weekly'
    AND last_reset_at < date_trunc('week', CURRENT_DATE);
  GET DIAGNOSTICS tmp_count = ROW_COUNT;
  reset_count := reset_count + tmp_count;

  UPDATE user_discount_permissions
  SET usage_count = 0, last_reset_at = now()
  WHERE reset_period = 'monthly'
    AND last_reset_at < date_trunc('month', CURRENT_DATE);
  GET DIAGNOSTICS tmp_count = ROW_COUNT;
  reset_count := reset_count + tmp_count;

  RETURN reset_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION can_user_use_discount(
  p_user_id UUID,
  p_discount_setting_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_is_default BOOLEAN;
  v_permission RECORD;
BEGIN
  PERFORM reset_discount_usage_counts();

  SELECT is_default INTO v_is_default
  FROM discount_settings
  WHERE id = p_discount_setting_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_is_default THEN
    RETURN true;
  END IF;

  SELECT * INTO v_permission
  FROM user_discount_permissions
  WHERE user_id = p_user_id
    AND discount_setting_id = p_discount_setting_id
    AND is_active = true;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_permission.usage_limit IS NULL THEN
    RETURN true;
  END IF;

  RETURN v_permission.usage_count < v_permission.usage_limit;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_discount_usage(
  p_user_id UUID,
  p_discount_setting_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_is_default BOOLEAN;
BEGIN
  SELECT is_default INTO v_is_default
  FROM discount_settings
  WHERE id = p_discount_setting_id;

  IF NOT v_is_default THEN
    UPDATE user_discount_permissions
    SET usage_count = usage_count + 1, updated_at = now()
    WHERE user_id = p_user_id
      AND discount_setting_id = p_discount_setting_id;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION calculate_discount_amount(
  p_discount_setting_id UUID,
  p_booking_total NUMERIC
)
RETURNS NUMERIC AS $$
DECLARE
  v_discount RECORD;
  v_amount NUMERIC;
BEGIN
  SELECT * INTO v_discount
  FROM discount_settings
  WHERE id = p_discount_setting_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  IF v_discount.min_booking_amount IS NOT NULL AND p_booking_total < v_discount.min_booking_amount THEN
    RETURN 0;
  END IF;

  IF v_discount.discount_type = 'fixed' THEN
    v_amount := v_discount.discount_value;
  ELSE
    v_amount := p_booking_total * (v_discount.discount_value / 100);

    IF v_discount.max_discount_amount IS NOT NULL AND v_amount > v_discount.max_discount_amount THEN
      v_amount := v_discount.max_discount_amount;
    END IF;
  END IF;

  IF v_amount > p_booking_total THEN
    v_amount := p_booking_total;
  END IF;

  RETURN ROUND(v_amount, 2);
END;
$$ LANGUAGE plpgsql;

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

CREATE OR REPLACE FUNCTION expire_booking_holds()
RETURNS TABLE (
  expired_count INTEGER,
  expired_bookings TEXT[]
) AS $$
DECLARE
  v_expired_count INTEGER := 0;
  v_expired_bookings TEXT[] := ARRAY[]::TEXT[];
  v_booking RECORD;
BEGIN
  FOR v_booking IN
    SELECT id, booking_number
    FROM bookings
    WHERE status = 'draft'
      AND hold_expires_at IS NOT NULL
      AND hold_expires_at < NOW()
  LOOP
    UPDATE bookings
    SET status = 'expired',
        updated_at = NOW()
    WHERE id = v_booking.id;

    DELETE FROM booking_locks WHERE booking_id = v_booking.id;

    v_expired_count := v_expired_count + 1;
    v_expired_bookings := array_append(v_expired_bookings, v_booking.booking_number);
  END LOOP;

  PERFORM cleanup_expired_booking_locks();

  RETURN QUERY SELECT v_expired_count, v_expired_bookings;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION create_booking_hold_lock(
  p_booking_id UUID,
  p_agency_id UUID,
  p_user_id UUID,
  p_session_id TEXT,
  p_accommodation_id UUID DEFAULT NULL,
  p_room_type_id UUID DEFAULT NULL,
  p_flight_id UUID DEFAULT NULL,
  p_season_id UUID DEFAULT NULL,
  p_quantity INTEGER DEFAULT 1,
  p_hold_hours INTEGER DEFAULT 24
)
RETURNS booking_locks AS $$
DECLARE
  v_lock booking_locks;
  v_expires_at TIMESTAMPTZ;
  v_user_name TEXT;
  v_user_email TEXT;
BEGIN
  v_expires_at := NOW() + (p_hold_hours || ' hours')::INTERVAL;

  SELECT full_name, email INTO v_user_name, v_user_email
  FROM users WHERE id = p_user_id;

  IF p_accommodation_id IS NOT NULL AND p_room_type_id IS NOT NULL THEN
    INSERT INTO booking_locks (
      agency_id, user_id, booking_id, resource_type,
      accommodation_id, room_type_id, season_id,
      quantity, session_id, expires_at,
      user_name, user_email
    ) VALUES (
      p_agency_id, p_user_id, p_booking_id, 'bed',
      p_accommodation_id, p_room_type_id, p_season_id,
      p_quantity, p_session_id, v_expires_at,
      v_user_name, v_user_email
    ) RETURNING * INTO v_lock;
  END IF;

  IF p_flight_id IS NOT NULL THEN
    INSERT INTO booking_locks (
      agency_id, user_id, booking_id, resource_type,
      flight_id, season_id,
      quantity, session_id, expires_at,
      user_name, user_email
    ) VALUES (
      p_agency_id, p_user_id, p_booking_id, 'flight_seat',
      p_flight_id, p_season_id,
      p_quantity, p_session_id, v_expires_at,
      v_user_name, v_user_email
    ) RETURNING * INTO v_lock;
  END IF;

  RETURN v_lock;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION release_booking_hold_locks(p_booking_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM booking_locks
  WHERE booking_id = p_booking_id;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION extend_booking_hold(
  p_booking_id UUID,
  p_extend_hours INTEGER DEFAULT 24
)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  v_new_expires_at TIMESTAMPTZ;
BEGIN
  v_new_expires_at := NOW() + (p_extend_hours || ' hours')::INTERVAL;

  UPDATE bookings
  SET hold_expires_at = v_new_expires_at,
      updated_at = NOW()
  WHERE id = p_booking_id
    AND status = 'draft';

  UPDATE booking_locks
  SET expires_at = v_new_expires_at
  WHERE booking_id = p_booking_id;

  RETURN v_new_expires_at;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Comments (selected)
-- =============================================================================

COMMENT ON COLUMN bookings.deleted_at IS 'Timestamp when the booking was soft deleted';
COMMENT ON COLUMN bookings.deleted_by IS 'User ID who performed the soft delete';
COMMENT ON COLUMN bookings.deletion_reason IS 'Optional reason for deleting the booking';
COMMENT ON COLUMN bookings.hold_expires_at IS 'When the 24-hour hold expires for draft bookings';
COMMENT ON COLUMN bookings.hold_session_id IS 'Session ID linking booking to its resource locks';
COMMENT ON COLUMN bookings.flight_seat_inventory_id IS 'Specific flight inventory batch selected for this booking';
COMMENT ON COLUMN bookings.hotel_inventory_ids IS 'Array of hotel_bed_inventory IDs when booking spans multiple hotels/periods';
COMMENT ON COLUMN bookings.same_selection_for_all IS 'If true, all pilgrims share same flight/accommodation';
COMMENT ON TABLE user_security_settings IS 'Stores user security settings like deletion password';
COMMENT ON COLUMN user_security_settings.deletion_password_hash IS 'Bcrypt hash of the deletion password';
COMMENT ON COLUMN booking_locks.booking_id IS 'Link to the booking this lock belongs to (for 24h holds)';
COMMENT ON COLUMN flight_seat_inventory.seat_class IS 'Seat class: economy, business, or first_class';
COMMENT ON COLUMN pilgrims.flight_seat_inventory_id IS 'Specific flight inventory/seat class for this pilgrim';
COMMENT ON COLUMN pilgrims.hotel_inventory_ids IS 'Array of hotel_bed_inventory IDs for this pilgrim';
COMMENT ON COLUMN pilgrims.photo_url IS 'Profile photo URL for display in inventory maps';
COMMENT ON COLUMN pilgrims.passport_scan_url IS 'Optional URL of uploaded passport scan';
COMMENT ON TABLE sent_messages IS 'Log of SMS (and future channels) sent to clients/pilgrims';
COMMENT ON TABLE message_templates IS 'Templates with placeholders: {{client_name}}, {{booking_number}}, {{total}}, {{remaining}}, {{paid}}, {{pilgrim_name}}';
COMMENT ON FUNCTION expire_booking_holds() IS 'Expires draft bookings whose hold has passed';
COMMENT ON FUNCTION create_booking_hold_lock IS 'Creates a 24-hour lock on beds/flights for a draft booking';
COMMENT ON FUNCTION release_booking_hold_locks IS 'Releases all locks for a booking (called on confirm)';
COMMENT ON FUNCTION extend_booking_hold IS 'Extends the hold period for a draft booking';

-- Platform branding, packages, email, LLM, and billing are applied from
-- db/app_management.sql (init migration + 20260816000000_app_management).
