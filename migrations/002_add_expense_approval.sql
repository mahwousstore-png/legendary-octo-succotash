-- Migration: Add expense approval workflow
-- Description: إضافة نظام الموافقة على المصروفات من المدير

-- إضافة حقول الموافقة إلى جدول expenses
ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES user_profiles(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- تحديث السجلات الموجودة لتكون معتمدة افتراضياً
UPDATE expenses 
SET status = 'approved' 
WHERE status IS NULL;

-- إنشاء index لتحسين الأداء عند البحث عن المصروفات المعلقة
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);
CREATE INDEX IF NOT EXISTS idx_expenses_created_by ON expenses(created_by);

-- تعليقات للتوثيق
COMMENT ON COLUMN expenses.status IS 'حالة المصروف: pending (معلق), approved (معتمد), rejected (مرفوض)';
COMMENT ON COLUMN expenses.approved_by IS 'معرف المدير الذي وافق/رفض المصروف';
COMMENT ON COLUMN expenses.approved_at IS 'تاريخ ووقت الموافقة/الرفض';
COMMENT ON COLUMN expenses.rejection_reason IS 'سبب الرفض (إن وجد)';
