-- Payment banks table: stores card transfer requisites per restaurant
-- Run in Supabase SQL Editor

create table if not exists payment_banks (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  bank_name     text not null,
  phone         text not null,
  recipient_name text,
  is_active     boolean not null default true,
  order_index   integer not null default 0,
  created_at    timestamptz not null default now()
);

-- RLS
alter table payment_banks enable row level security;

create policy "Public read active payment_banks"
  on payment_banks for select
  using (is_active = true);

create policy "Admin full access payment_banks"
  on payment_banks for all
  using (true)
  with check (true);

-- Seed: pre-populate from existing hardcoded values
-- Replace the restaurant_id with the actual value from your restaurants table
-- insert into payment_banks (restaurant_id, bank_name, phone, recipient_name, order_index)
-- select id, 'Kaspi.kz', '+7 778 965 13 12', 'Байтанов Ә.', 0 from restaurants where slug = 'as-tori';
-- insert into payment_banks (restaurant_id, bank_name, phone, recipient_name, order_index)
-- select id, 'Halyk Bank', '+7 778 965 13 12', 'Байтанов Ә.', 1 from restaurants where slug = 'as-tori';
