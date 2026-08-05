-- Migration: catalog of subscription / expense products (admin-managed)
-- Run in Supabase SQL editor after expense_logos bucket exists

CREATE TABLE IF NOT EXISTS expense_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category VARCHAR(40) NOT NULL DEFAULT 'Other'
    CHECK (category IN ('AI Tools', 'Marketing', 'Print', 'Software', 'Office', 'Other')),
  image_url TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expense_products_name ON expense_products (name);
CREATE INDEX IF NOT EXISTS idx_expense_products_category ON expense_products (category);

COMMENT ON TABLE expense_products IS 'Admin-defined products selectable when adding expenses';
COMMENT ON COLUMN expense_products.image_url IS 'Public URL of product logo in expense-logos bucket';

-- Optional link from an expense entry back to catalog product
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES expense_products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_product_id ON expenses (product_id);
