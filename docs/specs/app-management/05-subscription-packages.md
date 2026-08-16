# Spec 05 — Subscription packages

**Owner:** Super Admin  
**Phase:** 1  
**Used by:** agency create/edit, [02](./02-agency-white-labeling.md), [03](./03-llm-settings.md), [04](./04-email-services.md), [06](./06-payment-gateway.md)

## Goal

Replace the hardcoded `free` / `basic` / `premium` strings with **packages Super Admin can create, price, and feature-gate**. Assigning a package to an agency (manually or after payment) is what turns entitlements on.

## Current state

- `agencies.subscription_plan TEXT DEFAULT 'free'`
- Zod enum `AGENCY_PLANS = ['free','basic','premium']`
- Super Admin dropdown; agency cannot change it
- No prices, no limits, no feature flags, no expiry

## Model

```sql
subscription_packages (
  id UUID PK,
  slug TEXT UNIQUE NOT NULL,          -- stable key, e.g. 'free', 'pro'
  name_ar TEXT NOT NULL,
  name_fr TEXT NOT NULL,
  description_ar TEXT,
  description_fr TEXT,
  price_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'MAD',
  billing_period TEXT NOT NULL CHECK (billing_period IN ('monthly','yearly','once')),
  trial_days INT NOT NULL DEFAULT 0,
  is_public BOOLEAN NOT NULL DEFAULT true,   -- shown to agencies at checkout
  is_default BOOLEAN NOT NULL DEFAULT false, -- assigned on new agency
  sort_order INT NOT NULL DEFAULT 0,
  features JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,   -- cannot assign if false; existing subs keep working
  created_at, updated_at
);
```

Exactly one row may have `is_default = true` (partial unique index).

### `features` JSON (v1 keys)

All keys present; missing key = most restrictive default.

```json
{
  "max_users": 3,
  "max_branches": 1,
  "max_seasons": 2,
  "email": false,
  "sms": false,
  "white_label": false,
  "llm": false,
  "inventory": true,
  "reports": true,
  "discounts": true
}
```

- `null` on a `max_*` field = unlimited
- Booleans default **false** if omitted
- `inventory` / `reports` default **true** so today’s agencies do not lose the app on migrate

### Agency link

Replace string plan with a real FK, keep a denormalized slug for display during rollout:

```sql
ALTER TABLE agencies
  ADD COLUMN package_id UUID REFERENCES subscription_packages(id),
  ADD COLUMN subscription_status TEXT NOT NULL DEFAULT 'active'
    CHECK (subscription_status IN ('trialing','active','past_due','cancelled')),
  ADD COLUMN subscription_starts_at TIMESTAMPTZ,
  ADD COLUMN subscription_renews_at TIMESTAMPTZ,
  ADD COLUMN billing_email TEXT;
```

Keep `agencies.status` (`active` / `inactive` / `suspended`) as the **account** switch Super Admin already has.

- `status = suspended` → nobody in the agency can log in (already implemented)
- `subscription_status = past_due` → login allowed, writes to gated features blocked, banner shown
- `subscription_status = cancelled` and renew date passed → treat as `status = suspended` via job, or keep login with read-only — **v1: suspend login** after grace (7 days)

`subscription_plan` text column: migrate values to packages, then stop writing it. Drop in a later migration.

## Seed packages (match today’s labels)

| slug | Price | Period | Highlights |
|---|---|---|---|
| `free` | 0 | monthly | 2 users, 1 branch, no email/SMS/LLM/white_label, inventory+reports on |
| `basic` | Super Admin sets (e.g. 499 MAD) | monthly | Higher limits, email on, SMS off, no white_label, no LLM |
| `premium` | Super Admin sets (e.g. 999 MAD) | monthly | Unlimited users/branches, all flags true except LLM until they turn it on |

Prices in seed can be 0 until Super Admin edits them. `free` is default.

Existing agencies: map `subscription_plan` → package slug; set `package_id`, `subscription_status = 'active'`.

## Enforcement

Middleware `requireFeature('sms')` / `assertLimit('max_users')`:

- Resolve agency → `package_id` → `features`
- If package missing, behave as `free`
- Create user: if `count(users) >= max_users` → 400 `package_user_limit`
- Same for branches / seasons
- Feature off → 403 `package_feature_disabled`

Super Admin **manual assign** bypasses payment but still sets `package_id` and dates. Use this for comps and the current workflow.

## APIs

### Super Admin

- `GET /api/platform/packages`
- `POST /api/platform/packages`
- `PATCH /api/platform/packages/:id`
- `DELETE /api/platform/packages/:id` — 400 if any agency still references it; deactivate instead (`is_active=false`) is preferred
- `POST /api/platform/agencies/:id/subscription`  
  body: `{ package_id, subscription_status?, renews_at?, note? }`  
  writes a row to `subscription_events` (audit)

### Agency (read)

- `GET /api/settings/subscription`  
  `{ package, features, status, renews_at, can_self_serve }`  
  Agency admin only. No prices leak of other packages except public catalog when checkout exists (spec 06).

### Public catalog (phase 3, with payments)

- `GET /api/public/packages` — `is_public && is_active` rows, no internals

## UI

**Super Admin → Packages**

- Table: name, price, period, agencies using it, active
- Create/edit form: names AR/FR, price, currency, period, trial, default/public, feature toggles, numeric limits (empty = unlimited)
- Cannot delete the default package without assigning another default

**Super Admin → Agency detail** (replace the three-value select)

- Package dropdown (active packages)
- Subscription status + renew date
- Audit note when changing (“complimentary Q1”)

**Agency → Settings**

- Read-only card: current package, renew date, feature summary
- If payments are live (spec 06): “Change plan” / “Pay”

## `subscription_events` (audit)

```
id, agency_id, package_id, actor_user_id, source TEXT
  -- 'admin' | 'checkout' | 'webhook' | 'system'
action TEXT,  -- 'assigned' | 'renewed' | 'cancelled' | 'past_due' | 'reactivated'
note TEXT, metadata JSONB, created_at
```

## Acceptance

- Super Admin can add a package “Pro” at 790 MAD/month with `sms: true` and assign it to an agency; that agency can then use SMS settings send; a free agency cannot.
- Creating a 4th user on a 3-user package fails on the API, not only in the UI.
- Migrated demo agency on `premium` keeps access.
- Hardcoded `free|basic|premium` enum is gone from create-agency validation; it uses `package_id`.

## Out of scope

- Usage-based billing (per SMS)
- Per-seat pricing (flat package only in v1)
- Agency-built custom plans
- Proration math beyond “new period starts at `renews_at`” (see spec 06)
