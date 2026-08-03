-- Migration: Add Give Discount support to projects
-- Run this in Supabase SQL Editor

-- Add give_discount flag (checkbox)
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS give_discount BOOLEAN DEFAULT FALSE;

-- Add discount amount in LKR
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00;

-- Comments
COMMENT ON COLUMN projects.give_discount IS 'Whether a discount was given on this project';
COMMENT ON COLUMN projects.discount_amount IS 'Discount amount in LKR (used when give_discount is true)';

-- Optional index if you filter discounted projects often
CREATE INDEX IF NOT EXISTS idx_projects_give_discount ON projects(give_discount);

-- Recalculate balances for existing discounted rows (safe even if none yet)
-- balance = price - advance - discount_amount (when give_discount)
UPDATE projects
SET balance = GREATEST(
  price - advance - CASE WHEN give_discount THEN COALESCE(discount_amount, 0) ELSE 0 END,
  0
),
updated_at = NOW()
WHERE give_discount = TRUE;
