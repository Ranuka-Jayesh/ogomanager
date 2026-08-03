-- Migration: employee payment partial + return support
-- Adds paid_amount and allows status = partial

ALTER TABLE employee_payments
  ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0
  CHECK (paid_amount >= 0);

-- Allow partial status
ALTER TABLE employee_payments DROP CONSTRAINT IF EXISTS employee_payments_status_check;
ALTER TABLE employee_payments
  ADD CONSTRAINT employee_payments_status_check
  CHECK (status IN ('pending', 'partial', 'paid'));

-- Backfill paid_amount from status
UPDATE employee_payments
SET paid_amount = CASE
  WHEN status = 'paid' THEN amount
  ELSE COALESCE(paid_amount, 0)
END
WHERE paid_amount IS NULL OR (status = 'paid' AND paid_amount = 0 AND amount > 0);

-- Keep paid_amount within amount
UPDATE employee_payments
SET paid_amount = LEAST(paid_amount, amount)
WHERE paid_amount > amount;

COMMENT ON COLUMN employee_payments.paid_amount IS 'Amount already paid toward amount (supports partial payments and returns)';
COMMENT ON COLUMN employee_payments.status IS 'pending | partial | paid — derived from paid_amount vs amount';
