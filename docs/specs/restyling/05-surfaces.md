# Spec 05 — Surfaces

**Owner:** Engineering  
**Phase:** 3 (login + branding seed), 4–5 (the rest)  
**Depends on:** [02-logos-and-assets.md](./02-logos-and-assets.md), [03-shell.md](./03-shell.md), [04-components.md](./04-components.md)

Page-level application of the brand. Structure and copy stay; paint and logos change.

## 1. Login

**File:** `frontend/src/features/auth/Login.tsx`  
**Now:** full-bleed `bg.jpg`, 30% black overlay, dark glass form (`rgba(45,45,45,0.6)`), brown accent bar, white type.

**Target:** premium light card on a dark photo.

| Element | Spec |
|---|---|
| Background | `login_background_url` or bundled `bg.jpg` |
| Overlay | navy `#071D35` at 55% (not flat black) |
| Card | ivory, radius 24px, shadow `lg`, max-width 440px, padding 40px |
| Logo | `BrandLogo variant="stacked"` with tagline |
| Title | optional; logo already names the product — keep a short “تسجيل الدخول” / “Connexion” in teal-deep 700 |
| Fields | ivory inputs, teal focus; labels navy |
| Submit | full-width filled deep teal |
| Error | danger text, no brown |
| Footer | copyright from branding, muted, 12px |
| Language | switcher on the card, teal selected |

Do not keep the 4px brown leading strip on inputs. Focus ring is enough.

If `logo_url` from API is a full-width lockup that already includes text, show the image and hide live wordmark to avoid doubling the name.

## 2. Agency dashboard

**File:** `frontend/src/features/dashboard/DashboardStats.tsx`  
**Mock:** [assets/reference-dashboard.png](./assets/reference-dashboard.png)

Keep existing data (pilgrims, bookings, financial, inventory). Restyle:

- Page on sand (from shell)
- KPI row = spec 04 stat cards
- Lower papers (recent bookings, occupancy): ivory, teal titles
- RingProgress / Progress: teal + gold
- “Recent bookings” table: spec 04
- Hardcoded `#F5EFE6` wells → `--teal-soft` or sand

Do not add destination donuts, week line charts, or quick-action icon grids unless those widgets already exist.

## 3. Platform dashboard

**File:** `frontend/src/features/platform/PlatformDashboard.tsx`

Same KPI recipe. `StatCard` `color = 'brown'` → `teal`. Agency status badges: active = success, suspended = danger.

## 4. Bookings list

**File:** `frontend/src/features/bookings/BookingsPage.tsx`  
**Layout reference:** [assets/reference-bookings.png](./assets/reference-bookings.png) — columns, filters, pagination. **Ignore** that mock’s leftover bright green and Al-Baraka branding.

- Title + breadcrumb navy / muted
- `+` new booking: filled teal
- Export: outline
- Filters: ivory bar
- Status badges: spec 04
- Remaining amount: gold
- Row actions: subtle navy icons

Do not add five summary KPI cards on this page unless they already exist. The mock’s summary row is optional later; not required for restyle.

## 5. Other list pages

Clients, pilgrims, flights, accommodations, seasons, inventory, expenses, reports, messages, platform agencies/packages/payments: inherit theme. Phase 5 hex sweep only (`#8B7355` icons, cream papers).

## 6. Booking wizard & maps

**Files:** `BookingWizard.tsx`, `RoomMap.tsx`, `SeatMapPage.tsx`, `BedMapPage.tsx`

Selected card: border `--color-teal`, background `--teal-soft` (replace `#8B7355` / `#F5EFE6`). Occupied / blocked: danger-soft. Available: ivory. Lucide header icons: teal.

## 7. Invoices (on-screen + PDF)

**Files:** `BookingInvoicePage.tsx`, backend PDF renderer if any

| Piece | Spec |
|---|---|
| Screen table header | sand, not `#F5EFE6` |
| Totals | navy; remaining gold |
| Agency logo | existing white-label rules |
| Fallback when no agency logo | composed mark + agency name — **not** “Hujjaj Hajj & Omra” |
| “Powered by …” when white-label off | `Powered by {platform app_name}` in muted 11px |

PDF: navy headings, teal rules, gold for amounts if the generator can set hex. If PDF is HTML print, reuse the screen styles.

## 8. Platform + agency emails

**File:** `backend/src/services/platformMail.service.ts` (`wrapHtml`)

| Now | Target |
|---|---|
| `background:#F5EFE6` | `background:#EEE9DD` |
| card `#fff` + `#E8DFD0` | `#F8F6F0` + `#E2D9C8` |
| name color `#8B7355` | `#063F46` |
| fallback title | branding `app_name` |

Header: public `logo_url` `<img>` if set; else HTML wordmark (navy + teal “Agency” + gold “Pro”) so clients without image loading still see the brand.

Agency outbound mail (existing SMTP templates): keep agency from-name; only replace leftover cream/brown wrappers if those templates share colors.

## 9. Settings / branding preview

**File:** `frontend/src/features/platform/BrandingSettings.tsx`

- Defaults `#063F46` / `#C99A3D`
- Live preview: ivory mini-header + stacked logo + teal button
- Color pickers labelled “Primary (teal)” / “Accent (gold)” in AR+FR

Agency settings color picker (white-label): still one primary; it tints CTAs only.

## 10. Print / PDF chrome

`@media print`: drop navy sidebar, sand → white/ivory, keep navy type and teal rules so invoices stay legible on paper.

## Acceptance

- Login is an ivory stacked-logo card on a navy-washed photo; submit is deep teal.
- Dashboards and bookings use ivory cards on sand with teal icons and gold prices.
- Email HTML background is sand/ivory, not cream/brown.
- No surface still says “Hujjaj” unless branding was explicitly set back.

## Out of scope

- New dashboard widgets from the mock
- Custom login illustration beyond existing background upload
- SMS template restyle
