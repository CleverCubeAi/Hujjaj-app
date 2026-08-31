-- =============================================================================
-- App management: platform branding, packages, email, LLM, billing
-- Idempotent — safe on fresh installs (after schema.sql) and existing databases.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Subscription packages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscription_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name_ar TEXT NOT NULL,
  name_fr TEXT NOT NULL,
  description_ar TEXT,
  description_fr TEXT,
  price_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'MAD',
  billing_period TEXT NOT NULL DEFAULT 'monthly'
    CHECK (billing_period IN ('monthly','yearly','once')),
  trial_days INT NOT NULL DEFAULT 0,
  is_public BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  features JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS subscription_packages_one_default
  ON subscription_packages ((true)) WHERE is_default;

-- ---------------------------------------------------------------------------
-- Agency brand + subscription columns
-- ---------------------------------------------------------------------------
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS name_ar TEXT;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS legal_name TEXT;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS invoice_logo_url TEXT;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS primary_color TEXT;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS invoice_footer TEXT;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS hide_platform_mark BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS package_id UUID REFERENCES subscription_packages(id);
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS subscription_starts_at TIMESTAMPTZ;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS subscription_renews_at TIMESTAMPTZ;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS billing_email TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agencies_subscription_status_check'
  ) THEN
    ALTER TABLE agencies
      ADD CONSTRAINT agencies_subscription_status_check
      CHECK (subscription_status IN ('trialing','active','past_due','cancelled'));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Platform branding (singleton)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS platform_branding (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  app_name TEXT NOT NULL DEFAULT 'Hujjaj',
  app_name_ar TEXT NOT NULL DEFAULT 'حجاج',
  app_name_fr TEXT NOT NULL DEFAULT 'Hujjaj',
  tagline_ar TEXT,
  tagline_fr TEXT,
  logo_url TEXT,
  logo_mark_url TEXT,
  favicon_url TEXT,
  login_background_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#8B7355',
  accent_color TEXT NOT NULL DEFAULT '#6F5C45',
  support_email TEXT,
  support_phone TEXT,
  default_locale TEXT NOT NULL DEFAULT 'ar' CHECK (default_locale IN ('ar','fr')),
  legal_name TEXT,
  copyright TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES users(id)
);

INSERT INTO platform_branding (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Platform email (singleton)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS platform_email_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  provider TEXT NOT NULL DEFAULT 'custom' CHECK (provider IN ('gmail','outlook','yahoo','custom')),
  host TEXT,
  port INTEGER,
  secure BOOLEAN DEFAULT false,
  username TEXT,
  password_encrypted TEXT,
  from_email TEXT,
  from_name TEXT,
  enabled BOOLEAN NOT NULL DEFAULT false,
  last_tested_at TIMESTAMPTZ,
  test_status TEXT CHECK (test_status IN ('success','failed')),
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES users(id)
);

INSERT INTO platform_email_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Platform LLM
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS platform_llm_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled BOOLEAN NOT NULL DEFAULT false,
  provider TEXT NOT NULL DEFAULT 'openai'
    CHECK (provider IN ('openai','anthropic','azure_openai','google','custom')),
  api_key_encrypted TEXT,
  base_url TEXT,
  api_version TEXT,
  default_model TEXT NOT NULL DEFAULT 'gpt-4.1-mini',
  timeout_ms INT NOT NULL DEFAULT 30000,
  max_tokens INT NOT NULL DEFAULT 1024,
  monthly_budget_usd NUMERIC(12,4),
  budget_alert_email TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES users(id)
);

INSERT INTO platform_llm_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS platform_llm_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) ON DELETE SET NULL,
  feature TEXT NOT NULL DEFAULT 'test',
  model TEXT,
  input_tokens INT NOT NULL DEFAULT 0,
  output_tokens INT NOT NULL DEFAULT 0,
  cost_usd NUMERIC(12,6) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_llm_usage_created_at_idx ON platform_llm_usage (created_at);
CREATE INDEX IF NOT EXISTS platform_llm_usage_agency_id_idx ON platform_llm_usage (agency_id);

-- ---------------------------------------------------------------------------
-- Payment gateways
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS platform_payment_gateways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL UNIQUE CHECK (provider IN ('stripe','cmi','manual')),
  enabled BOOLEAN NOT NULL DEFAULT false,
  public_key TEXT,
  secret_key_encrypted TEXT,
  webhook_secret_encrypted TEXT,
  sandbox BOOLEAN NOT NULL DEFAULT true,
  extra JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES users(id)
);

INSERT INTO platform_payment_gateways (provider, enabled, sandbox)
VALUES
  ('stripe', false, true),
  ('cmi', false, true),
  ('manual', true, false)
ON CONFLICT (provider) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Subscription invoices, events, counters
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS platform_counters (
  name TEXT PRIMARY KEY,
  value BIGINT NOT NULL DEFAULT 0
);

INSERT INTO platform_counters (name, value)
VALUES ('subscription_invoice', 0)
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS subscription_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES subscription_packages(id),
  number TEXT UNIQUE NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'MAD',
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('draft','open','paid','failed','void','refunded')),
  provider TEXT,
  provider_ref TEXT,
  paid_at TIMESTAMPTZ,
  hosted_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscription_invoices_agency_id_idx ON subscription_invoices (agency_id);
CREATE INDEX IF NOT EXISTS subscription_invoices_status_idx ON subscription_invoices (status);
CREATE UNIQUE INDEX IF NOT EXISTS subscription_invoices_provider_ref_uidx
  ON subscription_invoices (provider, provider_ref)
  WHERE provider_ref IS NOT NULL;

CREATE TABLE IF NOT EXISTS subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  package_id UUID REFERENCES subscription_packages(id),
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  source TEXT NOT NULL CHECK (source IN ('admin','checkout','webhook','system')),
  action TEXT NOT NULL,
  note TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscription_events_agency_id_idx ON subscription_events (agency_id);

-- ---------------------------------------------------------------------------
-- Seed packages (today's labels)
-- ---------------------------------------------------------------------------
INSERT INTO subscription_packages (
  id, slug, name_ar, name_fr, description_ar, description_fr,
  price_amount, currency, billing_period, trial_days,
  is_public, is_default, sort_order, features, is_active
) VALUES
(
  '11111111-1111-4111-8111-111111111111',
  'free', 'مجاني', 'Gratuit',
  'خطة أساسية للبدء', 'Plan de démarrage',
  0, 'MAD', 'monthly', 0, true, true, 0,
  '{"max_users":2,"max_branches":1,"max_seasons":2,"email":false,"sms":false,"white_label":false,"llm":false,"inventory":true,"reports":true,"discounts":true}'::jsonb,
  true
),
(
  '22222222-2222-4222-8222-222222222222',
  'basic', 'أساسي', 'Basique',
  'بريد إلكتروني وحدود أعلى', 'E-mail et limites plus élevées',
  499, 'MAD', 'monthly', 0, true, false, 1,
  '{"max_users":10,"max_branches":3,"max_seasons":6,"email":true,"sms":false,"white_label":false,"llm":false,"inventory":true,"reports":true,"discounts":true}'::jsonb,
  true
),
(
  '33333333-3333-4333-8333-333333333333',
  'premium', 'مميز', 'Premium',
  'حدود غير محدودة وتسمية بيضاء', 'Illimité et marque blanche',
  999, 'MAD', 'monthly', 0, true, false, 2,
  '{"max_users":null,"max_branches":null,"max_seasons":null,"email":true,"sms":true,"white_label":true,"llm":false,"inventory":true,"reports":true,"discounts":true}'::jsonb,
  true
)
ON CONFLICT (slug) DO NOTHING;

UPDATE agencies a
SET
  package_id = p.id,
  subscription_status = COALESCE(a.subscription_status, 'active'),
  subscription_starts_at = COALESCE(a.subscription_starts_at, a.created_at, now()),
  subscription_plan = p.slug
FROM subscription_packages p
WHERE a.package_id IS NULL
  AND p.slug = COALESCE(NULLIF(a.subscription_plan, ''), 'free');

UPDATE agencies a
SET
  package_id = p.id,
  subscription_plan = p.slug
FROM subscription_packages p
WHERE a.package_id IS NULL
  AND p.is_default = true;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  -- Super-admin-only singletons
  PERFORM 1;
END $$;

ALTER TABLE platform_branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_branding FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS platform_branding_read ON platform_branding;
DROP POLICY IF EXISTS platform_branding_write ON platform_branding;
CREATE POLICY platform_branding_read ON platform_branding FOR SELECT USING (true);
CREATE POLICY platform_branding_write ON platform_branding FOR ALL
  USING (current_setting('app.is_super_admin', true) = 'true')
  WITH CHECK (current_setting('app.is_super_admin', true) = 'true');

ALTER TABLE platform_email_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_email_settings FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS platform_email_admin ON platform_email_settings;
CREATE POLICY platform_email_admin ON platform_email_settings FOR ALL
  USING (current_setting('app.is_super_admin', true) = 'true')
  WITH CHECK (current_setting('app.is_super_admin', true) = 'true');

ALTER TABLE platform_llm_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_llm_settings FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS platform_llm_admin ON platform_llm_settings;
CREATE POLICY platform_llm_admin ON platform_llm_settings FOR ALL
  USING (current_setting('app.is_super_admin', true) = 'true')
  WITH CHECK (current_setting('app.is_super_admin', true) = 'true');

ALTER TABLE platform_llm_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_llm_usage FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS platform_llm_usage_admin ON platform_llm_usage;
CREATE POLICY platform_llm_usage_admin ON platform_llm_usage FOR ALL
  USING (current_setting('app.is_super_admin', true) = 'true')
  WITH CHECK (current_setting('app.is_super_admin', true) = 'true');

ALTER TABLE platform_payment_gateways ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_payment_gateways FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS platform_gateways_admin ON platform_payment_gateways;
CREATE POLICY platform_gateways_admin ON platform_payment_gateways FOR ALL
  USING (current_setting('app.is_super_admin', true) = 'true')
  WITH CHECK (current_setting('app.is_super_admin', true) = 'true');

ALTER TABLE platform_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_counters FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS platform_counters_admin ON platform_counters;
CREATE POLICY platform_counters_admin ON platform_counters FOR ALL
  USING (current_setting('app.is_super_admin', true) = 'true')
  WITH CHECK (current_setting('app.is_super_admin', true) = 'true');

ALTER TABLE subscription_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_packages FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS subscription_packages_read ON subscription_packages;
DROP POLICY IF EXISTS subscription_packages_write ON subscription_packages;
CREATE POLICY subscription_packages_read ON subscription_packages FOR SELECT USING (
  current_setting('app.is_super_admin', true) = 'true'
  OR (is_public AND is_active)
  OR id IN (
    SELECT package_id FROM agencies
    WHERE package_id IS NOT NULL
      AND id::text = NULLIF(current_setting('app.agency_id', true), '')
  )
);
CREATE POLICY subscription_packages_write ON subscription_packages FOR ALL
  USING (current_setting('app.is_super_admin', true) = 'true')
  WITH CHECK (current_setting('app.is_super_admin', true) = 'true');

ALTER TABLE subscription_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_invoices FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS subscription_invoices_tenant ON subscription_invoices;
CREATE POLICY subscription_invoices_tenant ON subscription_invoices FOR ALL
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR agency_id::text = NULLIF(current_setting('app.agency_id', true), '')
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR agency_id::text = NULLIF(current_setting('app.agency_id', true), '')
  );

ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS subscription_events_tenant ON subscription_events;
CREATE POLICY subscription_events_tenant ON subscription_events FOR ALL
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR agency_id::text = NULLIF(current_setting('app.agency_id', true), '')
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR agency_id::text = NULLIF(current_setting('app.agency_id', true), '')
  );

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'hujjaj_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO hujjaj_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO hujjaj_app;
  END IF;
END $$;
