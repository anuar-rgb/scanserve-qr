-- Multi-tenant login: finds staff by username across all restaurants (no restaurant_id required)
-- Replaces the old verify_staff_password RPC which required p_restaurant_id from env var.

CREATE OR REPLACE FUNCTION login_staff_global(
  p_username TEXT,
  p_password TEXT
)
RETURNS TABLE(
  id            UUID,
  role          TEXT,
  display_name  TEXT,
  restaurant_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.role,
    s.display_name,
    s.restaurant_id
  FROM staff_users s
  WHERE lower(s.username) = lower(p_username)
    AND s.password_hash = crypt(p_password, s.password_hash);
END;
$$;
