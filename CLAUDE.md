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
