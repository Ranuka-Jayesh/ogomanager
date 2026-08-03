-- Migration: employee_payments as a real table with status (no signed amounts)
-- Matches live schema: projects.id = integer, employees.id = uuid

DROP TABLE IF EXISTS employee_payments;

CREATE TABLE employee_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id),
  amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
  paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'partial', 'paid')),
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, employee_id)
);

CREATE INDEX idx_employee_payments_project ON employee_payments(project_id);
CREATE INDEX idx_employee_payments_employee ON employee_payments(employee_id);
CREATE INDEX idx_employee_payments_status ON employee_payments(status);

-- Migrate from JSONB signed amounts (negative = pending, positive = paid)
INSERT INTO employee_payments (project_id, employee_id, amount, status, paid_at)
SELECT
  p.id,
  (ep->>'employeeId')::uuid,
  ABS((ep->>'payment')::numeric),
  CASE
    WHEN (ep->>'payment')::numeric < 0 THEN 'pending'
    ELSE 'paid'
  END,
  CASE
    WHEN (ep->>'payment')::numeric >= 0 THEN COALESCE(p.updated_at, NOW())
    ELSE NULL
  END
FROM projects p
CROSS JOIN LATERAL jsonb_array_elements(
  COALESCE(p.employee_payments, '[]'::jsonb)
) AS ep
WHERE NULLIF(ep->>'employeeId', '') IS NOT NULL
  AND ep->>'payment' IS NOT NULL
ON CONFLICT (project_id, employee_id) DO NOTHING;

-- Fallback: single assignee + payment_of_emp only
INSERT INTO employee_payments (project_id, employee_id, amount, status)
SELECT
  p.id,
  p.assigned_to::uuid,
  ABS(p.payment_of_emp),
  CASE WHEN p.payment_of_emp < 0 THEN 'pending' ELSE 'paid' END
FROM projects p
WHERE p.assigned_to IS NOT NULL
  AND p.assigned_to !~ ','
  AND (p.employee_payments IS NULL OR p.employee_payments = '[]'::jsonb)
  AND p.payment_of_emp <> 0
ON CONFLICT (project_id, employee_id) DO NOTHING;
