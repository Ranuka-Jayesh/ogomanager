-- Migration: business expenses (subscriptions + one-time)
-- Run in Supabase SQL editor

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  account TEXT DEFAULT '',
  amount DECIMAL(12,2) NOT NULL CHECK (amount >= 0),
  category VARCHAR(40) NOT NULL DEFAULT 'Other'
    CHECK (category IN ('AI Tools', 'Marketing', 'Print', 'Software', 'Office', 'Other')),
  type VARCHAR(20) NOT NULL DEFAULT 'one_time'
    CHECK (type IN ('subscription', 'one_time')),
  billing_cycle VARCHAR(20)
    CHECK (billing_cycle IS NULL OR billing_cycle IN ('monthly', 'yearly')),
  start_date DATE,
  next_renewal_date DATE,
  expense_date DATE,
  reminder_days_before INTEGER NOT NULL DEFAULT 5 CHECK (reminder_days_before >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'cancelled', 'paid')),
  notes TEXT DEFAULT '',
  payment_method VARCHAR(40) DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_type ON expenses(type);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);
CREATE INDEX IF NOT EXISTS idx_expenses_next_renewal ON expenses(next_renewal_date);
CREATE INDEX IF NOT EXISTS idx_expenses_expense_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);

COMMENT ON TABLE expenses IS 'Subscriptions and one-time business expenses';
