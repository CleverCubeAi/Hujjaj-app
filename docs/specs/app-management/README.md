# App management specs

Platform settings owned by **Super Admin**. Agencies remain tenants; they do not configure the product, they subscribe to it.

## Product split

| Actor | Sees | Owns |
|---|---|---|
| Super Admin | Platform console only | App branding, LLM, platform email, payment gateways, subscription packages, agency accounts |
| Agency admin | Agency workspace only | Agency white-label (within package), agency SMTP/SMS, team |
| Manager / agent | Agency workspace | Operational data only |

Super Admin is not an agency manager. That rule stays.

## Current state (do not regress)

- Super Admin: list/create agencies, set `status` + hardcoded `subscription_plan` (`free` / `basic` / `premium`), manage agency users.
- Agency: `name`, `country`, `logo_url`. Plan and status are read-only.
- Email/SMS today are **per-agency** (`email_settings`, `sms_settings`), encrypted with `ENCRYPTION_KEY`.
- Invoices use agency name/logo. Header uses agency logo or name. Login page is hardcoded.
- No LLM. No payment for subscriptions. No packages table.

## Target

1. Platform branding (app name, logos, login, colors) is editable.
2. Agencies can white-label their workspace/invoices within their package.
3. Super Admin configures one platform LLM (keys never shown to agencies).
4. Super Admin configures platform email (system mail: invoices, invites, password reset). Agencies keep their own SMTP for client mail.
5. Super Admin defines subscription packages (limits + features + price).
6. Agencies pay those packages through a Super-Admin-configured payment gateway. Super Admin can still assign/override a plan manually.

## Specs in this folder

| File | Topic |
|---|---|
| [01-platform-branding.md](./01-platform-branding.md) | App name, logos, login, colors |
| [02-agency-white-labeling.md](./02-agency-white-labeling.md) | Per-agency branding on UI, invoices, emails |
| [03-llm-settings.md](./03-llm-settings.md) | Platform LLM provider, models, budget, entitlements |
| [04-email-services.md](./04-email-services.md) | Platform SMTP vs agency SMTP |
| [05-subscription-packages.md](./05-subscription-packages.md) | Packages, limits, feature flags |
| [06-payment-gateway.md](./06-payment-gateway.md) | Gateways, checkout, webhooks, invoices |

Read **[05](./05-subscription-packages.md)** and **[06](./06-payment-gateway.md)** together. Packages define what is sold; the gateway collects payment.

## Shared principles

- Secrets (API keys, SMTP passwords, gateway secrets) are encrypted at rest with `ENCRYPTION_KEY`. APIs never return the raw secret — only `configured: true/false` and a last-4 mask if useful.
- All Super Admin APIs live under `/api/platform/...` and require `role = super_admin`.
- Agency operational APIs stay blocked for Super Admin.
- Feature access is checked server-side from the agency’s **active package**, not from the UI hiding a button.
- Currency for subscriptions is **MAD** unless a package overrides it.
- UI copy is Arabic + French, same as the rest of the app.
- Public branding (login, emails) is served from a **public, unauthenticated** endpoint so the login page can load before auth.

## Proposed Super Admin navigation

```
Dashboard
Agencies
Packages
Payments
────────
Settings
  Branding
  Email
  LLM
  Payment gateways
```

Agency settings (existing) stay under the agency workspace: Profile, Agency (white-label), Team, Email, SMS.

## Delivery order

| Phase | What ships | Why first |
|---|---|---|
| 1 | Branding + packages (manual assign, no payment yet) | Unblocks selling plans; Super Admin already assigns plans today |
| 2 | Platform email + agency white-label polish | Needed before paid invoices and invites |
| 3 | Payment gateway + subscription invoices | Agencies can pay |
| 4 | LLM settings + entitlement gates | Independent; only useful once packages can grant `llm` |

Do not start LLM product features (chat, extraction) in these specs. This folder only covers **settings and entitlements**.

## Out of scope (whole folder)

- Agency staff using Super Admin screens
- Per-agency LLM keys (unless a future “BYOK” package flag is added)
- Custom domains / white-label DNS
- Changing pilgrim booking payments (cash/card already in the agency app)
- Mobile apps
