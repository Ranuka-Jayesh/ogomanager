-- Add expenses MoM % to analytics_comparison
ALTER TABLE analytics_comparison
  ADD COLUMN IF NOT EXISTS expenses_change_percentage DECIMAL(6,2);

COMMENT ON COLUMN analytics_comparison.expenses_change_percentage IS
  'Percentage change in business expenses compared to previous month (can be positive or negative)';
