@AGENTS.md

# Project: ScanServe QR — Digital Restaurant Menu

## Key commands

| Task | Command |
|------|---------|
| Dev server | `npm run dev` → http://localhost:3000 |
| Type check | `npx tsc --noEmit` |
| Build | `npm run build` |
| Lint | `npm run lint` |

**Always run `npx tsc --noEmit` before committing.**

## Routes

| URL | What it is |
|-----|-----------|
| `/as-tori` | Main restaurant menu (production tenant) |
| `/as-tori/qr` | QR code page for printing |
| `/[tenantSlug]` | Generic multi-tenant demo page |

## Deployment

- Git remote: `origin master`
- Hosted on Railway — auto-deploys on every `git push origin master`
- Production URL: `https://scanserve-qr-production.up.railway.app`

## Architecture

- **Framework**: Next.js 16 App Router, all UI components are `"use client"`
- **Styling**: Inline `style` objects only — no Tailwind, no CSS modules
- **Design tokens**: `SP` (spacing) and `R` (border-radius) defined in each component
- **Theme**: CSS variables (`--bg-color`, `--text-color`, etc.) toggled via `DARK_VARS` / `LIGHT_VARS` in `MenuTemplate.tsx`
- **Restaurant data**: `src/data/as-tori.ts` — edit this to change menu, prices, phone numbers

## Key files

| File | Purpose |
|------|---------|
| `src/components/MenuTemplate.tsx` | Main page template (banner, header overlay, category pills, dish cards) |
| `src/components/CartDrawer.tsx` | Cart + checkout drawer, WhatsApp order sending |
| `src/components/BottomNav.tsx` | Fixed bottom navigation bar |
| `src/components/WaiterModal.tsx` | Call-waiter bottom sheet |
| `src/data/as-tori.ts` | Restaurant info, menu categories, payment options |
| `src/app/as-tori/page.tsx` | Page entry point — passes `heroBanner` and restaurant data |

## Layout Rules (non-negotiable)

- **`overflow-x: hidden` on both `html` and `body`** — set in `globals.css`. Never remove. Horizontal scroll is forbidden everywhere.
- **All fixed panels (header, BottomNav, drawers) use symmetric `left`+`right` formulas** — never `left+width` alone, which can overflow on the right.
- **Centering formula for fixed panels**: `left/right: "max(calc(50vw - Npx), Mpx)"` where N = half max-width minus margin, M = minimum margin.
- Header: N=232, M=8 (8px margins, 464px max). BottomNav: N=240, M=0 (edge-to-edge, 480px max).

## Design System

### Typography
- **Headings / labels**: Montserrat Bold — loaded via `next/font/google` with `latin` + `cyrillic` subsets
- **Body text**: Inter (admin/landing), Montserrat (guest menu)
- No forced `text-transform: lowercase` — use natural case everywhere

### Spacing & Radius
- `R = { sm: 10, md: 20, lg: 24, full: 999 }` — defined in every component
- Standard card radius: **24px** (R.lg) for bento-style panels, **20px** (R.md) for inner cards/thumbnails
- Hero slider bottom corners: `borderRadius: "0 0 24px 24px"`
- **Hero slider height**: `SLIDER_H = "min(485px, 133vw)"` — ~485px on all phones. Defined as a constant in MenuTemplate.tsx and applied to both the main slider and the fallback. Do not change without updating both.

### Color Palette
- **Light bg**: `#F5F5F7` (Apple-style soft gray)
- **Light card**: `#FFFFFF` — flat, no shadow
- **Dark bg**: `#111111`, **Dark card**: `#1E1E1E` — flat, no shadow
- Accent tones: Soft Amber `#F59E0B`, Slate blue `#0EA5E9`, Violet `#8B5CF6`, Emerald `#10B981`

### Shadows
**Cards must be flat — no box-shadow, no gradients.**
- `--card-shadow` is set to `"none"` in both DARK_VARS and LIGHT_VARS.
- Content cards (dish cards, category cards, info cards) use `border: 1px solid var(--border-color)` for separation — no shadow.
- Only floating UI panels (header, bottom nav, dropdowns, modals) may carry a shadow.

### Glassmorphism
Use on: floating navigation panels (fixed header, bottom nav, category pill strip).  
**Do NOT use large backdrop-blur panels inside sliders.** Slider text sits directly on the image with a subtle vignette + `textShadow` for readability.

#### Fixed header — Floating Glass Panel (always on)
The header is a **floating pill panel** — it never touches the screen edges.
```css
/* Floating, rounded, always-on glass */
position: fixed;
top: 8px;                                /* floats 8px from top */
left: max(calc(50vw - 232px), 8px);      /* 8px side margins    */
width: min(calc(100vw - 16px), 464px);
border-radius: 24px;                     /* R.lg — all corners  */
backdrop-filter: blur(14px) saturate(160%);
-webkit-backdrop-filter: blur(14px) saturate(160%);
background: rgba(11, 11, 17, 0.72);      /* dark  — 72% opacity */
background: rgba(245, 245, 247, 0.70);   /* light — 70% opacity */
border: 1px solid var(--border-color);   /* full perimeter glass edge */
box-shadow: 0 4px 24px rgba(0,0,0,0.35); /* dark  */
box-shadow: 0 4px 24px rgba(0,0,0,0.10); /* light */
```
`HEADER_H = 80` (64px height + 8px top gap + 8px clearance below).

#### Bottom nav / pill strip — Full Glass
```css
backdrop-filter: blur(20px) saturate(180%);
-webkit-backdrop-filter: blur(20px) saturate(180%);
background: rgba(11, 11, 17, 0.82); /* dark mode */
background: rgba(245, 245, 247, 0.82); /* light mode */
border-bottom: 1px solid var(--border-color);
```

```css
/* Slider text shadow for legibility — the ONLY overlay allowed */
text-shadow: 0 1px 8px rgba(0,0,0,0.65), 0 2px 20px rgba(0,0,0,0.35);
```

**Slider immersion rule**: Sliders must be fully immersive — no background gradients, no vignette layers (no standalone `div` at `z-index:5`), no backdrop-blur panels. Text sits directly on the clean image, readable only via `textShadow`.

### Tag Palette (`TAG_COLOR_MAP`)
**Rule: Tags (Badges) always use solid background — no gradients, no glassmorphism, no box-shadow/glow.**  
Saturation ≥ 80%, full pill radius (`borderRadius: 99`). Font: Montserrat Bold (`fontWeight: 800`). Preserve author case — no `textTransform`.

| Key    | bg                     | fg      |
|--------|------------------------|---------|
| white  | #FFFFFF                | #111111 |
| yellow | #F59E0B                | #1C0F00 |
| green  | #00C882                | #001A0F |
| red    | #FF4D6D                | #fff    |
| blue   | #00AAFF                | #fff    |
| orange | #FF6B2B                | #fff    |
| purple | #A855F7                | #fff    |

### Bento Grid
- `gap: 12px` between cards
- Category grid: `repeat(auto-fill, minmax(160px, 1fr))`
- No `borderBottom` row separators — every item must live inside a card with radius + border

### Banners / Cards — flat style rule
**Banners and cards must be flat: no `linear-gradient` backgrounds, no `box-shadow`.**
- Background: solid `#FFFFFF` (light) or `var(--bg-card)` (dark)
- Separation: `border: 1px solid rgba(0,0,0,0.10)` (light) or `1px solid var(--border-color)` (dark)
- For text on photo banners: use a small `rgba(0,0,0,0.52)` solid-background pill — never a full-width gradient overlay

### Quick Actions Row
A horizontal scrolling row of 3 pill buttons ("Доставка", "Предзаказ", "Забронировать стол") placed at the top of the home view, above `BannerSlider`. Each pill opens a pre-filled WhatsApp message.
- Component: `QuickActionsRow` — accepts `lang`, `theme`, `whatsappPhone`
- Style: `borderRadius: R.full`, solid white bg (light) / card bg (dark), 1px border, Montserrat 13px Bold, no shadow

### Layout — no overflow
- `html` and `body` both have `overflow-x: hidden` in `globals.css` — never remove
- Horizontal scrollers (BannerSlider, QuickActionsRow) use negative margin bleed: `marginLeft/Right: -SP.md` + `paddingLeft/Right: SP.md` — keeps content flush without causing page overflow

---

## Navigation — Deep Linking

| Function | What it does |
|----------|-------------|
| `goHome()` | → home view, resets all state |
| `goToCatalogGrid()` | → catalog category grid |
| `goToCatalogCategory(catId)` | → catalog, opens that category, scrolls to top |
| `goToDish(dishId)` | → catalog, opens the dish's category, scrolls to `#dish-{dishId}` |
| `goToMenuSection(catId)` | → menu list view, scrolls to that section |

### `goToDish` implementation pattern
- Finds the category containing the dish via `categories.find(c => c.dishes.some(d => d.id === dishId))`
- Sets `view="catalog"`, `activeCatId`, and `scrollToDishId`
- A `useEffect` watches `[view, activeCatId, scrollToDishId]` and after 100 ms queries `document.getElementById("dish-{dishId}")` to scroll to it
- Every `CatalogDishCard` must have `id={`dish-${dish.id}`}` on its root element

### Section header style rule
Section headings (e.g., "Популярные блюда", "Акции и спецпредложения") use **plain Montserrat Bold text only** — no emoji or icons next to the title. The decorative left-border accent (3px pill) and horizontal rule are kept; icons/emoji are removed.

---

## Platform Footer

A "Powered by scanserve.qr" footer is rendered at the bottom of every view (home, catalog, menu) inside `<main>`, above the bottom nav clearance padding.

- Font: Montserrat, 12px, `fontWeight: 500`
- Color: `var(--text-muted)` — automatically adapts to dark/light theme
- "scanserve.qr" is an `<a>` linking to `https://scanserve.qr` (target `_blank`, rel `noopener noreferrer`)
- No horizontal overflow — centered with `textAlign: "center"`
- Clearance from BottomNav is provided by the existing `paddingBottom` on `<main>` (140px home/catalog, 190px menu)

---

## Git workflow

```bash
git add src/components/SomeFile.tsx
git commit -m "$(cat <<'EOF'
type: short description

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
git push origin master
```
