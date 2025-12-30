-- Migration: Add custody and expense integration fields
-- Date: 2025-12-30
-- Description: Add fields to support expense deduction from employee custody and custody confirmation workflow

-- 1. Add fields to expenses table
ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES user_profiles(id),
ADD COLUMN IF NOT EXISTS balance_transaction_id UUID REFERENCES employee_balance_transactions(id),
ADD COLUMN IF NOT EXISTS deducted_from_custody BOOLEAN DEFAULT FALSE;

-- 2. Add fields to employee_balance_transactions table
ALTER TABLE employee_balance_transactions 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'confirmed',
ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS confirmed_by UUID REFERENCES user_profiles(id);

-- 3. Add comments for documentation
COMMENT ON COLUMN expenses.user_id IS 'The employee who made this expense';
COMMENT ON COLUMN expenses.balance_transaction_id IS 'Reference to the custody transaction if expense was deducted from custody';
COMMENT ON COLUMN expenses.deducted_from_custody IS 'Whether this expense was deducted from employee custody balance';
COMMENT ON COLUMN employee_balance_transactions.status IS 'Transaction status: pending, confirmed, rejected';
COMMENT ON COLUMN employee_balance_transactions.confirmed_at IS 'When the transaction was confirmed by the employee';
COMMENT ON COLUMN employee_balance_transactions.confirmed_by IS 'Who confirmed the transaction (usually the employee themselves)';

-- 4. Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_balance_transaction_id ON expenses(balance_transaction_id);
CREATE INDEX IF NOT EXISTS idx_employee_balance_transactions_status ON employee_balance_transactions(status);

-- 5. Update existing transactions to have 'confirmed' status
UPDATE employee_balance_transactions 
SET status = 'confirmed', 
    confirmed_at = created_at,
    confirmed_by = user_id
WHERE status IS NULL OR status = '';
