# Spec 04 — Components

**Owner:** Engineering  
**Phase:** 4 (after tokens + shell)  
**Depends on:** [01-brand-system.md](./01-brand-system.md), [03-shell.md](./03-shell.md)  
**Visual source:** [assets/reference-dashboard.png](./assets/reference-dashboard.png), [assets/reference-bookings.png](./assets/reference-bookings.png) (layout only)

## Goal

Shared controls look like the mock: large radius, ivory paper, teal icons, gold only for money and selection. Prefer Mantine theme defaults so pages inherit without local `style={{ backgroundColor: '#FFFFFF' }}`.

## Theme component overrides

Set these once in `createTheme` / `MantineProvider` (phase 1–4). Do not copy-paste per page.

### Button

| Variant | Fill | Label | Use |
|---|---|---|---|
| `filled` (default) | Deep teal `#063F46` | Ivory | Primary: New booking, Save |
| `filled` hover | `#05353B` | Ivory | |
| `light` | `--teal-soft` | Deep teal | Secondary |
| `outline` | transparent, border teal-deep | Teal-deep | Export, cancel-adjacent |
| `subtle` | transparent | Navy / muted | Icon actions |
| Gold filled | **Forbidden** as default | — | Only if a page explicitly `color="gold"` (e.g. “Upgrade”) |

`size="sm"` default in dense tables; `md` on page headers. Radius `md` (12px). “+ حجز جديد” in the bookings mock is the filled teal button, not gold.

### Paper / Card

- Background `--bg-surface`
- Border `1px solid --border-color`
- Radius `lg` (16px)
- Shadow `md`
- White `#FFFFFF` is **not** the card color (current KPI cards). Ivory is.

### Input / Select / PasswordInput

- Background ivory or `#FFFdf8` (ivory+). Not white-on-cream.
- Border `--border-color`; focus ring 2px `--color-teal`
- Radius `sm` (8px); header search if added later is pill
- Error: `--danger`

### Table

- Wrapper: ivory Paper, radius `lg`, overflow hidden
- Header row: sand `#EEE9DD`, 12px 600, teal-deep labels
- Body: ivory, 13–14px navy
- Row hover: `--teal-soft`
- Money cells (`remaining`, `paid`): `#C99A3D` 600 — this is the bookings mock’s gold numbers
- Pagination: square 32px, teal-deep selected, sand default

### Badge (status)

Do not use Mantine `blue` for confirmed (current `statusColors.confirmed = 'blue'`).

| Status | Fill | Text |
|---|---|---|
| draft | gray.1 | gray.7 |
| confirmed | `#E3F2EA` | `#2E7D5B` |
| paid | `#E3F2EA` | `#2E7D5B` |
| pending / expired / hold | `#F8EEDC` | `#C9842A` |
| cancelled | `#F8E4E1` | `#C4473A` |

Radius `sm`, padding 4×10, weight 600. Arabic labels unchanged.

### ThemeIcon / Lucide

KPI and page headers: `variant="light"` with Mantine `teal`, size 44–50, radius `md`. Icon stroke 1.5, color `--color-teal`. Stop passing `color="#8B7355"` into Lucide.

### Tabs / SegmentedControl / NavLink (in-page)

Selected = teal or gold **only in the sidebar**. In-page tabs: teal underline or teal-soft pill, not gold.

### Modal / Drawer / Notifications

Modal paper ivory, overlay navy 40%. Notifications: success/danger semantic; info uses teal.

### Menu (row actions)

Ivory, radius `md`, gold not used. Destructive items `--danger`.

## KPI / stat cards

Match the dashboard mock’s four tiles.

```
[ teal line-icon ]
  Label (muted 12px)
  1,248  (navy 28px 700)
  ↑ +14% from last month  (teal if up, danger if down)
```

- One card = one ivory Paper
- Icon not in a brown ThemeIcon; use teal
- Trend copy: keep existing “من الشهر الماضي” / FR equivalent
- Grid: `SimpleGrid` 2–4 columns as today; radius `lg`

Platform dashboard stat cards use the same recipe (`color = 'brown'` → `teal`).

## Charts (if present)

Existing RingProgress / Progress: teal + gold + sand tracks. Donut segments: teal, teal-deep, gold, gold-light, navy. No rainbow.

Do not build the mock’s line chart if `DashboardStats` has no time series. Restyle what exists; do not invent widgets (README out of scope).

## Filters bar (bookings)

Ivory paper, inputs in a row, radius `sm`. Primary “New” button on the **start** side in RTL (right in Arabic). Export = outline.

## Empty / loading

Loader color teal. Empty state icon teal-soft well + navy title.

## Hardcoded patterns to kill

Any of these in a feature file is a spec violation after phase 5:

- `color="brown"`
- `color="#8B7355"`
- `backgroundColor: '#F5EFE6' | '#FEFBF6' | '#FFFFFF'` on cards
- `border: '... #E8DFD0'`

Replace with theme props (`color="teal"`) or CSS variables.

## Acceptance

- Default `Button` is deep teal without per-page color props.
- Booking status badges: green / amber / red as above, not blue-for-confirmed.
- KPI tiles: ivory on sand, teal icons.
- Table money column reads gold.

## Out of scope

- New design-system package
- Rewriting BookingWizard steps (only swap hex + brown)
- Custom checkbox/radio SVGs
