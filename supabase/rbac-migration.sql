-- RBAC: Admin Users Table
-- Run this once in the Supabase SQL Editor.
--
-- This table documents roles for reference and future integrations.
-- Authentication itself uses env vars (OWNER_USERNAME/PASSWORD, ADMIN_USERNAME/PASSWORD).
--
-- Roles:
--   owner  → full access: analytics, profit overview, catalog, settings, POS
--   admin  → restricted: Hall, Invoices only (operational staff)

create table if not exists admin_users (
  id          uuid primary key default gen_random_uuid(),
  username    text not null unique,
  role        text not null check (role in ('owner', 'admin')),
  display_name text,
  created_at  timestamptz not null default now()
);

-- Example rows (do NOT store real passwords here; auth is via env vars)
-- insert into admin_users (username, role, display_name) values
--   ('owner_login',  'owner', 'Владелец'),
--   ('cashier1',     'admin', 'Кассир 1');

-- No RLS needed — this table is read only by server-side API routes
-- that already verify the admin_session cookie.
