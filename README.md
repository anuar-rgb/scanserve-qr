# ScanServe QR — Digital Restaurant Menu Platform

A multi-tenant SaaS platform for QR-code restaurant menus. Restaurants get a
branded, mobile-first digital menu that guests access by scanning a QR code —
no app download required.

**Production:** https://scanserve-qr-production.up.railway.app  
**Stack:** Next.js 16 · Supabase · Tailwind CSS v4 · TypeScript · Railway

---

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in Supabase credentials
npm run dev                  # http://localhost:3000
```

### Required env vars

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_RESTAURANT_ID=
```

---

## Architecture

### Routing

| Route | Description |
|-------|-------------|
| `/` | Marketing landing page |
| `/as-tori` | Primary tenant menu (production) |
| `/as-tori/qr` | Printable QR code page |
| `/[tenantSlug]` | Generic multi-tenant menu |
| `/admin` | Admin panel (protected) |
| `/admin/storefront` | Flag products as promo / recommended / new |
| `/admin/banners` | Manage promotional image banners |
| `/admin/branding` | Logo + cover image upload |
| `/admin/catalog` | Product & category CRUD |

### Styling split (important)

| Layer | System | Reason |
|-------|--------|--------|
| Admin panel | Tailwind CSS classes | Rapid development, dark mode via `dark:` |
| Guest menu (`MenuTemplate` + sub-components) | Inline `style` objects | Runtime-themeable via CSS vars, zero Tailwind dependency |
| Landing page | Tailwind + `globals.css` utility classes | — |

### Key directories

```
src/
├── app/                  Next.js App Router pages
│   ├── admin/            Admin panel (each section = subfolder)
│   └── [tenantSlug]/     Dynamic tenant menu
├── components/
│   ├── admin/            Admin-only UI components
│   └── MenuTemplate.tsx  Guest menu (self-contained, inline styles only)
├── constants/            Magic strings: bucket names, table names, IDs
├── services/
│   └── storage.ts        Supabase Storage upload abstraction
├── lib/                  Supabase client, i18n, db-types
├── locales/              en / ru / kz translation JSON
└── data/
    └── as-tori.ts        Static restaurant info for the primary tenant
```

---

## Database schema (Supabase)

| Table | Purpose |
|-------|---------|
| `restaurants` | Tenant registry — `slug`, `name`, `logo`, `cover_url` |
| `categories` | Menu categories per restaurant |
| `products` | Menu items — `is_promo`, `is_recommended`, `is_new`, `is_archived` |
| `banners` | Promotional image banners shown on the home screen |
| `orders` | Guest orders (order history) |

All tables have **RLS enabled**. Policies use `true` condition since the app
runs under the anon key — scope every query by `restaurant_id` in application code.

### Run migrations

Before deploying new features, run the corresponding SQL in **Supabase → SQL Editor**:

| File | What it does |
|------|-------------|
| `supabase/storefront-migration.sql` | Adds `is_promo`/`is_recommended` to products; creates `banners` table |
| `supabase/storage-policies.sql` | Creates `branding`, `banners`, `menu-images` buckets with RLS |

---

## Technical roadmap

### Phase 1 — Core (complete)
- [x] Multi-tenant QR menu with real-time DB data
- [x] Admin panel: branding, catalog, banners, storefront flags
- [x] i18n: EN / RU / KZ
- [x] Dark mode
- [x] Cart + WhatsApp order flow

### Phase 2 — Ordering & Analytics
- [ ] **Orders table UI** — admin sees incoming orders in real time (Supabase Realtime)
- [ ] **Analytics dashboard** — real scan counts, top dishes, revenue from orders
- [ ] **Table QR assignment** — each QR encodes a table number; orders arrive tagged
- [ ] **Order status flow** — pending → preparing → ready → served

### Phase 3 — Growth
- [ ] **Auth overhaul** — move from cookie session to Supabase Auth (per-restaurant login)
- [ ] **Onboarding wizard** — new tenant signup → slug → first menu in < 3 min
- [ ] **Custom domain support** — CNAME per tenant via Railway wildcard
- [ ] **Subscription billing** — Stripe integration for Pro/Enterprise tiers
- [ ] **Waiter app** — lightweight PWA for staff to receive and update orders

### Phase 4 — Platform
- [ ] **Public API** — REST endpoints for POS integration
- [ ] **Webhook system** — push order events to third-party systems
- [ ] **White-label** — tenant-level brand overrides (font, radius, accent color)
- [ ] **shadcn/ui migration** — replace hand-rolled admin components after `npx shadcn@latest init`

---

## shadcn/ui

Not yet installed. To initialize when ready:

```bash
npx shadcn@latest init
# TypeScript · App Router · src/ dir · import alias @/*
```

After init, replace admin UI primitives (Button, Input, Dialog, Switch) with
shadcn components. See Phase 4 roadmap above.

---

## Deployment

Railway auto-deploys on every push to `master`.

```bash
npx tsc --noEmit        # must pass — never commit with TS errors
git push origin master  # triggers Railway deploy
```
