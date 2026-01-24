-- Updated Projects Table SQL
-- This table supports multiple project types, fast delivery, and multiple employee assignments

CREATE TABLE IF NOT EXISTS projects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id VARCHAR(20) UNIQUE, -- Project ID like PJ1000
    client_name VARCHAR(255) NOT NULL,
    client_uni_org VARCHAR(255) NOT NULL,
    project_description TEXT NOT NULL, -- This will store comma-separated project type IDs
    deadline_date DATE NOT NULL,
    price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    advance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    balance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    assigned_to TEXT, -- Changed from UUID to TEXT to support comma-separated employee IDs for multiple assignments
    payment_of_emp DECIMAL(10,2) NOT NULL DEFAULT 0.00, -- Total payment for all employees
    employee_payments JSONB DEFAULT '[]'::jsonb, -- NEW: Array of {employeeId, payment} for multiple employee payment breakdown
    status VARCHAR(50) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Running', 'Pending', 'Pending Payment', 'Delivered', 'Correction', 'Rejected')),
    fast_deliver BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create an index on assigned_to for better performance
CREATE INDEX IF NOT EXISTS idx_projects_assigned_to ON projects(assigned_to);

-- Create an index on status for filtering
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- Create an index on deadline_date for sorting
CREATE INDEX IF NOT EXISTS idx_projects_deadline ON projects(deadline_date);

-- Create an index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at);

-- Add comments to the table and columns
COMMENT ON TABLE projects IS 'Stores project information with support for multiple project types, fast delivery, and multiple employee assignments';
COMMENT ON COLUMN projects.id IS 'Unique identifier for the project';
COMMENT ON COLUMN projects.project_id IS 'Human-readable project ID (e.g., PJ1000)';
COMMENT ON COLUMN projects.client_name IS 'Name of the client';
COMMENT ON COLUMN projects.client_uni_org IS 'Client university or organization';
COMMENT ON COLUMN projects.project_description IS 'Comma-separated list of project type IDs';
COMMENT ON COLUMN projects.deadline_date IS 'Project deadline date';
COMMENT ON COLUMN projects.price IS 'Total project price in LKR';
COMMENT ON COLUMN projects.advance IS 'Advance payment amount in LKR';
COMMENT ON COLUMN projects.balance IS 'Remaining balance after advance payment (price - advance)';
COMMENT ON COLUMN projects.assigned_to IS 'Comma-separated employee IDs assigned to this project (supports multiple employees)';
COMMENT ON COLUMN projects.payment_of_emp IS 'Total payment amount for all assigned employees in LKR';
COMMENT ON COLUMN projects.employee_payments IS 'JSONB array storing individual employee payments: [{employeeId: uuid, payment: decimal}, ...]';
COMMENT ON COLUMN projects.status IS 'Current status of the project';
COMMENT ON COLUMN projects.fast_deliver IS 'Whether this is a fast delivery project';
COMMENT ON COLUMN projects.created_at IS 'Timestamp when the project was created';
COMMENT ON COLUMN projects.updated_at IS 'Timestamp when the project was last updated';

-- =====================================================
-- MIGRATION: Add employee_payments column to existing table
-- Run this if you already have a projects table
-- =====================================================
-- ALTER TABLE projects ADD COLUMN IF NOT EXISTS employee_payments JSONB DEFAULT '[]'::jsonb;
-- ALTER TABLE projects ALTER COLUMN assigned_to TYPE TEXT;
-- COMMENT ON COLUMN projects.employee_payments IS 'JSONB array storing individual employee payments: [{employeeId: uuid, payment: decimal}, ...]';
-- COMMENT ON COLUMN projects.assigned_to IS 'Comma-separated employee IDs assigned to this project (supports multiple employees)';

-- Create a function to automatically update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create a trigger to automatically update the updated_at column
CREATE TRIGGER update_projects_updated_at 
    BEFORE UPDATE ON projects 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Sample data insertion (optional - for testing)
-- INSERT INTO projects (
--     client_name,
--     client_uni_org,
--     project_description,
--     deadline_date,
--     price,
--     advance,
--     assigned_to,
--     payment_of_emp,
--     status,
--     fast_deliver
-- ) VALUES (
--     'John Doe',
--     'University of Colombo',
--     '1,2,3', -- Project type IDs separated by commas
--     '2024-12-31',
--     50000.00,
--     15000.00,
--     'your-employee-uuid-here',
--     10000.00,
--     'Pending',
--     false
-- ); 