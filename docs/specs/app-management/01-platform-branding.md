# Spec 01 — Platform branding (app name)

**Owner:** Super Admin  
**Phase:** 1  
**APIs:** `/api/platform/settings/branding`, `GET /api/public/branding`

## Goal

The product name, logos, login screen, and default colors come from the database, not from hardcoded `app_name` / `platform_name` / `Hujjaj` strings.

Agencies still show **their** name and logo inside the workspace (see [02-agency-white-labeling.md](./02-agency-white-labeling.md)). This spec is the **platform skin**: login page, Super Admin chrome, emails sent by the platform, browser tab.

## Current gaps

- `frontend/src/locales/*/translation.json` → `app_name`, `platform_name`
- Login page has a fixed background image and no product name from config
- Super Admin header shows `t('platform_name') || 'Hujjaj'`
- Invoice PDF fallback and some UI still say “Hujjaj Hajj & Omra”

## Settings

| Field | Type | Notes |
|---|---|---|
| `app_name` | string | Default display name, e.g. `Hujjaj` |
| `app_name_ar` | string | Arabic |
| `app_name_fr` | string | French |
| `tagline_ar` | string? | Login subtitle |
| `tagline_fr` | string? | |
| `logo_url` | string? | Header / emails |
| `logo_mark_url` | string? | Square mark / favicon source |
| `favicon_url` | string? | |
| `login_background_url` | string? | Falls back to current `bg.jpg` |
| `primary_color` | hex | Default `#8B7355` (current brown) |
| `accent_color` | hex | |
| `support_email` | string? | Shown on login / emails |
| `support_phone` | string? | |
| `default_locale` | `ar` \| `fr` | Login language if none stored |
| `legal_name` | string? | Invoices, footer |
| `copyright` | string? | Footer; may include `{year}` |

Uploads reuse `/api/upload/...` **except** Super Admin has no agency. Add a platform upload path:

`POST /api/platform/upload/branding`  
folder: `platform/branding`  
types: jpeg/png/webp/svg/ico, max 2 MB (favicon 256 KB)

## Data

Singleton row. No `agency_id`.

```sql
CREATE TABLE platform_branding (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  app_name TEXT NOT NULL DEFAULT 'Hujjaj',
  app_name_ar TEXT NOT NULL DEFAULT 'حجاج',
  app_name_fr TEXT NOT NULL DEFAULT 'Hujjaj',
  tagline_ar TEXT,
  tagline_fr TEXT,
  logo_url TEXT,
  logo_mark_url TEXT,
  favicon_url TEXT,
  login_background_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#8B7355',
  accent_color TEXT NOT NULL DEFAULT '#6F5C45',
  support_email TEXT,
  support_phone TEXT,
  default_locale TEXT NOT NULL DEFAULT 'ar' CHECK (default_locale IN ('ar','fr')),
  legal_name TEXT,
  copyright TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES users(id)
);
```

Seed one row on migrate. Super Admin update is upsert of that row.

## APIs

### Public (no auth)

`GET /api/public/branding`

Returns all non-secret fields. Used by Login, `<title>`, favicon. Cache `Cache-Control: public, max-age=60`.

### Super Admin

- `GET /api/platform/settings/branding`
- `PATCH /api/platform/settings/branding` — partial update, validated hex colors, URLs from our upload host only (reject arbitrary remote HTML)
- `POST /api/platform/upload/branding`

## UI

Super Admin → Settings → **Branding**

- Live preview of login header (name + logo + colors)
- Image uploads for logo, mark, favicon, login background
- Color pickers with a “Reset to default” action
- Save; toast on success

Login page:

- Fetch public branding on mount
- Title = `app_name_*` for current language
- Background = `login_background_url` or bundled fallback
- Accent bar / button use `primary_color`

Super Admin chrome uses platform logo + `app_name_*`, never an agency logo.

## Acceptance

- Changing the app name updates login, browser tab, and Super Admin header without a rebuild.
- Agencies still see their own name in the workspace header.
- Invalid color or oversized file is rejected with a 400.
- Missing branding row still boots (migration seed).

## Out of scope

- Per-agency custom domain / CSS
- Theme editor for the whole Mantine theme (primary + accent is enough)
- Dark mode brand variants
