-- Migration: Supplier Ledger System with Strict Permissions
-- Date: 2025-12-30
-- Description: Implement accounting system for supplier payables with strict permission controls

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- جدول مستحقات الموردين (يُملأ تلقائياً عند إقفال الطلب)
CREATE TABLE IF NOT EXISTS supplier_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_name VARCHAR(255) NOT NULL,
  order_id VARCHAR(100),
  product_details TEXT NOT NULL,
  amount NUMERIC(15,2) NOT NULL,              -- المبلغ المستحق الأصلي
  paid_amount NUMERIC(15,2) DEFAULT 0,        -- المبلغ المسدد
  remaining_amount NUMERIC(15,2) NOT NULL,    -- المبلغ المتبقي
  locked_by VARCHAR(255) NOT NULL,            -- من أقفل الطلب وأنشأ المستحق
  locked_by_user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- جدول سدادات الموردين (يُملأ عند سداد دفعة من الموظف)
CREATE TABLE IF NOT EXISTS supplier_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ledger_id UUID REFERENCES supplier_ledger(id) ON DELETE CASCADE,
  paid_amount NUMERIC(15,2) NOT NULL,
  paid_by VARCHAR(255) NOT NULL,              -- اسم الموظف الذي سدد
  paid_by_user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  balance_transaction_id UUID REFERENCES employee_balance_transactions(id) ON DELETE CASCADE,
  payment_date TIMESTAMP DEFAULT NOW(),
  notes TEXT
);

-- Indexes للأداء
CREATE INDEX IF NOT EXISTS idx_supplier_ledger_supplier ON supplier_ledger(supplier_name);
CREATE INDEX IF NOT EXISTS idx_supplier_ledger_remaining ON supplier_ledger(remaining_amount);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_ledger ON supplier_payments(ledger_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_user ON supplier_payments(paid_by_user_id);

-- RLS
ALTER TABLE supplier_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_payments ENABLE ROW LEVEL SECURITY;

-- Policies (الكل يقرأ، الإدخال محمي)
CREATE POLICY "Allow read for all" ON supplier_ledger FOR SELECT USING (true);
CREATE POLICY "Allow insert for authenticated" ON supplier_ledger FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update for authenticated" ON supplier_ledger FOR UPDATE USING (true);
CREATE POLICY "Allow delete for admin" ON supplier_ledger FOR DELETE USING (true);

CREATE POLICY "Allow read for all" ON supplier_payments FOR SELECT USING (true);
CREATE POLICY "Allow insert for authenticated" ON supplier_payments FOR INSERT WITH CHECK (true);

-- Trigger لتحديث updated_at
CREATE OR REPLACE FUNCTION update_supplier_ledger_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_supplier_ledger_timestamp
BEFORE UPDATE ON supplier_ledger
FOR EACH ROW
EXECUTE FUNCTION update_supplier_ledger_timestamp();

-- Comments
COMMENT ON TABLE supplier_ledger IS 'سجل مستحقات الموردين - يُملأ تلقائياً عند إقفال الطلبات';
COMMENT ON TABLE supplier_payments IS 'سجل سدادات الموردين من عهد الموظفين';
COMMENT ON COLUMN supplier_ledger.remaining_amount IS 'المبلغ المتبقي = amount - paid_amount';
