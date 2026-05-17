-- Staff Management helpers
-- Run this in Supabase SQL Editor after staff-users-migration.sql

-- ─── update_staff_password ────────────────────────────────────────────────────
-- Called by the reset-password API route (server-side, service role key).
-- Returns true on success, false if user not found.

create or replace function update_staff_password(
  p_id            uuid,
  p_restaurant_id uuid,
  p_new_password  text
)
returns boolean language plpgsql security definer as $$
begin
  update staff_users
  set    password_hash = crypt(p_new_password, gen_salt('bf', 10)),
         updated_at    = now()
  where  id            = p_id
    and  restaurant_id = p_restaurant_id;
  return found;
end;
$$;
