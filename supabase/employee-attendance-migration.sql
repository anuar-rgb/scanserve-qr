-- Табель учёта рабочего времени сотрудников
-- Run in: Supabase Dashboard → SQL Editor → New query

CREATE TABLE IF NOT EXISTS employee_attendance (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID        NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
  restaurant_id UUID        NOT NULL,
  check_in      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  check_out     TIMESTAMPTZ,
  total_hours   NUMERIC(5, 2),
  status        TEXT        NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'completed')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ea_restaurant_checkin
  ON employee_attendance (restaurant_id, check_in DESC);

CREATE INDEX IF NOT EXISTS idx_ea_employee_checkin
  ON employee_attendance (employee_id, check_in DESC);

CREATE INDEX IF NOT EXISTS idx_ea_status
  ON employee_attendance (employee_id, status);

-- Prevent duplicate active sessions per employee
CREATE UNIQUE INDEX IF NOT EXISTS idx_ea_one_active_per_employee
  ON employee_attendance (employee_id)
  WHERE status = 'active';
