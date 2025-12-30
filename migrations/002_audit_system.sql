-- Create system_logs table for audit trail
CREATE TABLE IF NOT EXISTS system_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  user_name VARCHAR(255) NOT NULL,
  action VARCHAR(100) NOT NULL, -- 'create', 'update', 'delete', 'accept', 'reject'
  resource_type VARCHAR(100) NOT NULL, -- 'expense', 'custody', 'order', etc.
  resource_id UUID,
  details JSONB, -- Additional data about the action
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_system_logs_user_id ON system_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_action ON system_logs(action);
CREATE INDEX IF NOT EXISTS idx_system_logs_resource_type ON system_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at DESC);

-- Add comments
COMMENT ON TABLE system_logs IS 'Audit trail for all system actions';
COMMENT ON COLUMN system_logs.action IS 'Type of action performed';
COMMENT ON COLUMN system_logs.resource_type IS 'Type of resource affected';
COMMENT ON COLUMN system_logs.details IS 'Additional JSON data about the action';

-- Add timestamp validation columns to employee_balance_transactions
ALTER TABLE employee_balance_transactions 
ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS accepted_by UUID REFERENCES user_profiles(id);

-- Add comments for new columns
COMMENT ON COLUMN employee_balance_transactions.accepted_at IS 'Timestamp when transaction was accepted/confirmed';
COMMENT ON COLUMN employee_balance_transactions.accepted_by IS 'User who accepted/confirmed the transaction';
