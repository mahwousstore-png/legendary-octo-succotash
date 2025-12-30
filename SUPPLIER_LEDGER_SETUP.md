# تحديث صلاحيات نظام مستحقات الموردين

## نظرة عامة
يوفر نظام مستحقات الموردين طريقة محاسبية لإدارة مستحقات الموردين حيث:
- **لا يتم تسجيل مستحقات إلا عند إقفال طلب فعلي**
- **الموظف لا يستطيع حذف/تعديل/إضافة مستحقات**
- **الموظف يستطيع فقط سداد دفعة تُخصم من عهدته تلقائياً**
- **توثيق كامل لجميع العمليات في Audit Log**

## تحديث الصلاحيات في قاعدة البيانات

لتفعيل صلاحية "مستحقات الموردين" للمستخدمين، يجب تشغيل الأوامر التالية في Supabase SQL Editor:

### 1. تحديث صلاحية المدير الافتراضي

```sql
-- تحديث صلاحيات المدير لتشمل supplier-ledger
UPDATE user_profiles 
SET permissions = jsonb_set(
  permissions::jsonb,
  '{supplier-ledger}',
  'true'::jsonb
)
WHERE role = 'admin';
```

### 2. تحديث صلاحية الموظفين (اختياري)

```sql
-- إعطاء صلاحية supplier-ledger لجميع الموظفين النشطين
UPDATE user_profiles 
SET permissions = jsonb_set(
  permissions::jsonb,
  '{supplier-ledger}',
  'true'::jsonb
)
WHERE role = 'user' AND is_active = true;
```

أو لموظف محدد:

```sql
-- إعطاء صلاحية supplier-ledger لموظف محدد
UPDATE user_profiles 
SET permissions = jsonb_set(
  permissions::jsonb,
  '{supplier-ledger}',
  'true'::jsonb
)
WHERE email = 'employee@example.com';
```

## تشغيل Migration

لإنشاء الجداول المطلوبة، قم بتشغيل الملف:
```
migrations/003_supplier_ledger.sql
```

في Supabase SQL Editor أو باستخدام أداة migration الخاصة بك.

## التحقق من الصلاحيات

للتحقق من أن الصلاحيات تم تحديثها بشكل صحيح:

```sql
SELECT 
  email, 
  full_name, 
  role,
  permissions->'supplier-ledger' as supplier_ledger_permission
FROM user_profiles
WHERE is_active = true;
```

يجب أن ترى `true` في عمود `supplier_ledger_permission` للمستخدمين الذين تم تفعيل الصلاحية لهم.

## هيكل الصلاحيات المتوقع

بعد التحديث، يجب أن يكون هيكل `permissions` كالتالي:

```json
{
  "dashboard": true,
  "unlocked-orders": true,
  "locked-orders": true,
  "shipping-companies": true,
  "payment-methods": true,
  "employee-balances": true,
  "suppliers": true,
  "supplier-ledger": true,
  "expenses": true,
  "inventory": true,
  "cancelled-orders": true,
  "reports": true,
  "users": false
}
```

## الميزات الرئيسية

### للمدراء (admin)
- ✅ عرض جميع المستحقات
- ✅ سداد دفعات للموردين
- ✅ حذف مستحقات (مع تسجيل في Audit Log)
- ✅ عرض سجل السدادات لكل مستحق

### للموظفين (user)
- ✅ عرض جميع المستحقات
- ✅ سداد دفعات من عهدتهم (مع خصم تلقائي)
- ❌ لا يمكن إضافة/تعديل/حذف مستحقات
- ✅ عرض سجل السدادات لكل مستحق

## التكامل مع النظام

عند إقفال طلب في "الطلبات الجديدة":
1. يتم إنشاء مستحق في جدول `receivables` (النظام القديم)
2. **جديد**: يتم إنشاء مستحق في جدول `supplier_ledger` تلقائياً
3. يتم ربط المستحق بالمورد والطلب
4. يتم تسجيل العملية في Audit Log

عند سداد دفعة:
1. يتم التحقق من رصيد عهدة الموظف
2. يتم خصم المبلغ من العهدة
3. يتم تسجيل السداد في `supplier_payments`
4. يتم تحديث `remaining_amount` في `supplier_ledger`
5. يتم تسجيل العملية في Audit Log

## استكشاف الأخطاء

### المستخدم لا يرى القائمة في Sidebar
- تأكد من تشغيل أوامر SQL لتحديث الصلاحيات
- تحقق من أن المستخدم قام بتسجيل الخروج والدخول مرة أخرى
- تحقق من `localStorage` في المتصفح

### خطأ عند إنشاء مستحق
- تأكد من تشغيل migration `003_supplier_ledger.sql`
- تحقق من أن المستخدم الحالي مسجل دخول
- راجع console log للحصول على تفاصيل الخطأ

### خطأ عند السداد
- تأكد من أن الموظف لديه رصيد كافٍ في عهدته
- تحقق من أن المبلغ لا يتجاوز المبلغ المتبقي
- راجع جدول `employee_balance_transactions` للتحقق من الرصيد

## الأمان

- جميع عمليات الحذف محمية بصلاحية المدير فقط
- جميع العمليات مسجلة في Audit Log
- Row Level Security (RLS) مفعّل على الجداول
- التحقق من الرصيد قبل أي عملية سداد
