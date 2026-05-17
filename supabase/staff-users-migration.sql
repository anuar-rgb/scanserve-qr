-- Staff Users Migration
-- Multi-tenant auth: each business has its own staff with individual logins.
-- Run this in Supabase SQL Editor.
--
-- Roles:
--   owner    → full access (analytics, financials, catalog, settings, POS)
--   manager  → analytics + POS, no settings/billing
--   cashier  → Hall + Invoices only
--   waiter   → Hall view only (future)
--   chef     → Kitchen view only (future)

-- Extension for password hashing (pgcrypto ships with Supabase by default)
create extension if not exists pgcrypto;

-- ─── staff_users ─────────────────────────────────────────────────────────────

create table if not exists staff_users (
  id              uuid primary key default gen_random_uuid(),
  restaurant_id   uuid not null,
  username        text not null,
  password_hash   text not null,          -- bcrypt via pgcrypto
  role            text not null check (role in ('owner', 'manager', 'cashier', 'waiter', 'chef')),
  display_name    text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (restaurant_id, username)        -- username unique per business
);

-- Index for fast login lookup
create index if not exists idx_staff_users_lookup
  on staff_users (restaurant_id, username)
  where is_active = true;

-- Auto-update updated_at
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger staff_users_updated_at
  before update on staff_users
  for each row execute function set_updated_at();

-- ─── Helper: create a staff user with hashed password ────────────────────────
-- Usage:
--   select create_staff_user(
--     '<restaurant_id>',
--     'owner_login',
--     'your_password',
--     'owner',
--     'Владелец'
--   );

create or replace function create_staff_user(
  p_restaurant_id uuid,
  p_username      text,
  p_password      text,
  p_role          text,
  p_display_name  text default null
)
returns uuid language plpgsql security definer as $$
declare
  v_id uuid;
begin
  insert into staff_users (restaurant_id, username, password_hash, role, display_name)
  values (
    p_restaurant_id,
    p_username,
    crypt(p_password, gen_salt('bf', 10)),
    p_role,
    p_display_name
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- ─── Helper: verify password (returns role or null) ───────────────────────────
-- Usage:
--   select verify_staff_password('<restaurant_id>', 'username', 'password');

create or replace function verify_staff_password(
  p_restaurant_id uuid,
  p_username      text,
  p_password      text
)
returns table(id uuid, role text, display_name text) language plpgsql security definer as $$
begin
  return query
  select s.id, s.role, s.display_name
  from staff_users s
  where s.restaurant_id = p_restaurant_id
    and s.username      = p_username
    and s.is_active     = true
    and s.password_hash = crypt(p_password, s.password_hash);
end;
$$;

-- ─── No RLS needed ────────────────────────────────────────────────────────────
-- This table is accessed only by server-side API routes that already
-- verify the admin_session cookie. Direct client access is blocked by
-- Supabase anon key not having insert/update/delete privileges.
