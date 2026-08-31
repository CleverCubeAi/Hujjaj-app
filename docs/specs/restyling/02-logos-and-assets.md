# Spec 02 — Logos and assets

**Owner:** Engineering  
**Phase:** 2–3  
**Depends on:** [01-brand-system.md](./01-brand-system.md)  
**Visual source:** [assets/logo-lockup-horizontal.png](./assets/logo-lockup-horizontal.png), [assets/logo-stacked.png](./assets/logo-stacked.png)

## Goal

Ship the new mark everywhere the product currently shows a name, Vite favicon, or no logo. Super Admin can still replace files via platform branding; these are the **bundled fallbacks**.

## Files

| Repo path | Role |
|---|---|
| `docs/specs/restyling/assets/logo-lockup-horizontal.png` | Spec + source |
| `docs/specs/restyling/assets/logo-stacked.png` | Spec + source |
| `frontend/src/assets/brand/logo-lockup-horizontal.png` | Bundled fallback (header / compact) |
| `frontend/src/assets/brand/logo-stacked.png` | Bundled fallback (login) |

## Black backgrounds

Both source PNGs sit on **solid black**. They are not transparent lockups.

- Login uses the **stacked** PNG on a black/navy band so the artboard matches the screens.
- Do not place the raw PNG on ivory, sand, or white.
- Header (later) uses the horizontal lockup on navy, or a composed mark + live text.

## Component

`frontend/src/components/brand/BrandLogo.tsx`

| Prop | Values | Default |
|---|---|---|
| `variant` | `stacked` \| `horizontal` | `stacked` |
| `height` | number (px) | 180 stacked / 36 header |
| `src` | optional URL | bundled asset |
| `alt` | string | product name |

Image source order: `src` / `branding.logo_url` → bundled PNG.

## Login (shipped)

See [05-surfaces.md](./05-surfaces.md). The login card header is black with the stacked logo from the shared screens. Ivory form below, gold hairline, deep teal submit.

## Where each variant goes

| Surface | Variant |
|---|---|
| Login | `stacked` on black band |
| Super Admin header | `horizontal` (later) |
| Agency header | Agency `logo_url` if set |
| Favicon | later; not Vite |

## Acceptance

- Login shows the stacked brand from the provided screens, without a black box on ivory.
- Replacing `logo_url` in branding settings still wins (image on ivory, smaller).
