-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Agencies (tenants)
CREATE TABLE agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  country TEXT,
  status TEXT DEFAULT 'active',
  subscription_plan TEXT DEFAULT 'free',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Users (extends auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  full_name TEXT,
  role TEXT CHECK (role IN ('super_admin','agency_admin','manager','agent')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seasons
CREATE TABLE seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('hajj','omra','ramadan')),
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Flights
CREATE TABLE flights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  season_id UUID REFERENCES seasons(id) ON DELETE CASCADE,
  code TEXT NOT NULL,              -- "A3", "AT-SV", "CMN-SV"
  departure_city TEXT,             -- "AT" (Agadir), "CMN" (Casablanca)
  arrival_city TEXT DEFAULT 'SV',  -- "SV" (Saudi)
  departure_date DATE NOT NULL,
  return_date DATE NOT NULL,
  carrier TEXT,                    -- Airline name
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Accommodations
CREATE TABLE accommodations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  season_id UUID REFERENCES seasons(id) ON DELETE CASCADE,
  name TEXT NOT NULL,              -- "سلسبيل حمودة", "التيسيير"
  name_ar TEXT,                    -- Arabic name
  city TEXT,                       -- "makkah", "madinah"
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Room Types
CREATE TABLE room_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accommodation_id UUID REFERENCES accommodations(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('double','triple','quad','quint')),
  total_rooms INTEGER NOT NULL DEFAULT 0,
  total_beds INTEGER NOT NULL DEFAULT 0,
  price_per_bed NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Packages
CREATE TABLE packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  season_id UUID REFERENCES seasons(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  accommodation_id UUID REFERENCES accommodations(id),
  room_type TEXT,
  includes_visa BOOLEAN DEFAULT true,
  includes_transport BOOLEAN DEFAULT true,
  price NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Pilgrims
CREATE TABLE pilgrims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  season_id UUID REFERENCES seasons(id),
  flight_id UUID REFERENCES flights(id),
  accommodation_id UUID REFERENCES accommodations(id),
  room_type_id UUID REFERENCES room_types(id),
  package_id UUID REFERENCES packages(id),
  
  -- Personal info
  full_name TEXT NOT NULL,
  full_name_ar TEXT,               -- Arabic name
  passport_number TEXT,
  phone TEXT,
  
  -- Payment tracking
  agreed_price NUMERIC(10,2) DEFAULT 0,      -- المتفق عليه
  advance_payment NUMERIC(10,2) DEFAULT 0,   -- المقدم
  -- remaining_balance is calculated column in newer Postgres, using trigger or view here for compatibility if needed, 
  -- but plan specified GENERATED ALWAYS. Assuming Postgres 12+:
  remaining_balance NUMERIC(10,2) GENERATED ALWAYS AS (agreed_price - advance_payment) STORED,
  
  -- Visa & transport
  visa_included BOOLEAN DEFAULT true,
  transport_included BOOLEAN DEFAULT true,
  
  status TEXT DEFAULT 'pending',   -- pending, confirmed, cancelled
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Expenses
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  season_id UUID REFERENCES seasons(id) ON DELETE CASCADE,
  
  category TEXT CHECK (category IN (
    'hotels',      -- الفنادق
    'visas',       -- الفيز
    'transport',   -- النقل
    'saudi_fees',  -- السعودية
    'khalidiya',   -- الخليدية
    'misc'         -- المصاريف
  )),
  description TEXT,
  amount NUMERIC(12,2) NOT NULL,
  paid_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);
