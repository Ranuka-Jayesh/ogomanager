-- Add account username/email column to expenses (if table already exists)
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS account TEXT DEFAULT '';
