-- Migration: extend staff_users role check constraint
-- Run in Supabase SQL Editor

ALTER TABLE staff_users
  DROP CONSTRAINT IF EXISTS staff_users_role_check;

ALTER TABLE staff_users
  ADD CONSTRAINT staff_users_role_check
  CHECK (role IN (
    'owner', 'manager', 'cashier', 'waiter', 'chef',
    'bartender', 'hostess', 'courier', 'cleaner', 'doorman',
    'sommelier', 'senior_waiter', 'runner', 'storekeeper', 'accountant'
  ));
