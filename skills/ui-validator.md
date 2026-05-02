# UI Validator — ScanServe QR Design Rules

Checklist for every UI change. Fail = do not ship.

## Tags
- [ ] Saturation ≥ 80% — no washed-out or semi-transparent-only backgrounds
- [ ] Full pill radius — `borderRadius: 99` (never a fixed px value less than 99)
- [ ] Glow applied — `boxShadow: \`0 0 8px ${glow}, 0 0 16px ${glow}\``
- [ ] Font: Montserrat Bold (`fontWeight: 800`, `fontFamily: "'Montserrat', system-ui, sans-serif"`)
- [ ] Preserve author case — no `textTransform: "uppercase"` or `"lowercase"`
- [ ] High contrast — fg color must be legible on bg (dark text on light bg, white on dark/saturated)

## Hero Sliders
- [ ] No standalone gradient `div` overlay (no `z-index:5` vignette layer)
- [ ] No backdrop-blur panel — text sits directly on the clean image
- [ ] Text legibility via `textShadow` only: `"0 1px 8px rgba(0,0,0,0.65), 0 2px 20px rgba(0,0,0,0.35)"`

## Cards (Bento)
- [ ] Light mode cards: `#FFFFFF` background (not `var(--bg-surface)`)
- [ ] Dark mode cards: `var(--bg-card)`
- [ ] Apple multi-layer shadow applied (`var(--card-shadow)`)
- [ ] Border radius `R.lg` (24px) for outer panels, `R.md` (20px) for inner thumbnails

## Glassmorphism surfaces (nav / floating panels)
- [ ] `backdropFilter: "blur(20px) saturate(180%)"`
- [ ] Dark: `rgba(11,11,17,0.82)` / Light: `rgba(245,245,247,0.82)`
- [ ] Border: `1px solid var(--border-color)`

## Typography
- [ ] No forced `text-transform: uppercase` on section headings
- [ ] Headings / labels: Montserrat Bold
- [ ] Body: Montserrat (guest menu), Inter (admin)
