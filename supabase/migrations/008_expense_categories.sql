-- =============================================
-- Migration 008: Enhanced Expenses Management
-- =============================================

-- Expense Categories (default + custom categories created by agencies)
CREATE TABLE IF NOT EXISTS expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_ar TEXT,
  description TEXT,
  is_default BOOLEAN DEFAULT false,  -- Mark default categories
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(agency_id, name)
);

-- Add is_default column if table exists but column doesn't
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'expense_categories') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expense_categories' AND column_name = 'is_default') THEN
      ALTER TABLE expense_categories ADD COLUMN is_default BOOLEAN DEFAULT false;
    END IF;
  END IF;
END $$;

-- Function to initialize default categories for an agency
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

-- Trigger to automatically initialize default categories when a new agency is created
CREATE OR REPLACE FUNCTION trigger_initialize_default_expense_categories()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM initialize_default_expense_categories(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists before creating
DROP TRIGGER IF EXISTS on_agency_created_initialize_categories ON agencies;

CREATE TRIGGER on_agency_created_initialize_categories
  AFTER INSERT ON agencies
  FOR EACH ROW
  EXECUTE FUNCTION trigger_initialize_default_expense_categories();

-- Add new columns to expenses table (only if expenses table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'expenses') THEN
    -- Add expense_type column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'expense_type') THEN
      ALTER TABLE expenses ADD COLUMN expense_type TEXT CHECK (expense_type IN ('simple', 'prepayment')) DEFAULT 'simple';
    END IF;
    
    -- Add category_id column (with foreign key only if expense_categories exists)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'category_id') THEN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'expense_categories') THEN
        ALTER TABLE expenses ADD COLUMN category_id UUID REFERENCES expense_categories(id) ON DELETE SET NULL;
      ELSE
        ALTER TABLE expenses ADD COLUMN category_id UUID;
      END IF;
    END IF;
    
    -- Add prepayment-related columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'linked_resource_type') THEN
      ALTER TABLE expenses ADD COLUMN linked_resource_type TEXT CHECK (linked_resource_type IN ('accommodation', 'flight'));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'linked_resource_id') THEN
      ALTER TABLE expenses ADD COLUMN linked_resource_id UUID;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'total_quantity') THEN
      ALTER TABLE expenses ADD COLUMN total_quantity NUMERIC(10,2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'used_quantity') THEN
      ALTER TABLE expenses ADD COLUMN used_quantity NUMERIC(10,2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'unit_cost') THEN
      ALTER TABLE expenses ADD COLUMN unit_cost NUMERIC(12,2);
    END IF;
  END IF;
END $$;

-- Add computed column for remaining quantity
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'expenses') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'remaining_quantity') THEN
      ALTER TABLE expenses
        ADD COLUMN remaining_quantity NUMERIC(10,2) GENERATED ALWAYS AS (
          CASE 
            WHEN expense_type = 'prepayment' THEN (total_quantity - COALESCE(used_quantity, 0))
            ELSE NULL
          END
        ) STORED;
    END IF;
  END IF;
END $$;

-- Track which bookings used which prepayment expenses
CREATE TABLE IF NOT EXISTS expense_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  quantity NUMERIC(10,2) NOT NULL,  -- How many units allocated (rooms, seats)
  allocated_at TIMESTAMPTZ DEFAULT now(),
  allocated_by UUID REFERENCES users(id),
  notes TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_expense_categories_agency ON expense_categories(agency_id);
CREATE INDEX IF NOT EXISTS idx_expenses_category_id ON expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_linked_resource ON expenses(linked_resource_type, linked_resource_id);
CREATE INDEX IF NOT EXISTS idx_expense_allocations_expense ON expense_allocations(expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_allocations_booking ON expense_allocations(booking_id);

-- RLS Policies for expense_categories
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist before creating
DROP POLICY IF EXISTS "Users can view expense categories in their agency" ON expense_categories;
DROP POLICY IF EXISTS "Admins can manage expense categories in their agency" ON expense_categories;

CREATE POLICY "Users can view expense categories in their agency"
  ON expense_categories FOR SELECT
  USING (agency_id IN (
    SELECT agency_id FROM users WHERE id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'
  ));

CREATE POLICY "Admins can manage expense categories in their agency"
  ON expense_categories FOR ALL
  USING (
    agency_id IN (
      SELECT agency_id FROM users WHERE id = auth.uid() AND role IN ('agency_admin', 'super_admin')
    ) OR EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- RLS Policies for expense_allocations
ALTER TABLE expense_allocations ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist before creating
DROP POLICY IF EXISTS "Users can view expense allocations in their agency" ON expense_allocations;
DROP POLICY IF EXISTS "Admins can manage expense allocations in their agency" ON expense_allocations;

CREATE POLICY "Users can view expense allocations in their agency"
  ON expense_allocations FOR SELECT
  USING (
    expense_id IN (
      SELECT id FROM expenses WHERE agency_id IN (
        SELECT agency_id FROM users WHERE id = auth.uid()
      )
    ) OR EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY "Admins can manage expense allocations in their agency"
  ON expense_allocations FOR ALL
  USING (
    expense_id IN (
      SELECT id FROM expenses WHERE agency_id IN (
        SELECT agency_id FROM users WHERE id = auth.uid() AND role IN ('agency_admin', 'super_admin')
      )
    ) OR EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Initialize default categories for all existing agencies (only if function exists)
DO $$
DECLARE
  agency_record RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'initialize_default_expense_categories') THEN
    FOR agency_record IN SELECT id FROM agencies LOOP
      PERFORM initialize_default_expense_categories(agency_record.id);
    END LOOP;
  END IF;
END $$;

-- Update expense_summary view to include agency_id
-- Drop existing view first to allow column changes
DROP VIEW IF EXISTS expense_summary;

CREATE OR REPLACE VIEW expense_summary AS
SELECT 
  agency_id,
  season_id,
  category,
  SUM(amount) as total_amount
FROM expenses
GROUP BY agency_id, season_id, category;
