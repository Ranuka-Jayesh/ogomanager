-- Updated Projects Table SQL
-- This table supports multiple project types and fast delivery feature

CREATE TABLE IF NOT EXISTS projects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_name VARCHAR(255) NOT NULL,
    client_uni_org VARCHAR(255) NOT NULL,
    project_description TEXT NOT NULL, -- This will store comma-separated project type IDs
    deadline_date DATE NOT NULL,
    price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    advance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    assigned_to UUID REFERENCES employees(id) ON DELETE SET NULL,
    payment_of_emp DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    status VARCHAR(50) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Running', 'Pending', 'Delivered', 'Correction', 'Rejected')),
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
COMMENT ON TABLE projects IS 'Stores project information with support for multiple project types and fast delivery';
COMMENT ON COLUMN projects.id IS 'Unique identifier for the project';
COMMENT ON COLUMN projects.client_name IS 'Name of the client';
COMMENT ON COLUMN projects.client_uni_org IS 'Client university or organization';
COMMENT ON COLUMN projects.project_description IS 'Comma-separated list of project type IDs';
COMMENT ON COLUMN projects.deadline_date IS 'Project deadline date';
COMMENT ON COLUMN projects.price IS 'Total project price in LKR';
COMMENT ON COLUMN projects.advance IS 'Advance payment amount in LKR';
COMMENT ON COLUMN projects.assigned_to IS 'Employee ID assigned to this project';
COMMENT ON COLUMN projects.payment_of_emp IS 'Payment amount for the assigned employee in LKR';
COMMENT ON COLUMN projects.status IS 'Current status of the project';
COMMENT ON COLUMN projects.fast_deliver IS 'Whether this is a fast delivery project';
COMMENT ON COLUMN projects.created_at IS 'Timestamp when the project was created';
COMMENT ON COLUMN projects.updated_at IS 'Timestamp when the project was last updated';

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