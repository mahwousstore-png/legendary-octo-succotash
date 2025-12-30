# نظام الصلاحيات الصارمة وسجل الرقابة - دليل التطبيق

## نظرة عامة

تم تطبيق نظام أمان صارم لمنع التلاعب بالبيانات وتوثيق جميع العمليات في النظام.

## المميزات المنفذة

### ✅ 1. تقييد صلاحيات الحذف (Delete Restriction)

#### في `EmployeeBalances.tsx`:
- ✅ زر الحذف (Trash2) مخفي تماماً للموظفين (`role === 'user'`)
- ✅ زر الحذف يظهر فقط للمدير (`role === 'admin'`)
- ✅ التحقق من صلاحيات المدير في دالة `confirmDelete()`
- ✅ رسالة خطأ واضحة عند محاولة الموظف الحذف

#### في `Expenses.tsx`:
- ✅ زر الحذف (Trash2) مخفي تماماً للموظفين
- ✅ زر الحذف يظهر فقط للمدير
- ✅ التحقق من صلاحيات المدير في دالة `handleDelete()`
- ✅ إشعارات toast للمستخدم عند نجاح أو فشل العمليات

### ✅ 2. نظام سجل الأحداث (Audit Logs)

#### أ) قاعدة البيانات:
**ملف**: `migrations/002_audit_system.sql`
- ✅ جدول `system_logs` لتسجيل جميع العمليات
- ✅ Indexes للأداء الأفضل
- ✅ حقول `accepted_at` و `accepted_by` في `employee_balance_transactions`

**الحقول في `system_logs`**:
```sql
- id: UUID (Primary Key)
- user_id: UUID (Foreign Key → user_profiles)
- user_name: VARCHAR(255)
- action: VARCHAR(100) -- 'create', 'update', 'delete', 'accept', 'reject'
- resource_type: VARCHAR(100) -- 'expense', 'custody', 'order', etc.
- resource_id: UUID
- details: JSONB
- ip_address: VARCHAR(45)
- user_agent: TEXT
- created_at: TIMESTAMP
```

#### ب) دالة التسجيل المركزية:
**ملف**: `lib/auditLogger.ts`

**الدوال المتوفرة**:
- ✅ `logAction(data: AuditLogData)`: الدالة الرئيسية
- ✅ `logExpenseCreated(expenseId, amount)`
- ✅ `logExpenseDeleted(expenseId)`
- ✅ `logCustodyAccepted(transactionId, amount)`
- ✅ `logCustodyRejected(transactionId, amount)`
- ✅ `logCustodyDeleted(transactionId, amount)`

#### ج) واجهة السجلات (للمدير فقط):
**ملف**: `components/AuditLogs.tsx`

**المميزات**:
- ✅ عرض جميع السجلات من قاعدة البيانات
- ✅ البحث في السجلات (اسم المستخدم، نوع الإجراء، نوع المورد)
- ✅ فلترة حسب نوع الإجراء (إنشاء، تحديث، حذف، قبول، رفض)
- ✅ Pagination (20 سجل لكل صفحة)
- ✅ عرض التفاصيل بصيغة JSON
- ✅ رسالة "غير مصرح" للمستخدمين غير المديرين

### ✅ 3. التكامل في Components

#### `EmployeeBalances.tsx`:
```typescript
// عند الحذف (للمدير فقط):
const confirmDelete = async () => {
  if (currentUser?.role !== 'admin') {
    toast.error('غير مصرح لك بالحذف');
    return;
  }
  
  // ... حذف من قاعدة البيانات
  await logCustodyDeleted(transactionToDelete.id, transactionToDelete.amount);
  toast.success('تم حذف العملية من عهده');
}
```

#### `Expenses.tsx`:
```typescript
// عند الإنشاء:
const { data } = await supabase.from('expenses').insert([expenseToInsert]).select().single();
await logExpenseCreated(data.id, data.amount);

// عند الحذف (للمدير فقط):
const handleDelete = async (id: string) => {
  if (currentUser?.role !== 'admin') {
    toast.error('غير مصرح لك بالحذف');
    return;
  }
  
  await supabase.from('expenses').delete().eq('id', id);
  await logExpenseDeleted(id);
  toast.success('تم حذف المصروف بنجاح');
}
```

### ✅ 4. Route الجديد في `App.tsx`

```typescript
{ id: 'audit-logs', label: 'سجل الأحداث', icon: Shield, category: 'admin' }

// في getPermissionKey:
'audit-logs': 'users'  // يتطلب صلاحيات المستخدمين (المدير فقط)

// في render:
{activeTab === 'audit-logs' && <AuditLogs />}
```

## خطوات التطبيق

### 1. تطبيق Migration على قاعدة البيانات

**من Supabase Dashboard:**
1. افتح SQL Editor
2. انسخ محتوى `migrations/002_audit_system.sql`
3. الصق والصق في المحرر
4. اضغط Run

**أو من CLI:**
```bash
# إذا كان لديك Supabase CLI مثبت
supabase db push
```

### 2. التحقق من التطبيق

**تحقق من الجداول:**
```sql
-- تحقق من وجود جدول system_logs
SELECT * FROM system_logs LIMIT 1;

-- تحقق من الحقول الجديدة
SELECT accepted_at, accepted_by FROM employee_balance_transactions LIMIT 1;
```

### 3. اختبار النظام

#### كمدير (admin):
- ✅ يمكنك رؤية زر الحذف في المصروفات وعهد الموظفين
- ✅ يمكنك الوصول إلى صفحة "سجل الأحداث"
- ✅ يمكنك حذف المصروفات والمعاملات
- ✅ تظهر رسائل نجاح عند الحذف

#### كموظف (user):
- ✅ زر الحذف مخفي تماماً
- ✅ لا يمكن الوصول إلى صفحة "سجل الأحداث"
- ✅ رسالة خطأ عند محاولة الحذف (إذا تم تجاوز الواجهة)

## الملفات المضافة/المعدلة

### ملفات جديدة:
1. **`lib/auditLogger.ts`** - دوال تسجيل الأحداث
2. **`lib/dateFormatter.ts`** - تنسيق التواريخ
3. **`components/AuditLogs.tsx`** - واجهة سجل الأحداث
4. **`migrations/002_audit_system.sql`** - تعديلات قاعدة البيانات
5. **`migrations/README.md`** - دليل تطبيق Migrations
6. **`SECURITY_IMPLEMENTATION.md`** - هذا الملف

### ملفات معدلة:
1. **`components/EmployeeBalances.tsx`**:
   - إضافة import للـ `logCustodyDeleted`
   - تقييد زر الحذف بصلاحيات المدير
   - تسجيل عملية الحذف في السجلات
   - إضافة رسائل خطأ واضحة

2. **`components/Expenses.tsx`**:
   - إضافة imports للـ audit logger و toast
   - إضافة state `isAdmin`
   - تقييد زر الحذف بصلاحيات المدير
   - تسجيل عمليات الإنشاء والحذف في السجلات
   - إضافة Toaster component
   - إضافة رسائل نجاح وخطأ

3. **`App.tsx`**:
   - إضافة import لـ `AuditLogs` و `Shield`
   - إضافة menu item جديد للسجلات
   - إضافة route للسجلات
   - ربط الصلاحية بـ 'users' permission

## معايير النجاح

- ✅ **الموظف لا يرى أزرار الحذف** في `Expenses` و `EmployeeBalances`
- ✅ **المدير يرى أزرار الحذف ويمكنه الحذف**
- ✅ **جميع العمليات مسجلة في `system_logs`**
- ✅ **واجهة السجلات تعمل للمدير فقط**
- ✅ **`npm run build` ينجح بدون أخطاء**
- ⚠️ **يتم حفظ `accepted_at` عند الاعتماد** (يتطلب تطوير إضافي في المستقبل)
- ⚠️ **لا يمكن التراجع بعد الاعتماد** (يتطلب تطوير إضافي في المستقبل)

## ملاحظات مهمة

### تم التطبيق:
1. ✅ قيود الحذف الصارمة للموظفين
2. ✅ نظام سجل الأحداث الشامل
3. ✅ واجهة إدارية لعرض السجلات
4. ✅ تكامل كامل مع النظام الحالي
5. ✅ البناء ناجح بدون أخطاء TypeScript

### يتطلب تطوير إضافي (مستقبلاً):
1. ⏳ تطبيق ميزة "الاعتماد/التوثيق" في `EmployeeBalances`
2. ⏳ منع التراجع عن العمليات المعتمدة
3. ⏳ عرض حالة التوثيق مع التاريخ والوقت
4. ⏳ إضافة IP address في السجلات

## الاستخدام

### تسجيل حدث مخصص:

```typescript
import { logAction } from '../lib/auditLogger';

// في أي component
await logAction({
  action: 'create',
  resource_type: 'order',
  resource_id: orderId,
  details: { 
    order_number: '12345',
    total_amount: 500 
  }
});
```

### عرض السجلات:

1. تسجيل الدخول كمدير
2. من القائمة الجانبية → **الإدارة** → **سجل الأحداث**
3. يمكن البحث والفلترة حسب الحاجة

## الأمان

- ✅ التحقق من الصلاحيات على مستوى UI (إخفاء أزرار)
- ✅ التحقق من الصلاحيات على مستوى الكود (في الدوال)
- ⚠️ يُنصح بإضافة Row Level Security (RLS) في Supabase
- ⚠️ يُنصح بالتحقق من الصلاحيات في Backend/Database level

## الدعم والصيانة

- الكود موثق جيداً بالعربية
- جميع الدوال تحتوي على error handling
- رسائل خطأ واضحة للمستخدمين
- Logging للأخطاء في console للمطورين
