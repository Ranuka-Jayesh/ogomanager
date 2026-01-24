-- Migration: Add employee_payments column for multiple employee assignments
-- Run this SQL on your existing database to add support for multiple employees per project

-- Step 1: Drop the foreign key constraint on assigned_to (REQUIRED)
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_assigned_to_fkey;

-- Step 2: Change assigned_to from UUID to TEXT to support comma-separated IDs
ALTER TABLE projects ALTER COLUMN assigned_to TYPE TEXT USING assigned_to::TEXT;

-- Step 3: Add the employee_payments JSONB column
ALTER TABLE projects ADD COLUMN IF NOT EXISTS employee_payments JSONB DEFAULT '[]'::jsonb;

-- Step 4: Add comments for the columns
COMMENT ON COLUMN projects.employee_payments IS 'JSONB array storing individual employee payments: [{employeeId: uuid, payment: decimal}, ...]';
COMMENT ON COLUMN projects.assigned_to IS 'Comma-separated employee IDs assigned to this project (supports multiple employees)';

-- Step 5: Create index for better query performance on employee_payments
CREATE INDEX IF NOT EXISTS idx_projects_employee_payments ON projects USING GIN (employee_payments);

-- =====================================================
-- SAMPLE DATA STRUCTURE for employee_payments:
-- =====================================================
-- Single employee:
-- employee_payments = [{"employeeId": "uuid-here", "payment": 5000}]
--
-- Multiple employees:
-- employee_payments = [
--   {"employeeId": "uuid-1", "payment": 3000},
--   {"employeeId": "uuid-2", "payment": 2000}
-- ]
--
-- The total of all payments should equal payment_of_emp
-- assigned_to should contain comma-separated IDs: "uuid-1,uuid-2"

-- =====================================================
-- VERIFICATION: Check if migration was successful
-- =====================================================
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'projects' 
-- AND column_name IN ('assigned_to', 'employee_payments');
