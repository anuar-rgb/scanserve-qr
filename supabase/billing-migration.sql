-- Billing system: subscription plans + payment history
-- Run in Supabase SQL Editor

-- 1. Subscription plans
CREATE TABLE IF NOT EXISTS subscription_plans (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT        NOT NULL,
  monthly_price   INTEGER     NOT NULL DEFAULT 0,
  max_staff       INTEGER     DEFAULT 0,
  max_orders_month INTEGER    DEFAULT 0,
  features        JSONB       DEFAULT '[]',
  is_active       BOOLEAN     DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- 2. Link restaurants to plans
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES subscription_plans(id);

-- 3. Payment history
CREATE TABLE IF NOT EXISTS payment_history (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID        NOT NULL,
  amount          INTEGER     NOT NULL,
  payment_method  TEXT,
  period_start    DATE        NOT NULL,
  period_end      DATE        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'completed'
    CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  notes           TEXT,
  created_by      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_history_restaurant ON payment_history(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_date ON payment_history(created_at DESC);

-- 4. Seed default plans
INSERT INTO subscription_plans (name, monthly_price, max_staff, max_orders_month, features) VALUES
  ('Стартовый', 15000, 5, 500, '["QR-меню", "POS-терминал", "Базовая аналитика"]'),
  ('Стандарт', 30000, 15, 2000, '["QR-меню", "POS-терминал", "Аналитика", "CRM", "Промоакции", "Бонусная программа"]'),
  ('Премиум', 50000, 50, 10000, '["Всё из Стандарт", "Склад", "Мультиязычность", "Приоритетная поддержка", "Безлимит заказов"]')
ON CONFLICT DO NOTHING;
