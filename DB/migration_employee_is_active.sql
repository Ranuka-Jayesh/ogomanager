-- Migration: add is_active to employees
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN employees.is_active IS 'Whether the employee is active (true) or inactive (false)';

CREATE INDEX IF NOT EXISTS idx_employees_is_active ON employees(is_active);
