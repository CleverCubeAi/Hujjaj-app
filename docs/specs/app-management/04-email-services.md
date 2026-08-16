# Spec 04 — Email services

**Owner:** Super Admin (platform mail). Agency admin (tenant mail, already exists).  
**Phase:** 2  
**Related:** agency SMTP in Settings → Email; encryption via `ENCRYPTION_KEY`

## Goal

Two mail pipes, not one:

| Pipe | Who configures | Used for |
|---|---|---|
| **Platform SMTP** | Super Admin | Subscription invoices, payment receipts, agency invite, password reset, “agency suspended”, LLM budget alerts |
| **Agency SMTP** | Agency admin | Client/booking messages, handovers, anything the agency sends as themselves |

If platform SMTP is missing, Super Admin actions that need mail still succeed, but mail is skipped and the UI warns “Email not configured”. Do not silently use an agency’s SMTP for platform mail.

## Current state

- Table `email_settings` is **per agency** (`agency_id` PK)
- Providers: gmail / outlook / yahoo / custom
- Password encrypted; test endpoint exists
- Super Admin is blocked from agency settings, so **nobody can send system mail today**

## Platform SMTP

New singleton `platform_email_settings` — same shape as agency settings, no `agency_id`:

```
provider, host, port, secure, username, password_encrypted,
from_email, from_name, enabled, last_tested_at, test_status
```

`from_name` defaults to platform `app_name` (spec 01).

Optional later: `reply_to`. Not required in v1.

### From-address rules

- Platform mail: always `platform_email_settings.from_email`
- Agency mail: always that agency’s `email_settings.from_email`
- Never fall back from platform → agency or the reverse

### Templates (platform)

Store as code in v1 (not a CMS). Locale: agency admin’s preference, else `ar`.

| Event | Recipients |
|---|---|
| `agency_invited` | New agency admin |
| `subscription_invoice` | Agency billing email (see below) |
| `payment_received` | Agency billing email |
| `payment_failed` | Agency billing email + Super Admin support_email |
| `subscription_suspended` | All agency_admins of that tenant |
| `password_reset` | The user (when that feature exists) |
| `llm_budget_alert` | `budget_alert_email` or support_email |

Each template includes platform logo (spec 01) and support contact.

Agency billing email: `agencies.email` if set, else the first `agency_admin` user email.

## Agency SMTP (existing — keep)

- Still at `/api/notifications/email`
- Super Admin must **not** gain this route
- Package flag `features.email` (spec 05): if false, agency can still save settings but **send** returns `403 email_not_in_plan`. Super Admin can allow email only on paid packages.

v1 recommendation: `features.email` default **true** on all paid packages, **false** on free (they can use the app, not blast clients). Confirm at implementation if free should keep SMTP (current behaviour is unrestricted). Spec default: **free = no outbound email**.

## APIs

### Super Admin

- `GET /api/platform/settings/email` — password masked
- `PATCH /api/platform/settings/email` — same body as agency email settings
- `POST /api/platform/settings/email/test` `{ to: email }`

### Unchanged agency routes

`GET/PUT /api/notifications/email`, `POST /api/notifications/email/test`

## UI

**Super Admin → Settings → Email**

Mirror the existing agency Email settings screen (provider presets, host/port, from, test). Extra:

- Enabled toggle
- Last test status
- Short explanation: “Used for subscription and account emails, not for agencies’ clients.”

**Agency → Settings → Email**

Keep current screen. If package lacks `email`, show a banner and disable Send/Test (Save can remain so they are ready after upgrade).

## Operational rules

- All sends go through the existing `email.service` (nodemailer)
- Timeouts 15s; failures logged without passwords
- Test is rate-limited
- Changing password: empty field = keep previous hash/secret (same as today)

## Acceptance

- Super Admin can send a test email to themselves using platform SMTP
- Creating an agency can send `agency_invited` when platform SMTP is enabled (optional checkbox on create: “Send login email”)
- Agency SMTP test still works for agency_admin and is 403 for Super Admin
- Platform invoice email never uses an agency’s Gmail

## Out of scope

- In-app template editor
- Marketing campaigns
- Incoming mail / IMAP
- SMS (already per-agency; no platform SMS in this spec)
