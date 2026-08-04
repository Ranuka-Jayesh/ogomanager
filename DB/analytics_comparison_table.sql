-- =====================================================
-- ANALYTICS COMPARISON TABLE
-- =====================================================
-- This table stores month-over-month percentage comparison data
-- Records are created when a report is exported to track trends

CREATE TABLE IF NOT EXISTS analytics_comparison (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    revenue_change_percentage DECIMAL(6,2), -- Percentage change in revenue vs previous month
    profit_change_percentage DECIMAL(6,2), -- Percentage change in profit vs previous month
    profit_margin_change_percentage DECIMAL(6,2), -- Percentage change in profit margin vs previous month
    employee_payments_change_percentage DECIMAL(6,2), -- Percentage change in employee payments vs previous month
    expenses_change_percentage DECIMAL(6,2), -- Percentage change in business expenses vs previous month
    unique_clients_change_percentage DECIMAL(6,2), -- Percentage change in unique clients vs previous month
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique combination of year and month
    UNIQUE(year, month)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_analytics_comparison_year ON analytics_comparison(year);
CREATE INDEX IF NOT EXISTS idx_analytics_comparison_month ON analytics_comparison(month);
CREATE INDEX IF NOT EXISTS idx_analytics_comparison_year_month ON analytics_comparison(year, month);
CREATE INDEX IF NOT EXISTS idx_analytics_comparison_created_at ON analytics_comparison(created_at DESC);

-- Add comments to the table and columns
COMMENT ON TABLE analytics_comparison IS 'Stores month-over-month percentage comparison data for analytics metrics';
COMMENT ON COLUMN analytics_comparison.id IS 'Unique identifier for the comparison record';
COMMENT ON COLUMN analytics_comparison.year IS 'Year of the comparison record';
COMMENT ON COLUMN analytics_comparison.month IS 'Month of the comparison record (1-12)';
COMMENT ON COLUMN analytics_comparison.revenue_change_percentage IS 'Percentage change in total revenue compared to previous month (can be positive or negative)';
COMMENT ON COLUMN analytics_comparison.profit_change_percentage IS 'Percentage change in total profit compared to previous month (can be positive or negative)';
COMMENT ON COLUMN analytics_comparison.profit_margin_change_percentage IS 'Percentage change in profit margin compared to previous month (can be positive or negative)';
COMMENT ON COLUMN analytics_comparison.employee_payments_change_percentage IS 'Percentage change in employee payments compared to previous month (can be positive or negative)';
COMMENT ON COLUMN analytics_comparison.expenses_change_percentage IS 'Percentage change in business expenses compared to previous month (can be positive or negative)';
COMMENT ON COLUMN analytics_comparison.unique_clients_change_percentage IS 'Percentage change in unique clients count compared to previous month (can be positive or negative)';
COMMENT ON COLUMN analytics_comparison.created_at IS 'Timestamp when the comparison record was created';
COMMENT ON COLUMN analytics_comparison.updated_at IS 'Timestamp when the comparison record was last updated';

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_analytics_comparison_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically update updated_at
CREATE TRIGGER trigger_update_analytics_comparison_updated_at
    BEFORE UPDATE ON analytics_comparison
    FOR EACH ROW
    EXECUTE FUNCTION update_analytics_comparison_updated_at();

