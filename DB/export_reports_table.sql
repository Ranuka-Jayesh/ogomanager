-- =====================================================
-- EXPORT REPORTS TABLE
-- =====================================================
-- This table stores comprehensive PDF export data
-- Records are created when a comprehensive PDF report is exported

CREATE TABLE IF NOT EXISTS export_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    total_revenue DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total_profit DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    completion_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00, -- Percentage (0-100)
    employee_payments DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    top_clients JSONB, -- Stores array of top clients with their data
    -- Example structure: [{"name": "University Name", "revenue": 50000, "count": 5}, ...]
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique combination of year and month
    UNIQUE(year, month)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_export_reports_year ON export_reports(year);
CREATE INDEX IF NOT EXISTS idx_export_reports_month ON export_reports(month);
CREATE INDEX IF NOT EXISTS idx_export_reports_year_month ON export_reports(year, month);
CREATE INDEX IF NOT EXISTS idx_export_reports_created_at ON export_reports(created_at DESC);

-- Add comments to the table and columns
COMMENT ON TABLE export_reports IS 'Stores comprehensive PDF export data for analytics and reporting';
COMMENT ON COLUMN export_reports.id IS 'Unique identifier for the export record';
COMMENT ON COLUMN export_reports.year IS 'Year of the export report';
COMMENT ON COLUMN export_reports.month IS 'Month of the export report (1-12)';
COMMENT ON COLUMN export_reports.total_revenue IS 'Total revenue for the period in LKR';
COMMENT ON COLUMN export_reports.total_profit IS 'Total profit (revenue - employee payments) for the period in LKR';
COMMENT ON COLUMN export_reports.completion_rate IS 'Completion rate percentage (0-100)';
COMMENT ON COLUMN export_reports.employee_payments IS 'Total employee payments for the period in LKR';
COMMENT ON COLUMN export_reports.top_clients IS 'JSON array of top clients with name, revenue, and project count';
COMMENT ON COLUMN export_reports.created_at IS 'Timestamp when the export record was created';
COMMENT ON COLUMN export_reports.updated_at IS 'Timestamp when the export record was last updated';

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_export_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically update updated_at
CREATE TRIGGER trigger_update_export_reports_updated_at
    BEFORE UPDATE ON export_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_export_reports_updated_at();

