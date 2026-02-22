-- Migration 007: Notification Settings Tables (Email & SMS)
-- Stores email/SMTP and SMS provider configurations per agency

-- Email/SMTP Settings per agency
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

-- SMS Settings per agency
CREATE TABLE IF NOT EXISTS sms_settings (
  agency_id UUID PRIMARY KEY REFERENCES agencies(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('twilio', 'custom')),
  -- Twilio fields
  account_sid_encrypted TEXT,
  auth_token_encrypted TEXT,
  from_number TEXT,
  -- Custom API fields
  api_url TEXT,
  api_key_encrypted TEXT,
  api_secret_encrypted TEXT,
  enabled BOOLEAN DEFAULT true,
  last_tested_at TIMESTAMPTZ,
  test_status TEXT CHECK (test_status IN ('success', 'failed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE email_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Agency admins can manage own email settings
CREATE POLICY "Agency can manage own email settings" ON email_settings
FOR ALL USING (
  agency_id = (auth.jwt() ->> 'agency_id')::uuid
  AND (auth.jwt() ->> 'role') IN ('agency_admin', 'super_admin')
);

-- Policy: Agency admins can manage own SMS settings
CREATE POLICY "Agency can manage own SMS settings" ON sms_settings
FOR ALL USING (
  agency_id = (auth.jwt() ->> 'agency_id')::uuid
  AND (auth.jwt() ->> 'role') IN ('agency_admin', 'super_admin')
);
