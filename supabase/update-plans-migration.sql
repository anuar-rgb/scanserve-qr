-- Update pricing plans: Стартовый 5780, Стандарт 15780, add Годовой
-- Run in Supabase SQL Editor

UPDATE subscription_plans SET monthly_price = 5780, max_staff = 7, max_orders_month = 999999 WHERE name = 'Стартовый';
UPDATE subscription_plans SET monthly_price = 15780, max_staff = 15, max_orders_month = 999999 WHERE name = 'Стандарт';

-- Remove old Premium plan
UPDATE subscription_plans SET is_active = false WHERE name = 'Премиум';

-- Add annual plan
INSERT INTO subscription_plans (name, monthly_price, max_staff, max_orders_month, features, is_active)
VALUES (
  'Годовой',
  13098,
  15,
  999999,
  '["Всё из Стандарта","Оплата раз в год","Скидка 17%","Экономия 32 190 ₸","Приоритетная поддержка"]',
  true
)
ON CONFLICT DO NOTHING;
