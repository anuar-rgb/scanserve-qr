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

## Design System

### Typography
- **Headings / labels**: Montserrat Bold — loaded via `next/font/google` with `latin` + `cyrillic` subsets
- **Body text**: Inter (admin/landing), Montserrat (guest menu)
- No forced `text-transform: lowercase` — use natural case everywhere

### Spacing & Radius
- `R = { sm: 10, md: 20, lg: 24, full: 999 }` — defined in every component
- Standard card radius: **24px** (R.lg) for bento-style panels, **20px** (R.md) for inner cards/thumbnails
- Hero slider bottom corners: `borderRadius: "0 0 24px 24px"`

### Color Palette
- **Light bg**: `#F5F5F7` (Apple-style soft gray)
- **Light card**: `#FFFFFF` with multi-layer shadow
- **Dark bg**: `#111111`, **Dark card**: `#1E1E1E`
- Accent tones: Soft Amber `#F59E0B`, Slate blue `#0EA5E9`, Violet `#8B5CF6`, Emerald `#10B981`

### Shadows (Apple / multi-layer)
- **Light**: `0 1px 1px rgba(0,0,0,0.03), 0 2px 8px rgba(0,0,0,0.05), 0 8px 24px rgba(0,0,0,0.06)`
- **Dark**: `0 1px 2px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.3), 0 16px 40px rgba(0,0,0,0.15)`

### Glassmorphism
Use on: floating navigation panels (header on scroll, bottom nav, category pill strip).  
**Do NOT use large backdrop-blur panels inside sliders.** Slider text sits directly on the image with a subtle vignette + `textShadow` for readability.

```css
/* Navigation / floating panels */
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
Vibrant neon/saturated pairs — saturation ≥ 80%, full pill radius (`borderRadius: 99`), glow via `boxShadow`.  
Font: Montserrat Bold (`fontWeight: 800`). Preserve author case — no `textTransform`.

| Key    | bg        | fg        | glow                         |
|--------|-----------|-----------|------------------------------|
| white  | rgba(255,255,255,0.22) | #fff    | rgba(255,255,255,0.25)       |
| yellow | #F59E0B   | #1C0F00   | rgba(245,158,11,0.55)        |
| green  | #00C882   | #001A0F   | rgba(0,200,130,0.55)         |
| red    | #FF4D6D   | #fff      | rgba(255,77,109,0.55)        |
| blue   | #00AAFF   | #fff      | rgba(0,170,255,0.55)         |
| orange | #FF6B2B   | #fff      | rgba(255,107,43,0.55)        |
| purple | #A855F7   | #fff      | rgba(168,85,247,0.55)        |

### Bento Grid
- `gap: 12px` between cards
- Category grid: `repeat(auto-fill, minmax(160px, 1fr))`
- No `borderBottom` row separators — every item must live inside a card with radius + shadow

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
