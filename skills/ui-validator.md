# UI Validator — ScanServe QR Design Rules

Checklist for every UI change. Fail = do not ship.

## Tags (Badges)
- [ ] Solid background only — no gradients, no `backdrop-filter`, no `linear-gradient`, no `rgba()` with alpha < 1
- [ ] 100% opaque — every `bg` value in TAG_COLOR_MAP must be a hex color, never rgba
- [ ] Full pill radius — `borderRadius: 99` (never a fixed px value less than 99)
- [ ] No `boxShadow` / glow on tags — clean flat appearance
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
- [ ] **No `boxShadow`** — cards must be flat. `--card-shadow` is `"none"`.
- [ ] Separation via `border: 1px solid var(--border-color)` only — never a shadow
- [ ] Border radius `R.lg` (24px) for outer panels, `R.md` (20px) for inner thumbnails

## Glassmorphism surfaces (nav / floating panels)
- [ ] `backdropFilter: "blur(20px) saturate(180%)"`
- [ ] Dark: `rgba(11,11,17,0.82)` / Light: `rgba(245,245,247,0.82)`
- [ ] Border: `1px solid var(--border-color)`

## Typography
- [ ] No forced `text-transform: uppercase` on section headings
- [ ] Headings / labels: Montserrat Bold
- [ ] Body: Montserrat (guest menu), Inter (admin)

## Layout (hard rules — any violation = do not ship)
- [ ] `html` and `body` both have `overflow-x: hidden` in `globals.css` — never remove
- [ ] All `position: fixed` panels use symmetric `left` + `right` (not `left` + `width`)
- [ ] No element causes horizontal overflow — test by scrolling right on mobile
