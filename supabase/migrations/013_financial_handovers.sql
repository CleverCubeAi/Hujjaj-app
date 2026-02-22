-- =============================================
-- Migration 013: Financial Handovers System
-- =============================================
-- Tracks money transfers between agents and admin
-- with full approval workflow and audit trail

-- Financial Handovers - Main table for handover records
CREATE TABLE IF NOT EXISTS financial_handovers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Handover Type: sales_to_admin (agent gives money to admin) or expense_reimbursement (admin reimburses agent)
  handover_type TEXT NOT NULL CHECK (handover_type IN ('sales_to_admin', 'expense_reimbursement')),
  
  -- Amount and Date
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  handover_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Payment Method and Reference
  payment_method TEXT NOT NULL CHECK (payment_method IN ('wire', 'check', 'cash')),
  payment_reference TEXT, -- Wire number or check number (required for wire/check)
  
  -- Recipient - who receives the money/notification
  recipient_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Status workflow: sent -> pending -> received/refused/canceled
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'pending', 'received', 'refused', 'canceled')),
  
  -- Optional season link for filtering
  season_id UUID REFERENCES seasons(id) ON DELETE SET NULL,
  
  -- Notes
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Financial Handover Status History - Audit trail for status changes
CREATE TABLE IF NOT EXISTS financial_handover_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handover_id UUID NOT NULL REFERENCES financial_handovers(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  changed_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- Indexes for Performance
-- =============================================
CREATE INDEX IF NOT EXISTS idx_handovers_agency ON financial_handovers(agency_id);
CREATE INDEX IF NOT EXISTS idx_handovers_created_by ON financial_handovers(created_by);
CREATE INDEX IF NOT EXISTS idx_handovers_recipient ON financial_handovers(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_handovers_status ON financial_handovers(status);
CREATE INDEX IF NOT EXISTS idx_handovers_type ON financial_handovers(handover_type);
CREATE INDEX IF NOT EXISTS idx_handovers_date ON financial_handovers(handover_date);
CREATE INDEX IF NOT EXISTS idx_handovers_season ON financial_handovers(season_id);
CREATE INDEX IF NOT EXISTS idx_handover_history_handover ON financial_handover_status_history(handover_id);

-- =============================================
-- Trigger to update updated_at timestamp
-- =============================================
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

-- =============================================
-- Trigger to log status changes to history
-- =============================================
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

-- =============================================
-- Function to generate handover reference number
-- =============================================
CREATE OR REPLACE FUNCTION generate_handover_number(p_agency_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_year TEXT;
  v_sequence INTEGER;
  v_handover_number TEXT;
BEGIN
  v_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  
  -- Get next sequence number for this agency and year
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

-- =============================================
-- RLS Policies
-- =============================================
ALTER TABLE financial_handovers ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_handover_status_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view handovers in their agency" ON financial_handovers;
DROP POLICY IF EXISTS "Users can create handovers in their agency" ON financial_handovers;
DROP POLICY IF EXISTS "Admins can update handovers in their agency" ON financial_handovers;
DROP POLICY IF EXISTS "Users can view handover history in their agency" ON financial_handover_status_history;
DROP POLICY IF EXISTS "Admins can manage handover history" ON financial_handover_status_history;

-- Financial handovers policies
CREATE POLICY "Users can view handovers in their agency"
  ON financial_handovers FOR SELECT
  USING (agency_id IN (
    SELECT agency_id FROM users WHERE id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'
  ));

CREATE POLICY "Users can create handovers in their agency"
  ON financial_handovers FOR INSERT
  WITH CHECK (agency_id IN (
    SELECT agency_id FROM users WHERE id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'
  ));

CREATE POLICY "Admins can update handovers in their agency"
  ON financial_handovers FOR UPDATE
  USING (
    agency_id IN (
      SELECT agency_id FROM users WHERE id = auth.uid() AND role IN ('agency_admin', 'manager', 'super_admin')
    ) OR EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Status history policies
CREATE POLICY "Users can view handover history in their agency"
  ON financial_handover_status_history FOR SELECT
  USING (
    handover_id IN (
      SELECT id FROM financial_handovers WHERE agency_id IN (
        SELECT agency_id FROM users WHERE id = auth.uid()
      )
    ) OR EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY "Admins can manage handover history"
  ON financial_handover_status_history FOR ALL
  USING (
    handover_id IN (
      SELECT id FROM financial_handovers WHERE agency_id IN (
        SELECT agency_id FROM users WHERE id = auth.uid() AND role IN ('agency_admin', 'manager', 'super_admin')
      )
    ) OR EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- =============================================
-- View for handover summary
-- =============================================
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
