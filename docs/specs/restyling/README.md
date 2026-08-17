# Restyling specs — Hajj & Umrah Agency Pro

Replace the current cream/brown skin with the **modern-luxury Islamic** brand defined by the new logos.

This folder is visual and implementation guidance. It does not change product rules in [app-management](../app-management/README.md). Super Admin still owns platform branding; agencies still white-label within their package.

## Brand in one sentence

Dark navy chrome, emerald teal for action and data, luxury gold for emphasis, warm ivory and soft sand for surfaces.

## Palette (locked)

| Role | Name | Hex | Use |
|---|---|---|---|
| Primary | Deep Teal | `#063F46` | Headings, primary buttons, dark fills |
| Primary | Dark Navy | `#071D35` | Sidebar, header bar on dark chrome, strong text |
| Primary | Emerald Teal | `#0C7774` | Icons, charts, links, positive trends, focus |
| Accent | Luxury Gold | `#C99A3D` | Active nav, prices, key highlights |
| Accent | Light Gold | `#E5C46A` | Hover gold, decorative lines, badges |
| Background | Warm Ivory | `#F8F6F0` | Cards, header, paper |
| Background | Soft Sand | `#EEE9DD` | App canvas behind cards |

Do not introduce new brand hues. Semantic colors (success / warning / danger) stay functional and sit *beside* the brand, not instead of it.

## Source files

| File | What it is |
|---|---|
| [assets/logo-lockup-horizontal.png](./assets/logo-lockup-horizontal.png) | Header / compact lockup |
| [assets/logo-stacked.png](./assets/logo-stacked.png) | Login, emails, splash |
| [assets/reference-dashboard.png](./assets/reference-dashboard.png) | **Target** home dashboard |
| [assets/reference-bookings.png](./assets/reference-bookings.png) | Bookings **layout** only — restyle with the palette above, not the mock’s leftover teal-green |

Runtime copies of the logos also live in `frontend/src/assets/brand/` as bundled fallbacks.

## Current state (do not keep)

- CSS + Mantine theme: cream `#F5EFE6`, brown `#8B7355` / `#6F5C45`
- `primaryColor: 'brown'` in `frontend/src/main.tsx`
- Light sidebar (`#FEFBF6`) and cream main (`#F5EFE6`)
- Dozens of hardcoded hexes in pages (`#8B7355`, `#E8DFD0`, `#FEFBF6`)
- Platform branding defaults: `primary_color #8B7355`, `accent_color #6F5C45`
- Login: dark glass panel on `bg.jpg`
- Product name in locales still “حجاج / Hujjaj”
- Favicon is the Vite SVG

## Target

1. One token file drives CSS variables **and** the Mantine theme.
2. Navy sidebar + ivory header + sand canvas, matching the dashboard mock.
3. Bundled logos on login, header, favicon, emails, invoices (until Super Admin uploads replacements).
4. Platform branding seed and “Reset to default” use the new palette.
5. Agency white-label still tints **actions** (buttons, links), not the navy chrome.

## Specs in this folder

| File | Topic |
|---|---|
| [01-brand-system.md](./01-brand-system.md) | Tokens, type, radius, shadow, semantic colors |
| [02-logos-and-assets.md](./02-logos-and-assets.md) | Logo usage, favicon, decorative motifs |
| [03-shell.md](./03-shell.md) | AppShell, sidebar, header, RTL |
| [04-components.md](./04-components.md) | Buttons, cards, tables, badges, forms, KPIs |
| [05-surfaces.md](./05-surfaces.md) | Login, dashboard, bookings, invoices, emails |
| [06-implementation.md](./06-implementation.md) | File map, hardcoded sweep, branding seed, order |

## Shared principles

- **Tokens first.** No new raw hex in feature pages. Use CSS variables or Mantine `theme.colors`.
- **Product chrome is platform.** Navy sidebar, sand canvas, gold active state belong to the product. Agency `primary_color` does not recolor the sidebar.
- **Logos are composed, not pasted.** Source PNGs have a black background. Header/login use the emblem in a light disc plus live Tajawal text (see spec 02).
- **Arabic first.** Tajawal stays. RTL layout is unchanged. French uses the same family.
- **Gold is scarce.** Gold = selected, money, “Pro”. Not every button.
- **Keep structure.** This restyle does not add/remove routes, KPIs, or table columns. It changes look.
- **Copy is AR + FR**, same as the rest of the app.
- Super Admin branding (`/api/public/branding`) still overrides `primary_color` / `accent_color` / logos after this restyle ships.

## Who sees which brand

| Surface | Skin |
|---|---|
| Login, Super Admin chrome, platform emails | Platform (this restyle + branding settings) |
| Agency workspace chrome (sidebar/header shape) | This restyle |
| Agency CTAs / links / focus | Agency `primary_color` if package has `white_label`, else platform teal |
| Invoices / PDFs | Agency name + logo; platform mark if white-label is off |

## Delivery order

| Phase | What ships | Why first |
|---|---|---|
| 1 | Tokens + Mantine theme + CSS variables | Stops brown leaking the moment pages pick up theme |
| 2 | Shell (navy sidebar, ivory header, logos) | Highest visual impact; one layout file |
| 3 | Login + default branding seed | Public surface + Super Admin “reset” |
| 4 | Cards, tables, badges, KPI tiles | Most screens inherit |
| 5 | Hardcoded hex sweep + emails/invoices | Finish the brown leftovers |

Do not restyle page-by-page before phases 1–2. That recreates the current hex soup.

## Out of scope (whole folder)

- New product features, charts that do not exist yet, extra dashboard widgets
- Dark-mode toggle (navy sidebar is chrome, not a theme switch)
- Custom fonts beyond Tajawal
- Per-agency full CSS / custom domains
- Replacing Lucide icons with custom iconography
- Mobile native apps
