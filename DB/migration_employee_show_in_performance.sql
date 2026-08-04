-- Migration: show_in_performance on employees (Analytics Employee Performance list)
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS show_in_performance BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN employees.show_in_performance IS 'When true, employee is listed in Analytics Employee Performance';

CREATE INDEX IF NOT EXISTS idx_employees_show_in_performance ON employees(show_in_performance);
