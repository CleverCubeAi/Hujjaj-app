# Spec 02 — Agency white labeling

**Owner:** Agency admin (edit). Super Admin (view + package entitlement).  
**Phase:** 2  
**Depends on:** [01-platform-branding.md](./01-platform-branding.md), [05-subscription-packages.md](./05-subscription-packages.md)

## Goal

Each agency looks like **their** travel brand to staff and clients: header, invoices, PDF, and outbound email `from_name`. The platform brand stays on the login page and on Super Admin.

White-label depth is gated by the agency’s subscription package (`features.white_label`).

## Two layers

| Surface | Whose brand | Always? |
|---|---|---|
| Login page | Platform | Yes |
| Super Admin console | Platform | Yes |
| Agency app header | Agency name + logo | Yes (basic) |
| Invoice / PDF | Agency | Yes (basic) |
| Email from name/logo | Agency SMTP `from_name` | If they configured SMTP |
| Colors, login-for-staff (future), invoice footer/legal | Agency extras | Only if `white_label` on package |
| “Powered by {platform}” on invoices | Platform | Shown when `white_label` is **off** |

## Current gaps

- `agencies.logo_url`, `name` exist. No Arabic name, phone, email, address, colors on `agencies` (invoice code already selects `name_ar, phone, email, address` but those columns are not on the table).
- Agency settings UI: name, country, logo. Plan/status read-only (keep).
- Invoice PDF uses agency name, not logo image.
- Some invoice UI still prints “Hujjaj Hajj & Omra”.

## Agency brand fields

Add to `agencies` (nullable unless noted):

| Column | Purpose |
|---|---|
| `name_ar` | Arabic legal/commercial name |
| `legal_name` | Printed on invoices |
| `phone` | Invoice / header |
| `email` | Public contact |
| `address` | Invoice |
| `website` | Optional |
| `logo_url` | Already exists |
| `invoice_logo_url` | Optional; falls back to `logo_url` |
| `primary_color` | Workspace accent if `white_label` |
| `invoice_footer` | Extra line on PDF |
| `hide_platform_mark` | Effective only if package allows white_label |

Keep `name`, `country`, `status`, `subscription_plan` as they are until packages replace the plan string (spec 05).

## Entitlements

From the active package (spec 05):

| Flag | If false | If true |
|---|---|---|
| *(always)* | Name + logo + contact on header/invoice | Same |
| `white_label` | Invoice shows “Powered by {platform app_name}”. No custom colors. | Custom colors, footer, hide platform mark |

Server must enforce `hide_platform_mark` and colors. Do not trust the client.

## Who can edit

- **Agency admin:** own agency brand fields. Cannot change plan/status.
- **Super Admin:** can view brand on agency detail (read-only is enough in v1). Does not operate the agency app.
- Manager/agent: read-only.

## APIs

Existing:

- `GET /api/settings/agency` — include new fields
- `PUT /api/settings/agency` — agency_admin only; **ignore** `status`, `subscription_plan`; ignore `hide_platform_mark` / colors if package lacks `white_label`

New:

- `GET /api/settings/branding` — public-to-session payload the layout already needs (name, logo, colors) so the header does not pull the full agency row

Uploads stay `POST /api/upload/agencies` (agency-scoped).

## UI

**Agency → Settings → Agency** (extend current screen)

- Logo (existing)
- Names (FR/AR), legal name, phone, email, address, website
- Invoice logo (optional)
- If package has `white_label`: color picker, invoice footer, “Hide platform mark”
- If not: those controls disabled with a short note: “Available on {package name}”

**Super Admin → Agency detail**

- Show logo + contact as read-only context next to subscription (no agency-ops screens)

**Layout / invoices**

- Header: agency logo else agency name. Never platform name for agency users.
- PDF: draw logo if present; contact line; footer; platform mark per entitlement.
- Remove hardcoded “Hujjaj Hajj & Omra” from `BookingInvoicePage`.

## Acceptance

- Agency with only a logo sees it in the header and on the invoice PDF.
- Agency on a package without `white_label` cannot persist custom colors (API 403/400).
- Invoice for a non-white-label agency includes “Powered by {platform}”.
- Super Admin still sees platform branding, not the last-opened agency’s logo.

## Out of scope

- Custom hostname (`agency.hujjaj.app`)
- Per-branch logos already exist on `branches.logo_url`; do not replace agency logo with branch logo in v1
- Client-facing public booking portal
