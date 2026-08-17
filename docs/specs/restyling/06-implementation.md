# Spec 06 — Implementation

**Owner:** Engineering  
**Phase:** 1 → 5 as in [README.md](./README.md)  
**Depends on:** specs 01–05

## Goal

A concrete file map, default-value changes, and a hardcoded-color sweep so the restyle can be built without rediscovering brown.

## Phase 1 — Tokens

| File | Change |
|---|---|
| `frontend/src/index.css` | New `:root` tokens from spec 01; alias old `--bg-*` / `--accent-*` |
| `frontend/src/main.tsx` | `createTheme`: palettes `teal` + `gold`, `primaryColor: 'teal'`, `defaultRadius: 'lg'`, navy-tinted shadows, component defaults (Button, Paper, Input) |
| `frontend/src/App.css` | Delete unused Vite demo (logo spin). Keep file only if imported; otherwise stop importing |
| `frontend/src/providers/BrandingProvider.tsx` | Defaults `#063F46` / `#C99A3D`; set `--color-teal-deep` and `--color-gold` (keep `--accent-*` aliases) |

Do not restyle Sidebar yet in this phase if it would flash a teal-on-cream nav. Shipping tokens + cream canvas for one commit is OK; prefer tokens + shell in the same PR if possible.

## Phase 2 — Shell + logos

| File | Change |
|---|---|
| `frontend/src/components/brand/BrandLogo.tsx` | **New.** Spec 02 |
| `frontend/src/components/layout/DashboardLayout.tsx` | Navy/ivory/sand AppShell styles; 64 / 248; `BrandLogo`; no brown Burger/Avatar |
| `frontend/src/components/layout/Sidebar.tsx` | Navy item styles; gold active pill; optional mosque SVG |
| `frontend/src/components/common/LanguageSwitcher.tsx` | `color="teal"`, ivory track |
| `frontend/index.html` | Title fallback `الحج والعمرة — وكالة برو`; favicon not Vite |
| `frontend/src/assets/brand/*` | Already copied: `logo-lockup-horizontal.png`, `logo-stacked.png` |

Optional: `frontend/src/assets/brand/sidebar-motif.svg` (gold line-art). Inline SVG in Sidebar is fine.

## Phase 3 — Login + branding seed

| File | Change |
|---|---|
| `frontend/src/features/auth/Login.tsx` | Ivory card, stacked logo, navy overlay, teal submit |
| `frontend/src/features/platform/BrandingSettings.tsx` | New DEFAULTS; preview uses `BrandLogo` |
| `frontend/src/locales/ar/translation.json` | `app_name`, `platform_name` → Arabic brand |
| `frontend/src/locales/fr/translation.json` | `app_name`, `platform_name` → `Hajj & Umrah Agency Pro` |
| `backend/db/app_management.sql` | `platform_branding` default colors + names |
| `backend/db/migrations/20260816000000_app_management.js` | Same defaults on create |
| **New migration** `backend/db/migrations/YYYYMMDDHHMMSS_restyle_branding_defaults.js` | `UPDATE platform_branding SET primary_color, accent_color, app_name*` **only where still the old brown/Hujjaj defaults** — do not overwrite Super Admin customizations |
| `backend/src/controllers/branding.controller.ts` | Fallback hex `#063F46` / `#C99A3D` |
| `backend/src/controllers/settings.controller.ts` | Session branding fallback hex |
| `backend/src/schemas/appManagement.ts` | No schema change required if still two hex fields |

Suggested seed values:

```sql
app_name     = 'Hajj & Umrah Agency Pro'
app_name_ar  = 'الحج والعمرة — وكالة برو'
app_name_fr  = 'Hajj & Umrah Agency Pro'
tagline_ar   = 'سافر • احجز • اعتمر'
tagline_fr   = 'Travel • Book • Pilgrimage'
primary_color = '#063F46'
accent_color  = '#C99A3D'
```

Leave `logo_url` null so the composed bundled logo is used until they upload.

## Phase 4 — Shared look on high-traffic pages

| File | Change |
|---|---|
| `frontend/src/features/dashboard/DashboardStats.tsx` | Stat cards, wells, ThemeIcon teal |
| `frontend/src/features/platform/PlatformDashboard.tsx` | Same |
| `frontend/src/features/bookings/BookingsPage.tsx` | Badges, gold remaining, buttons |
| `frontend/src/features/bookings/BookingInvoicePage.tsx` | Table header sand; totals |

Mantine theme overrides should already make most `Button` / `Paper` correct.

## Phase 5 — Hex sweep

Search the repo for leftover brown/cream. Replace with tokens or `color="teal"`.

Known hits (from current tree):

| Pattern | Approx. files |
|---|---|
| `color="brown"` | Layout, dashboards, platform pages, lists, ImageUpload, LanguageSwitcher |
| `#8B7355` | DashboardLayout, Login, BrandingProvider, ImageUpload, BookingWizard, BedMap, SeatMap, Pilgrims, Reports, controllers, mail |
| `#F5EFE6` | index.css, DashboardLayout, BookingWizard, BookingInvoice, DashboardStats, ImageUpload, mail |
| `#FEFBF6` | DashboardLayout, LanguageSwitcher, ImageUpload |
| `#E8DFD0` | index.css, DashboardLayout, LanguageSwitcher, ImageUpload, mail |
| `#6F5C45` | BrandingProvider, BrandingSettings, controllers |

Also check: `backend/src/services/platformMail.service.ts`, invoice PDF templates, `seedDemo.ts` if it inserts branding colors.

After the sweep, delete the CSS aliases `--bg-primary` etc. if unused.

## What not to rewrite

- Route tables, entitlements, RLS
- Booking wizard step logic
- Spec 01 in app-management (platform branding API). This restyle only changes **defaults** and the **theme implementation**. Super Admin can still upload logos and two colors.

## Agency white-label interaction

```
sidebar, canvas, header shape  →  always product tokens (navy / sand / ivory)
Button filled, links, focus    →  agency.primary_color if white_label else platform primary
accent / gold prices           →  platform gold unless a future spec adds agency accent
```

`DashboardLayout` today sets `headerColor` from agency primary. Stop using that for the wordmark. If white-label is on, pass agency primary into Mantine theme **primary** for that session only (optional v1). Minimum v1: CSS `--color-teal-deep: agency.primary_color` in the agency workspace, same as BrandingProvider already does for `--accent-primary`.

## QA checklist

- [ ] Arabic RTL: sidebar on the right, gold pill, icons on the start of the label (end of row)
- [ ] French LTR: sidebar on the left, same tokens
- [ ] Login unauthenticated: public branding + bundled logo, no black PNG box
- [ ] Super Admin: platform name + mark
- [ ] Agency with logo: agency logo in header, navy sidebar unchanged
- [ ] Agency without logo: agency **name**, not platform Kaaba
- [ ] Super Admin branding “reset” restores teal/gold
- [ ] Custom primary in branding tints buttons, not sidebar
- [ ] Invoice remaining amount is gold; confirmed badge is green
- [ ] Email preview / test send uses sand/ivory wrapper
- [ ] Contrast: ivory on navy nav, navy on gold pill, ivory on teal button
- [ ] No `#8B7355` in `frontend/src` after phase 5

## Suggested PR split

1. Tokens + Mantine theme + CSS aliases  
2. BrandLogo + shell + login + locale/seed defaults  
3. Dashboard + bookings + invoices + mail  
4. Hex sweep leftovers  

## Out of scope

- Transparent SVG logo production (track as follow-up; composed logo is v1)
- Changing Render/env branding
- Screenshot tests (nice later)
