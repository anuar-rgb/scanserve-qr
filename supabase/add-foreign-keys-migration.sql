-- ─────────────────────────────────────────────────────────────────────────────
-- Foreign Key Integrity Migration
-- Adds missing FK constraints across all tables.
-- Safe to re-run: every statement is wrapped in an IF NOT EXISTS check.
-- Run in: Supabase Dashboard → SQL Editor → New query
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. categories.restaurant_id → restaurants.id ──────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_categories_restaurant'
  ) THEN
    ALTER TABLE categories
      ADD CONSTRAINT fk_categories_restaurant
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ── 2. products.restaurant_id → restaurants.id ────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_products_restaurant'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT fk_products_restaurant
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ── 3. products.category_id → categories.id ───────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_products_category'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT fk_products_category
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── 4. hero_slides.restaurant_id → restaurants.id ─────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_hero_slides_restaurant'
  ) THEN
    ALTER TABLE hero_slides
      ADD CONSTRAINT fk_hero_slides_restaurant
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ── 5. staff_users.restaurant_id → restaurants.id ─────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_staff_users_restaurant'
  ) THEN
    ALTER TABLE staff_users
      ADD CONSTRAINT fk_staff_users_restaurant
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ── 6. shifts.restaurant_id → restaurants.id ──────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_shifts_restaurant'
  ) THEN
    ALTER TABLE shifts
      ADD CONSTRAINT fk_shifts_restaurant
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ── 7. invoices.restaurant_id → restaurants.id ────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_invoices_restaurant'
  ) THEN
    ALTER TABLE invoices
      ADD CONSTRAINT fk_invoices_restaurant
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ── 8. info_showcases.restaurant_id → restaurants.id ──────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_info_showcases_restaurant'
  ) THEN
    ALTER TABLE info_showcases
      ADD CONSTRAINT fk_info_showcases_restaurant
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ── 9. orders.shift_id → shifts.id ────────────────────────────────────────
-- shift_id is nullable: old orders have no shift, so ON DELETE SET NULL.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_orders_shift'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT fk_orders_shift
      FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── 10. reviews.order_id → orders.id ──────────────────────────────────────
-- Both orders.id and reviews.order_id are TEXT in the original schema.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_reviews_order'
  ) THEN
    ALTER TABLE reviews
      ADD CONSTRAINT fk_reviews_order
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ── 11. restaurant_tables.restaurant_id → restaurants.id ──────────────────
-- restaurant_tables was created with restaurant_id as TEXT (legacy).
-- Step 1: convert TEXT → UUID safely.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'restaurant_tables'
      AND column_name  = 'restaurant_id'
      AND data_type    = 'text'
  ) THEN
    ALTER TABLE restaurant_tables
      ALTER COLUMN restaurant_id TYPE UUID USING restaurant_id::UUID;
  END IF;
END $$;

-- Step 2: add FK now that types match.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_restaurant_tables_restaurant'
  ) THEN
    ALTER TABLE restaurant_tables
      ADD CONSTRAINT fk_restaurant_tables_restaurant
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ── NOTE: orders.restaurant_id and reviews.restaurant_id ──────────────────
-- These columns were created as TEXT in the original schema while
-- restaurants.id is UUID. PostgreSQL forbids FK between incompatible types.
-- These tables are high-traffic; a type migration requires a separate,
-- carefully tested ALTER TABLE … USING cast during a maintenance window.
-- All other restaurant_id columns are now properly constrained above.
