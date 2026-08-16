# Spec 03 — Shell and navigation

**Owner:** Engineering  
**Phase:** 2  
**Depends on:** [01-brand-system.md](./01-brand-system.md), [02-logos-and-assets.md](./02-logos-and-assets.md)  
**Visual source:** [assets/reference-dashboard.png](./assets/reference-dashboard.png)  
**Layout files:** `DashboardLayout.tsx`, `Sidebar.tsx`

## Goal

The chrome matches the target mock: **navy sidebar**, **ivory header**, **sand main**. Routes, groups, and roles stay as they are.

## Current gaps

- `AppShell` header 56px, navbar 220px, all cream/ivory with brown borders
- Navbar `borderLeft` assumes RTL; color is `#E8DFD0`
- Main `backgroundColor: '#F5EFE6'`
- Header logo 36px; brown `ActionIcon` / `Avatar` / `Burger`
- Sidebar `NavLink` radius 6, no gold active pill, icons via `rightSection` (correct for RTL)
- No sidebar footer art
- No header search (mock has one — **do not add** a fake search that does nothing)

## Layout measurements

| Part | Target |
|---|---|
| Header height | 64px (up from 56) |
| Navbar width | 248px (up from 220) so Arabic labels + icon breathe |
| Navbar collapse | unchanged (`sm`) |
| Main padding | `md` / 20px, canvas `--bg-canvas` |
| Content max width | 1400px unchanged |
| Sidebar item height | ~40px, padding 10px 12px |
| Active item | Gold pill, navy text, 16px radius |

RTL: keep icons on the **inline-end** (`rightSection` in current code). Do not flip the sidebar to the physical left; Mantine `DirectionProvider` already places navbar on the start edge (right in Arabic).

The dashboard mock draws a left sidebar for a LTR screenshot. **Arabic remains RTL.** Physical side follows `dir`.

## Header

Background: `--bg-surface` (`#F8F6F0`). Border: `1px solid --border-color`. No navy header bar — the mock’s header is light, sitting on sand, with optional faint Haram photo (phase 2 optional, see spec 02).

Left/start cluster:

- Super Admin: `BrandLogo variant="horizontal"` (or `logo_url`)
- Agency: agency logo or name in navy 700, 16–18px
- Do not tint the wordmark with `agency.primary_color` when a logo image exists

End cluster (keep order, restyle):

| Control | Style |
|---|---|
| Language switcher | Ivory track, teal selected segment (not `color="brown"`) |
| Notifications | Ghost icon, navy; badge in teal (not gold) |
| Avatar | Radius xl; placeholder color teal |
| Name + role | Name 12px 600 navy; role 11px muted |
| Logout | Ghost, muted → danger on hover |
| Burger | Navy, not `#8B7355` |

Do **not** add a global search input in v1. The mock’s search is decorative unless a real search API exists.

`headerColor` today colors the text logo with primary brown. After restyle, text logo is always navy (or ivory on dark). Primary color is for CTAs, not the wordmark.

## Sidebar

| Token | Value |
|---|---|
| Background | `--bg-sidebar` / `#071D35` |
| Border | none (or 1px navy-80); drop the sand border |
| Inactive label | ivory `#F8F6F0` at 88% |
| Inactive icon | ivory 70%, Lucide `strokeWidth={1.5}` |
| Hover | ivory text, background `rgba(248,246,240,0.06)` |
| Active | background `#C99A3D`, color `#071D35`, font-weight 600 |
| Group labels | ivory 50%, 11px, uppercase tracking |
| Dividers | `rgba(248,246,240,0.08)` |

Collapsed groups: chevron in ivory 50%. Expanded children: indent 8px, slightly smaller type (12px), same hover/active rules.

Super Admin nav items (Dashboard, Agencies, Packages, Payments, Settings) use the same active gold pill.

Footer of sidebar:

1. Spacer `flex: 1`
2. Optional gold mosque SVG (spec 02)
3. Do **not** duplicate the user card in the sidebar if it already lives in the header (current app has user in header only — keep that; the Al-Baraka mock’s sidebar avatar is not required)

## Main canvas

```
navbar: navy
header: ivory
main: sand (#EEE9DD)
cards inside pages: ivory
```

`AppShell.Main` padding stays. Page-level `Paper` / `Card` use ivory + `--border-color` + shadow `md`.

## Scrollbar

`index.css` scrollbar thumb is currently `--accent-secondary` brown. Use `--color-teal` on sand track. On the navy sidebar, thumb `rgba(248,246,240,0.25)`.

## Mobile

Burger opens the same navy navbar. Overlay as Mantine default. Header stays 64px. Logo may drop to `mark` only below `sm`.

## Super Admin vs agency

Same shell. Super Admin does not get a different palette. Only the logo/name and the nav tree differ (already the case).

## Acceptance

- Sidebar is navy with gold active pill in both AR and FR.
- Header is ivory; main is sand.
- No brown leftover in `DashboardLayout` / `Sidebar` / `LanguageSwitcher`.
- RTL: nav icons stay on the reading-end; gold pill still hugs the full row.
- Agency with `primary_color` set does not recolor the sidebar.

## Out of scope

- Rewriting nav IA or adding Dashboard mock items that are not routes (Hotels as top-level, etc.)
- Header search, lantern, live chat icon
- Moving the user block into the sidebar
