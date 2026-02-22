-- =============================================
-- Migration 019: Messages (Sent SMS log + Templates)
-- =============================================
-- Sent message history and message templates for SMS.

-- =============================================
-- message_templates: templates with placeholders (create first for FK)
-- =============================================
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

CREATE INDEX IF NOT EXISTS idx_message_templates_agency ON message_templates(agency_id);

-- =============================================
-- sent_messages: log every SMS sent
-- =============================================
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
  sent_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sent_messages_agency_created ON sent_messages(agency_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sent_messages_client ON sent_messages(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sent_messages_booking ON sent_messages(booking_id) WHERE booking_id IS NOT NULL;

-- =============================================
-- RLS
-- =============================================
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sent_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency can manage own message_templates" ON message_templates
FOR ALL USING (
  agency_id = (auth.jwt() ->> 'agency_id')::uuid
);

CREATE POLICY "Agency can manage own sent_messages" ON sent_messages
FOR ALL USING (
  agency_id = (auth.jwt() ->> 'agency_id')::uuid
);

-- =============================================
-- Comments
-- =============================================
COMMENT ON TABLE sent_messages IS 'Log of SMS (and future channels) sent to clients/pilgrims';
COMMENT ON TABLE message_templates IS 'Templates with placeholders: {{client_name}}, {{booking_number}}, {{total}}, {{remaining}}, {{paid}}, {{pilgrim_name}}';
