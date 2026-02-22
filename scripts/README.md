# Database Scripts

## reset-and-seed.sql

Resets all booking and inventory data, then seeds fresh sample data.

### What it does

**Deletes:**
- All booking allocations (beds, flights)
- All booking locks
- All room assignments
- All invoice items and payments
- All pilgrims linked to bookings
- All bookings
- All hotel bed inventory
- All flight seat inventory
- All clients

**Preserves:**
- Agencies
- Users
- Extra services
- Expense categories
- Discount settings
- Message templates

**Seeds:**
- 1 season: Summer Holiday (عطلة صيفية) – Omra
- 2 flights: AT-350 (RAM), CMN-SV (Saudia)
- 1 accommodation: Aswaf (أسواف) in Madinah
- Room types: Double, Triple, Quad
- Flight seat inventory for both flights
- Hotel bed inventory for double rooms

### How to run

1. Open **Supabase Dashboard** → **SQL Editor**
2. Copy the contents of `reset-and-seed.sql`
3. Paste and click **Run**

Or with Supabase CLI:

```bash
psql $DATABASE_URL -f scripts/reset-and-seed.sql
```

### Notes

- Uses the first agency in your database. If you have multiple agencies, modify the script to target a specific one.
- Seed data (dates, prices, names) can be edited in the script before running.
