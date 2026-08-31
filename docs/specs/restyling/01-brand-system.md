# Spec 01 — Brand system

**Owner:** Engineering (frontend theme) + Super Admin (runtime primary/accent)  
**Phase:** 1  
**Depends on:** nothing  
**Visual source:** [assets/reference-dashboard.png](./assets/reference-dashboard.png)

## Goal

One set of tokens for color, type, radius, and elevation. Mantine and CSS both read them. Feature pages stop embedding brown hexes.

## Current gaps

- `frontend/src/index.css` cream/brown variables
- `frontend/src/main.tsx` Mantine `primaryColor: 'brown'` 10-stop scale
- `BrandingProvider` writes only `--accent-primary` / `--accent-secondary`
- Semantic colors (`#66BB6A`, `#FFA726`, `#EF5350`) are fine; they are not the problem
- `defaultRadius: 'md'` is tighter than the mock (16–24px cards)

## Color tokens

Map every UI paint to a token. Hex values are fixed unless Super Admin overrides `primary` / `accent` at runtime.

| Token | Hex | CSS variable | Role |
|---|---|---|---|
| `navy` | `#071D35` | `--color-navy` | Sidebar, dark text, Kaaba/airplane in logo |
| `teal-deep` | `#063F46` | `--color-teal-deep` | Headings, primary button fill |
| `teal` | `#0C7774` | `--color-teal` | Icons, charts, links, focus ring |
| `gold` | `#C99A3D` | `--color-gold` | Active nav, prices, “Pro” |
| `gold-light` | `#E5C46A` | `--color-gold-light` | Hover gold, decorative strokes |
| `ivory` | `#F8F6F0` | `--bg-surface` | Cards, header, paper |
| `sand` | `#EEE9DD` | `--bg-canvas` | App background |
| `text` | `#071D35` | `--text-primary` | Body/headings (navy, not near-black grey) |
| `text-muted` | `#5C6B73` | `--text-secondary` | Labels, meta |
| `border` | `#E2D9C8` | `--border-color` | Hairlines on ivory (sand-tinted, not brown `#E8DFD0`) |
| `success` | `#2E7D5B` | `--success` | Confirmed / paid — deeper than current `#66BB6A` so it sits with teal |
| `warning` | `#C9842A` | `--warning` | Pending / hold |
| `danger` | `#C4473A` | `--danger` | Cancelled / error |

Derived (do not invent new hues):

| Token | Recipe | Use |
|---|---|---|
| `--teal-soft` | `teal` at 12% on ivory | Icon wells, selected row, quick-action tiles |
| `--gold-soft` | `gold` at 16% on ivory | Active-adjacent highlights |
| `--navy-overlay` | `navy` at 55% | Login photo overlay |

### Contrast (must pass)

| Pair | Where | Note |
|---|---|---|
| Ivory text on navy sidebar | Inactive nav | Use `#F8F6F0` / 85% white, not grey |
| Navy text on gold pill | Active nav | `#071D35` on `#C99A3D` |
| Ivory text on deep teal button | Primary CTA | White / ivory on `#063F46` |
| Navy text on ivory | Body | Default |
| Do **not** put gold text on sand | Prices | Gold on ivory is OK; gold on sand fails |

If Super Admin sets a custom `primary_color`, buttons/links follow it. Sidebar stays navy.

## Mantine palettes

Replace `brown` with two custom palettes. Mantine needs 10 stops (0–9). Index **6** is the default fill.

### `teal` (primaryColor)

| i | Hex | Notes |
|---|---|---|
| 0 | `#E7F3F2` | Lightest well |
| 1 | `#C8E4E2` | |
| 2 | `#96CBC8` | |
| 3 | `#5EAAA6` | |
| 4 | `#2E8F8B` | |
| 5 | `#0C7774` | Emerald — icons, links |
| 6 | `#063F46` | Deep — primary buttons |
| 7 | `#05353B` | |
| 8 | `#042A2F` | |
| 9 | `#071D35` | Navy stop for dark chrome |

`theme.primaryColor = 'teal'`.

### `gold` (extra, not primaryColor)

| i | Hex |
|---|---|
| 0 | `#FBF6EA` |
| 1 | `#F4E6C4` |
| 2 | `#E5C46A` |
| 3 | `#D4B054` |
| 4 | `#C99A3D` |
| 5 | `#B88932` |
| 6 | `#A07828` |
| 7 | `#7A5C1E` |
| 8 | `#534013` |
| 9 | `#2E240A` |

Use `color="gold"` only for active nav, money, decorative badges. Never as the default `Button` color.

Keep Mantine `green` / `red` / `orange` / `gray` for semantic badges.

## Typography

Keep **Tajawal** (already loaded in `index.html`) for AR and FR. Do not add a second family.

| Role | Size | Weight | Color | Line height |
|---|---|---|---|---|
| Page title | 24px / `h2` | 700 | navy | 1.35 |
| Section title | 18px | 700 | teal-deep | 1.4 |
| Body | 14px | 400 | navy | 1.6 |
| Table / form | 13–14px | 400–500 | navy | 1.5 |
| Meta / breadcrumb | 12px | 400 | text-muted | 1.4 |
| KPI number | 28–32px | 700 | navy | 1.1 |
| Nav item | 13px | 500 | ivory (inactive) / navy (active) | 1.3 |

Arabic: `font-weight: 700` on headings (already in `index.css`). Do not use 900 except the logo wordmark if rendered as text.

Letterspacing: tagline `TRAVEL • BOOK • PILGRIMAGE` only — `0.18em`, uppercase, 11px, teal-deep. Do not letterspace UI labels.

## Shape

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | 8px | Inputs, small chips |
| `--radius-md` | 12px | Buttons, badges, table |
| `--radius-lg` | 16px | Cards, KPI tiles, sidebar active pill |
| `--radius-xl` | 24px | Login paper, large dashboard panels |
| `--radius-pill` | 999px | Sidebar active item, search field |

`theme.defaultRadius = 'lg'` (16px). Search in the header mock is a pill; use `radius="xl"` on that input only.

## Elevation

Soft, not Material-heavy.

| Token | Value | Use |
|---|---|---|
| `sm` | `0 1px 2px rgba(7, 29, 53, 0.06)` | Table rows, inputs |
| `md` | `0 4px 14px rgba(7, 29, 53, 0.07)` | Cards, KPI |
| `lg` | `0 12px 32px rgba(7, 29, 53, 0.12)` | Login paper, dropdowns, modals |

No hard `0.3` black shadows (current login). Navy-tinted shadows only.

## Motion

Keep `transition: 0.2s ease` on buttons/links. Hover: teal → slightly darker deep teal; gold pill → light gold. No bounce, no logo spin (`App.css` Vite demo styles are unused — delete when touching the file).

## CSS variables (canonical)

Put this in `frontend/src/index.css` `:root`. `BrandingProvider` may override `--color-teal-deep`, `--color-gold`, and `--mantine-primary-color` from public branding; it must not override `--color-navy`, `--bg-canvas`, or `--bg-surface`.

```css
:root {
  --color-navy: #071D35;
  --color-teal-deep: #063F46;
  --color-teal: #0C7774;
  --color-gold: #C99A3D;
  --color-gold-light: #E5C46A;
  --bg-canvas: #EEE9DD;
  --bg-surface: #F8F6F0;
  --bg-sidebar: #071D35;
  --text-primary: #071D35;
  --text-secondary: #5C6B73;
  --border-color: #E2D9C8;
  --success: #2E7D5B;
  --warning: #C9842A;
  --danger: #C4473A;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 24px;
}
```

Deprecate `--bg-primary`, `--bg-secondary`, `--bg-card`, `--accent-primary`, `--accent-secondary`. During phase 1, alias the old names onto the new tokens so untouched pages do not flash brown.

```css
--bg-primary: var(--bg-canvas);
--bg-secondary: var(--bg-surface);
--bg-card: var(--bg-surface);
--accent-primary: var(--color-teal-deep);
--accent-secondary: var(--color-teal);
```

Remove the aliases in phase 5 after the hex sweep.

## Runtime branding

`GET /api/public/branding` still returns `primary_color` and `accent_color`.

| Branding field | Maps to |
|---|---|
| `primary_color` | `--color-teal-deep` + Mantine teal[6] |
| `accent_color` | `--color-gold` + Mantine gold[4] |

Seed / reset defaults:

- `primary_color`: `#063F46`
- `accent_color`: `#C99A3D`

Do not add extra color columns in v1. Navy, ivory, sand stay product constants (see [app-management/01-platform-branding.md](../app-management/01-platform-branding.md) — “theme editor for the whole Mantine theme” stays out of scope).

## Acceptance

- Changing Mantine `primaryColor` to `teal` turns default buttons teal without per-page edits.
- Canvas is sand, cards are ivory, sidebar is navy.
- No feature file introduced after this spec uses `#8B7355` or `#F5EFE6`.
- Custom branding primary still tints buttons; sidebar stays `#071D35`.

## Out of scope

- Per-component Figma
- Dark-mode media query
- Adding IBM Plex / Montserrat
