# Spec 06 — Payment gateway (agency subscriptions)

**Owner:** Super Admin configures. Agencies pay.  
**Phase:** 3  
**Depends on:** [05-subscription-packages.md](./05-subscription-packages.md), [04-email-services.md](./04-email-services.md)

## Goal

Agencies pay the platform for their subscription package. Super Admin stores gateway credentials, sees payments, and can still assign a package by hand (no card).

This is **not** pilgrim booking payments (cash/transfer inside the agency app). Do not mix the two ledgers.

## Actors

| Actor | Action |
|---|---|
| Super Admin | Enable gateway(s), set public/secret keys, see all subscription invoices, refund/mark paid manually |
| Agency admin | Choose a public package, pay, download receipt |
| Manager/agent | No billing |

## Gateways (pluggable)

v1 supports **one active card gateway** plus **manual/bank**.

| Provider | Use |
|---|---|
| `stripe` | Cards, international. Default to implement first (best APIs/webhooks). |
| `cmi` | Moroccan CMI/PayZone-style redirect (second provider if Stripe is not enough for local cards). |
| `manual` | Super Admin marks paid after bank transfer. Always available. |

Config table (one row per provider):

```sql
platform_payment_gateways (
  id UUID PK,
  provider TEXT NOT NULL UNIQUE CHECK (provider IN ('stripe','cmi','manual')),
  enabled BOOLEAN NOT NULL DEFAULT false,
  public_key TEXT,                 -- publishable / merchant id (not secret)
  secret_key_encrypted TEXT,       -- never returned
  webhook_secret_encrypted TEXT,
  sandbox BOOLEAN NOT NULL DEFAULT true,
  extra JSONB NOT NULL DEFAULT '{}', -- CMI store key, callback URLs, etc.
  updated_at, updated_by
);
```

Exactly one of `stripe`/`cmi` should be `enabled` for self-serve checkout. `manual` is always on for Super Admin.

`GET` returns `secret_configured: boolean`, never the secret.

## Subscription invoices

```sql
subscription_invoices (
  id UUID PK,
  agency_id UUID NOT NULL REFERENCES agencies(id),
  package_id UUID NOT NULL REFERENCES subscription_packages(id),
  number TEXT UNIQUE NOT NULL,          -- e.g. SUB-2026-00041
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'MAD',
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN
    ('draft','open','paid','failed','void','refunded')),
  provider TEXT,
  provider_ref TEXT,                    -- Stripe session/payment intent id
  paid_at TIMESTAMPTZ,
  hosted_url TEXT,                      -- checkout or receipt
  created_at
);
```

Number format: `SUB-{year}-{seq}` platform-wide (not per agency).

## Checkout flow (agency admin)

1. `GET /api/settings/subscription` + `GET /api/public/packages`
2. `POST /api/billing/checkout` `{ package_id }`  
   - Agency must be `status = active`  
   - Package `is_public && is_active`  
   - Creates `subscription_invoices` (`open`)  
   - If package `price_amount = 0`: mark paid immediately, assign package, no gateway  
   - Else: create Stripe Checkout Session (or CMI redirect), return `{ checkout_url }`
3. Agency pays on the gateway
4. Webhook → mark invoice `paid`, set `agencies.package_id`, `subscription_status = active`, `subscription_renews_at = period_end`, write `subscription_events` source=`webhook`
5. Platform email `payment_received` (spec 04)

Success/cancel URLs: `{PUBLIC_URL}/settings?billing=success|cancel` (agency app).

### Stripe specifics

- Mode: `subscription` if `billing_period` is monthly/yearly; `payment` if `once`
- `client_reference_id` = invoice id  
- `metadata.agency_id`, `metadata.package_id`
- Webhook events: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`
- Idempotent: same `provider_ref` must not double-apply a package

### Failed payment

- Invoice `failed`, `subscription_status = past_due`
- Email `payment_failed`
- After 7 days still past_due: Super Admin job sets agency `status = suspended` (existing login block) and event `source=system`

## Manual / bank

Super Admin on agency detail or Payments list:

- `POST /api/platform/invoices/:id/mark-paid` `{ note }`
- `POST /api/platform/invoices` create an open invoice for an agency+package (bank request)
- `POST /api/platform/invoices/:id/void`

## APIs

### Super Admin

- `GET/PATCH /api/platform/settings/payments/:provider`
- `POST /api/platform/settings/payments/:provider/test` — Stripe: retrieve balance; CMI: config sanity
- `GET /api/platform/invoices?agency_id=&status=`
- `POST /api/platform/invoices/:id/mark-paid`
- `POST /api/platform/invoices/:id/void`
- `POST /api/platform/invoices/:id/refund` — Stripe only in v1; CMI = mark refunded manually

### Agency admin

- `POST /api/billing/checkout`
- `GET /api/billing/invoices`
- `GET /api/billing/invoices/:id` (own agency only)

### Public webhook (no JWT; signature required)

- `POST /api/billing/webhooks/stripe`
- `POST /api/billing/webhooks/cmi`

Raw body for Stripe signature. Replay window: reject events older than 24h.

## UI

**Super Admin → Settings → Payment gateways**

- Stripe: publishable key, secret, webhook secret, sandbox toggle, webhook URL (read-only: `{PUBLIC_URL}/api/billing/webhooks/stripe`)
- CMI: merchant id, secret, sandbox, extra
- Test buttons
- Warning if both Stripe and CMI enabled: “Only the first enabled non-manual provider is used”

**Super Admin → Payments**

- Invoice table: number, agency, package, amount, status, date
- Filters; open agency; mark paid / void

**Agency → Settings → Subscription**

- Current plan + renew date
- Public packages with price
- Pay / Change plan → redirect
- Invoice history

## Security

- Gateway secrets encrypted like SMTP
- Webhook endpoints must not use `denyRoles` incorrectly — they are unsigned JWT, signed by the provider
- Agency can only checkout for **themselves**
- Amount on the invoice is copied from the package at checkout time (price changes do not alter open invoices)

## Acceptance

- Super Admin stores a Stripe test key; agency admin on a paid public package gets a Checkout URL; completing test payment upgrades `package_id` and emails a receipt
- Replay of the same webhook does not create a second period
- Super Admin can mark a bank invoice paid; agency entitlements update without Stripe
- Free package checkout never calls the gateway
- Pilgrim `payments` table is untouched

## Out of scope

- Agency charging pilgrims via this gateway
- SEPA / PayPal
- Automatic proration mid-cycle (v1: change plan starts a new invoice for a full period; remaining time is not credited)
- Tax/VAT lines (store `amount` as TTC; add VAT later)
- Dunning beyond one email + 7-day grace
