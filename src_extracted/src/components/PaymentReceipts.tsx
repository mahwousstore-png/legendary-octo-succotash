import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, Banknote, Package, Receipt, Trash2, Wallet, X, CheckCircle,
  CreditCard, Smartphone, User, AlertCircle, Users, Plus, Minus
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useOrders } from '../hooks/useOrders';
import { authService } from '../lib/auth';
import toast, { Toaster } from 'react-hot-toast';
interface PaymentMethod {
  id: string;
  name: string;
  code: string;
  percentage_fee: number;
  fixed_fee: number;
  is_active: boolean;
  total_paid: number;
  logo_url?: string;
}
interface PaymentReceipt {
  id: string;
  order_id: string | null;
  payment_method_code: string;
  amount_received: number;
  receipt_date: string;
  notes?: string;
  created_by: string;
  receipt_number?: string;
  order?: {
    order_number: string;
    customer_name: string;
    total_price: number;
  };
}
interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  total_price: number;
  payment_method: string;
  created_at: string;
}
interface UserProfile {
  id: string;
  full_name: string;
  role: string;
  email: string;
}
interface EmployeeBalanceTransaction {
  id: string;
  user_id: string;
  amount: number;
  type: 'credit' | 'debit';
  reason?: string;
  transaction_date: string;
  created_by: string;
  created_at: string;
  user: UserProfile;
  created_by_user?: UserProfile;
}
interface EmployeeSummary {
  user: UserProfile;
  current_balance: number;
  transactions: EmployeeBalanceTransaction[];
}
interface PaymentMethodSummary {
  method: PaymentMethod | null;
  name: string;
  code: string;
  totalOriginal: number;
  totalRemaining: number;
  orderCount: number;
  expectedFees: number;
  netDue: number;
  totalPaid: number;
  orders: Order[];
  receipts: PaymentReceipt[];
  logo_url?: string;
  subMethods?: {
    name: string;
    code: string;
    orders: Order[];
    receipts: PaymentReceipt[];
    totalPaid: number;
    feeMethod: PaymentMethod;
    totalOriginal: number;
    expectedFees: number;
  }[];
}
const PaymentReceipts: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'payments' | 'employees'>('payments');
  const { orders: allOrders } = useOrders();
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [userProfiles, setUserProfiles] = useState<Map<string, string>>(new Map());
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMethodSummary, setSelectedMethodSummary] = useState<PaymentMethodSummary | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeSummary | null>(null);
  const [showManualPaymentModal, setShowManualPaymentModal] = useState(false);
  const [showEmployeeTransactionModal, setShowEmployeeTransactionModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [receiptToDelete, setReceiptToDelete] = useState<PaymentReceipt | null>(null);
  const [transactionToDelete, setTransactionToDelete] = useState<EmployeeBalanceTransaction | null>(null);
  const [manualAmount, setManualAmount] = useState<string>('');
  const [manualDate, setManualDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [manualNotes, setManualNotes] = useState<string>('');
  const [employeeTransactionAmount, setEmployeeTransactionAmount] = useState<string>('');
  const [employeeTransactionDate, setEmployeeTransactionDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [employeeTransactionType, setEmployeeTransactionType] = useState<'credit' | 'debit'>('credit');
  const [employeeTransactionReason, setEmployeeTransactionReason] = useState<string>('');
  const currentUser = authService.getCurrentUser();
  const [methodSummaries, setMethodSummaries] = useState<PaymentMethodSummary[]>([]);
  /* --------------------------------------------------- */
  useEffect(() => {
    fetchAllData();
  }, []);
  useEffect(() => {
    if (paymentMethods.length > 0) {
      calculateMethodSummaries();
    }
  }, [paymentMethods, allOrders, receipts, userProfiles]);
  useEffect(() => {
    if (activeTab === 'employees') {
      fetchEmployeesData();
    }
  }, [activeTab]);
  /* --------------------------------------------------- */
  const fetchAllData = async () => {
    setLoading(true);
    try {
      // بيانات طرق الدفع
      const { data: methodsData, error: methodsError } = await supabase
        .from('payment_methods')
        .select('*, total_paid')
        .eq('is_active', true)
        .order('name');
      if (methodsError) throw methodsError;
      setPaymentMethods(methodsData || []);
      const { data: receiptsData, error: receiptsError } = await supabase
        .from('payment_receipts')
        .select(`
          *,
          order:orders(order_number, customer_name, total_price)
        `)
        .order('created_at', { ascending: false });
      if (receiptsError) throw receiptsError;
      setReceipts(receiptsData || []);
      const userIds = [...new Set(receiptsData?.map(r => r.created_by) || [])];
      if (userIds.length > 0) {
        const { data: profiles, error: profileError } = await supabase
          .from('user_profiles')
          .select('id, full_name')
          .in('id', userIds);
        if (profileError) throw profileError;
        const profileMap = new Map<string, string>();
        profiles?.forEach(p => {
          profileMap.set(p.id, p.full_name || 'مستخدم');
        });
        setUserProfiles(profileMap);
      }
    } catch (e) {
      console.error('Error fetching data:', e);
      toast.error('فشل جلب بيانات طرق الدفع');
    } finally {
      setLoading(false);
    }
  };
  const fetchEmployeesData = async () => {
    setLoading(true);
    try {
      // جلب المستخدمين (الموظفين) - افتراضياً role='user'
      const { data: usersData, error: usersError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('role', 'user')
        .eq('is_active', true)
        .order('full_name');
      if (usersError) throw usersError;
      // جلب جميع معاملات الرصيد
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('employee_balance_transactions')
        .select(`
          *,
          user:user_profiles!employee_balance_transactions_user_id_fkey(full_name, role, email),
          created_by_user:user_profiles!employee_balance_transactions_created_by_fkey(full_name)
        `)
        .order('transaction_date', { ascending: false });
      if (transactionsError) throw transactionsError;
      // تجميع البيانات حسب المستخدم
      const employeeMap = new Map<string, EmployeeSummary>();
      usersData?.forEach((user: UserProfile) => {
        employeeMap.set(user.id, {
          user,
          current_balance: 0,
          transactions: []
        });
      });
      transactionsData?.forEach((t: any) => {
        const emp = employeeMap.get(t.user_id);
        if (emp) {
          const transaction: EmployeeBalanceTransaction = {
            ...t,
            user: t.user,
            created_by_user: t.created_by_user,
            amount: parseFloat(t.amount.toString()),
            transaction_date: t.transaction_date,
            created_at: t.created_at
          };
          emp.transactions.push(transaction);
          emp.current_balance += transaction.amount;
        }
      });
      const summaries: EmployeeSummary[] = Array.from(employeeMap.values())
        .filter(emp => emp.transactions.length > 0 || true) // عرض الجميع
        .sort((a, b) => a.user.full_name.localeCompare(b.user.full_name));
      setEmployees(summaries);
    } catch (e) {
      console.error('Error fetching employees data:', e);
      toast.error('فشل جلب بيانات الموظفين');
    } finally {
      setLoading(false);
    }
  };
  /* --------------------------------------------------- */
  const generateReceiptNumber = async (): Promise<string> => {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const { data, error } = await supabase
      .from('payment_receipts')
      .select('receipt_number')
      .like('receipt_number', `${today}%`)
      .order('receipt_number', { ascending: false })
      .limit(1);
    if (error) throw error;
    const lastNum = data?.[0]?.receipt_number || `${today}-000`;
    const numPart = parseInt(lastNum.split('-')[1]) + 1;
    return `${today}-${String(numPart).padStart(3, '0')}`;
  };
  /* --------------------------------------------------- */
  const calculateMethodSummaries = () => {
    const summaries: PaymentMethodSummary[] = [];
    const basketMethod = paymentMethods.find(m => m.code === 'salla_basket');
    const madaMethod = paymentMethods.find(m => m.code === 'mada');
    const creditMethod = paymentMethods.find(m => m.code === 'credit_card');
    if (basketMethod && (madaMethod || creditMethod)) {
      const madaOrders = allOrders.filter(o => o.payment_method === 'mada');
      const creditOrders = allOrders.filter(o => o.payment_method === 'credit_card');
      const allBasketOrders = [...madaOrders, ...creditOrders];
      const totalOriginal = allBasketOrders.reduce((s, o) => s + o.total_price, 0);
      const orderCount = allBasketOrders.length;
      const basketPaid = basketMethod.total_paid || 0;
      const totalPaid = basketPaid;
      const totalRemaining = Math.max(0, totalOriginal - totalPaid);
      let expectedFees = 0;
      const subMethods = [];
      if (madaMethod && madaOrders.length > 0) {
        const madaTotal = madaOrders.reduce((s, o) => s + o.total_price, 0);
        const fixed = madaOrders.length * madaMethod.fixed_fee;
        const perc = (madaTotal * madaMethod.percentage_fee) / 100;
        expectedFees += fixed + perc;
        subMethods.push({
          name: 'مدى',
          code: 'mada',
          orders: madaOrders,
          receipts: receipts.filter(r => r.payment_method_code === 'mada'),
          totalPaid: 0,
          feeMethod: madaMethod,
          totalOriginal: madaTotal,
          expectedFees: fixed + perc
        });
      }
      if (creditMethod && creditOrders.length > 0) {
        const creditTotal = creditOrders.reduce((s, o) => s + o.total_price, 0);
        const fixed = creditOrders.length * creditMethod.fixed_fee;
        const perc = (creditTotal * creditMethod.percentage_fee) / 100;
        expectedFees += fixed + perc;
        subMethods.push({
          name: 'بطاقة ائتمانية',
          code: 'credit_card',
          orders: creditOrders,
          receipts: receipts.filter(r => r.payment_method_code === 'credit_card'),
          totalPaid: 0,
          feeMethod: creditMethod,
          totalOriginal: creditTotal,
          expectedFees: fixed + perc
        });
      }
      const netDue = Math.max(0, totalRemaining - expectedFees);
      summaries.push({
        method: basketMethod,
        name: 'سلة',
        code: 'salla_basket',
        totalOriginal,
        totalRemaining,
        orderCount,
        expectedFees,
        netDue,
        totalPaid,
        orders: allBasketOrders,
        receipts: receipts.filter(r => r.payment_method_code === 'salla_basket'),
        logo_url: basketMethod.logo_url,
        subMethods
      });
    }
    paymentMethods.forEach(method => {
      if (!['mada', 'credit_card', 'salla_basket'].includes(method.code)) {
        const relatedOrders = allOrders.filter(o => o.payment_method === method.code);
        const totalOriginal = relatedOrders.reduce((s, o) => s + o.total_price, 0);
        const orderCount = relatedOrders.length;
        const totalPaid = method.total_paid || 0;
        const totalRemaining = Math.max(0, totalOriginal - totalPaid);
        const totalFixed = orderCount * method.fixed_fee;
        const totalPerc = (totalOriginal * method.percentage_fee) / 100;
        const expectedFees = totalFixed + totalPerc;
        const netDue = Math.max(0, totalRemaining - expectedFees);
        const methodReceipts = receipts.filter(r => r.payment_method_code === method.code);
        summaries.push({
          method,
          name: method.name,
          code: method.code,
          totalOriginal,
          totalRemaining,
          orderCount,
          expectedFees,
          netDue,
          totalPaid,
          orders: relatedOrders,
          receipts: methodReceipts,
          logo_url: method.logo_url
        });
      }
    });
    setMethodSummaries(summaries);
  };
  /* --------------------------------------------------- */
  const handleManualPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !manualAmount || !selectedMethodSummary) {
      toast.error('يرجى ملء جميع الحقول');
      return;
    }
    const amount = parseFloat(manualAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('المبلغ يجب أن يكون رقمًا موجبًا');
      return;
    }
    try {
      const receiptNumber = await generateReceiptNumber();
      console.group('تسجيل دفع يدوي');
      console.log('المستخدم:', currentUser.id);
      console.log('الطريقة المختارة:', {
        name: selectedMethodSummary.name,
        code: selectedMethodSummary.code,
      });
      // تحديد الكود النهائي
      let targetCode = selectedMethodSummary.code;
      if (['mada', 'credit_card'].includes(targetCode)) {
        targetCode = 'salla_basket';
      }
      console.log('الكود النهائي:', targetCode);
      const targetMethod = paymentMethods.find(m => m.code === targetCode);
      if (!targetMethod) {
        toast.error('طريقة الدفع غير موجودة');
        console.groupEnd();
        return;
      }
      // === 1. إنشاء الإيصال محليًا (للعرض الفوري) ===
      const localId = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newReceipt: PaymentReceipt = {
        id: localId,
        order_id: null,
        payment_method_code: targetCode,
        amount_received: amount,
        receipt_date: manualDate,
        notes: manualNotes || undefined,
        created_by: currentUser.id,
        receipt_number: receiptNumber,
        order: undefined,
      };
      // تحديث الحالة المحلية
      setReceipts(prev => [newReceipt, ...prev]);
      setPaymentMethods(prev =>
        prev.map(m =>
          m.code === targetCode
            ? { ...m, total_paid: (m.total_paid || 0) + amount }
            : m
        )
      );
      // === 2. إرسال إلى Supabase ===
      const { data: inserted, error: insertError } = await supabase
        .from('payment_receipts')
        .insert({
          order_id: null,
          payment_method_code: targetCode,
          amount_received: amount,
          percentage_fee: 0,
          fixed_fee: 0,
          total_fees: 0,
          net_amount: amount,
          receipt_date: manualDate,
          notes: `دفع يدوي (${selectedMethodSummary.name}): ${manualNotes || 'بدون ملاحظات'}`,
          created_by: currentUser.id,
          receipt_number: receiptNumber,
        })
        .select()
        .single();
      if (insertError) throw insertError;
      // === 3. استبدال الـ local id بالـ UUID الحقيقي ===
      setReceipts(prev =>
        prev.map(r => (r.id === localId ? { ...r, ...inserted } : r))
      );
      // === 4. تحديث total_paid في payment_methods ===
      await supabase
        .from('payment_methods')
        .update({ total_paid: (targetMethod.total_paid || 0) + amount })
        .eq('id', targetMethod.id);
      // === 5. إغلاق النافذة + إعادة التعيين ===
      resetManualForm();
      setShowManualPaymentModal(false);
      toast.success(`تم تسجيل الدفع: ${receiptNumber}`);
      // === 6. العودة مع عد تنازلي (إذا كانت المتغيرات موجودة) ===
      if (typeof setSelectedMethodSummary === 'function') {
        setSelectedMethodSummary(null);
      }
      if (typeof setCountdown === 'function' && typeof setPendingEntryCode === 'function') {
        setCountdown(3);
        setPendingEntryCode(targetCode);
      }
      console.log('تم بنجاح:', inserted.id);
      console.groupEnd();
    } catch (err: any) {
      console.error('خطأ:', err);
      toast.error(err.message || 'فشل التسجيل');
      console.groupEnd();
    }
  };
  const handleEmployeeTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !employeeTransactionAmount || !selectedEmployee) {
      toast.error('يرجى ملء جميع الحقول');
      return;
    }
    const amount = parseFloat(employeeTransactionAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('المبلغ يجب أن يكون رقمًا موجبًا');
      return;
    }
    const finalAmount = employeeTransactionType === 'credit' ? amount : -amount;
    try {
      const { data: inserted, error: insertError } = await supabase
        .from('employee_balance_transactions')
        .insert({
          user_id: selectedEmployee.user.id,
          amount: finalAmount,
          type: employeeTransactionType,
          reason: employeeTransactionReason || `عملية ${employeeTransactionType === 'credit' ? 'إضافة' : 'سداد'}`,
          transaction_date: employeeTransactionDate,
          created_by: currentUser.id,
        })
        .select()
        .single();
      if (insertError) throw insertError;
      // تحديث محلي
      const newTransaction: EmployeeBalanceTransaction = {
        ...inserted,
        user: selectedEmployee.user,
        amount: finalAmount,
        transaction_date: inserted.transaction_date,
        created_at: inserted.created_at,
        created_by_user: { id: currentUser.id, full_name: currentUser.full_name || 'النظام' }
      };
      setSelectedEmployee(prev => ({
        ...prev!,
        transactions: [newTransaction, ...prev!.transactions],
        current_balance: prev!.current_balance + finalAmount
      }));
      setEmployees(prev =>
        prev.map(emp =>
          emp.user.id === selectedEmployee.user.id
            ? { ...emp, current_balance: emp.current_balance + finalAmount }
            : emp
        )
      );
      resetEmployeeForm();
      setShowEmployeeTransactionModal(false);
      toast.success(`تم تسجيل العملية بنجاح`);
    } catch (err: any) {
      console.error('خطأ:', err);
      toast.error(err.message || 'فشل التسجيل');
    }
  };
  /* --------------------------------------------------- */
  const openDeleteConfirm = (receipt: PaymentReceipt) => {
    setReceiptToDelete(receipt);
    setShowDeleteConfirmModal(true);
  };
  const openTransactionDeleteConfirm = (transaction: EmployeeBalanceTransaction) => {
    setTransactionToDelete(transaction);
    setShowDeleteConfirmModal(true);
  };
  const confirmDelete = async () => {
    if (!currentUser || currentUser.role !== 'admin') return;
    if (receiptToDelete) {
      const rec = receiptToDelete;
      try {
        if (rec.id.startsWith('local-')) {
          console.log('حذف إيصال محلي فقط');
          setReceipts(prev => prev.filter(r => r.id !== rec.id));
          toast.success('تم حذف الإيصال محليًا');
        } else {
          const targetCode = rec.payment_method_code;
          const { error: deleteError } = await supabase
            .from('payment_receipts')
            .delete()
            .eq('id', rec.id);
          if (deleteError) throw deleteError;
          const { data: method } = await supabase
            .from('payment_methods')
            .select('id, total_paid')
            .eq('code', targetCode)
            .single();
          if (method) {
            await supabase
              .from('payment_methods')
              .update({ total_paid: Math.max(0, (method.total_paid || 0) - rec.amount_received) })
              .eq('id', method.id);
          }
          setReceipts(prev => prev.filter(r => r.id !== rec.id));
          setPaymentMethods(prev =>
            prev.map(m =>
              m.code === targetCode
                ? { ...m, total_paid: Math.max(0, (m.total_paid || 0) - rec.amount_received) }
                : m
            )
          );
          toast.success(`تم حذف الإيصال: ${rec.receipt_number || rec.id}`);
        }
        setShowDeleteConfirmModal(false);
        setReceiptToDelete(null);
        setSelectedMethodSummary(null);
        calculateMethodSummaries();
      } catch (err: any) {
        console.error('خطأ حذف:', err);
        toast.error(err.message || 'فشل الحذف');
        setShowDeleteConfirmModal(false);
        setReceiptToDelete(null);
      }
    } else if (transactionToDelete) {
      const trans = transactionToDelete;
      try {
        const { error: deleteError } = await supabase
          .from('employee_balance_transactions')
          .delete()
          .eq('id', trans.id);
        if (deleteError) throw deleteError;
        // تحديث محلي
        setSelectedEmployee(prev => ({
          ...prev!,
          transactions: prev!.transactions.filter(t => t.id !== trans.id),
          current_balance: prev!.current_balance - trans.amount
        }));
        setEmployees(prev =>
          prev.map(emp =>
            emp.user.id === trans.user_id
              ? { ...emp, current_balance: emp.current_balance - trans.amount }
              : emp
          )
        );
        toast.success(`تم حذف العملية`);
        setShowDeleteConfirmModal(false);
        setTransactionToDelete(null);
      } catch (err: any) {
        console.error('خطأ حذف:', err);
        toast.error(err.message || 'فشل الحذف');
        setShowDeleteConfirmModal(false);
        setTransactionToDelete(null);
      }
    }
  };
  const resetManualForm = () => {
    setManualAmount('');
    setManualNotes('');
    setManualDate(new Date().toISOString().split('T')[0]);
  };
  const resetEmployeeForm = () => {
    setEmployeeTransactionAmount('');
    setEmployeeTransactionReason('');
    setEmployeeTransactionDate(new Date().toISOString().split('T')[0]);
    setEmployeeTransactionType('credit');
  };
// دالة مساعدة لتنسيق العملة
const formatCurrency = (v: number): string => {
  const rounded = Math.round(v * 100) / 100;
  return `${rounded.toLocaleString('EN-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ر.س`;
};

// دالة تنسيق التاريخ
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'غير محدد';
  return date.toLocaleDateString('ar-SA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

// دالة مساعدة لجلب اسم المستخدم
const getUserName = (userId: string): string => {
  return userProfiles.get(userId) || 'مستخدم غير معروف';
};
  /* --------------------------------------------------- */
  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-xl"></div>
          ))}
        </div>
      </div>
    );
  }
  /* --------------------------------------------------- */
  // تبويب طرق الدفع
  const renderPaymentsTab = () => {
    if (selectedMethodSummary) {
      const { name, totalOriginal, totalRemaining, expectedFees, netDue, totalPaid, orders, receipts, subMethods, logo_url } = selectedMethodSummary;
      return (
        <div className="p-6 max-w-7xl mx-auto">
          <Toaster position="top-center" reverseOrder={false} />
          <div className="flex justify-start items-center mb-6">
            <button
              onClick={() => setSelectedMethodSummary(null)}
              className="flex items-center text-blue-600 hover:text-blue-800 transition-colors"
            >
              <ArrowLeft className="h-5 w-5 ml-2" />
              <span className="font-medium">رجوع</span>
            </button>
          </div>
          <div className="flex items-center mb-8">
            {logo_url ? (
              <img src={logo_url} alt={name} className="h-16 w-16 object-contain rounded-xl shadow-md ml-4" />
            ) : (
              <div className="h-16 w-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl shadow-md ml-4 flex items-center justify-center">
                <Wallet className="h-9 w-9 text-white" />
              </div>
            )}
            <div>
              <h2 className="text-3xl font-bold text-gray-900">{name}</h2>
              <p className="text-gray-600 text-lg">يجمع بين مدى وبطاقات الائتمان</p>
            </div>
          </div>
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-6 mb-8 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-800">ملخص المستحقات</h3>
              <button
                onClick={() => setShowManualPaymentModal(true)}
                className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-5 py-3 rounded-xl hover:from-green-700 hover:to-emerald-700 flex items-center space-x-2 shadow-md transition-all"
              >
                <Banknote className="h-5 w-5" />
                <span className="font-medium">تسجيل دفع يدوي</span>
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex justify-between text-base">
                  <span className="text-gray-700 font-medium">إجمالي الطلبات:</span>
                  <span className="font-bold text-gray-900">{formatCurrency(totalOriginal)}</span>
                </div>
                <div className="flex justify-between text-base">
                  <span className="text-gray-700 font-medium">المستلم منهم:</span>
                  <span className="font-bold text-green-600">−{formatCurrency(totalPaid)}</span>
                </div>
                <div className="flex justify-between text-base">
                  <span className="text-gray-700 font-medium">المتبقي:</span>
                  <span className="font-bold text-indigo-600">{formatCurrency(totalRemaining)}</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between text-base">
                  <span className="text-gray-700 font-medium">الرسوم المتوقعة:</span>
                  <span className="font-bold text-red-600">−{formatCurrency(expectedFees)}</span>
                </div>
                <div className="flex justify-between text-xl font-extrabold pt-4 border-t-2 border-indigo-200">
                  <span className="text-gray-900">المستحق الصافي:</span>
                  <span className="text-emerald-600">{formatCurrency(netDue)}</span>
                </div>
              </div>
            </div>
          </div>
          {subMethods && subMethods.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {subMethods.map(sub => {
                const net = sub.totalOriginal - sub.expectedFees;
                return (
                  <div key={sub.code} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center mb-3">
                      {sub.code === 'mada' ? <Smartphone className="h-5 w-5 ml-2 text-green-600" /> : <CreditCard className="h-5 w-5 ml-2 text-blue-600" />}
                      <h4 className="font-bold text-lg">{sub.name}</h4>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">الطلبات:</span>
                        <span className="font-medium">{sub.orders.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">إجمالي الطلبات:</span>
                        <span className="font-medium">{formatCurrency(sub.totalOriginal)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">الرسوم:</span>
                        <span className="font-medium text-red-600">{formatCurrency(sub.expectedFees)}</span>
                      </div>
                      <div className="flex justify-between font-bold">
                        <span className="text-gray-700">الصافي:</span>
                        <span className="text-emerald-600">{formatCurrency(net)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-8 shadow-sm">
            <h3 className="text-xl font-bold text-gray-800 mb-5 flex items-center">
              <Receipt className="h-6 w-6 ml-2 text-blue-600" />
              سجل الدفعات من سلة ({receipts.length})
            </h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {receipts.length === 0 ? (
                <p className="text-center text-gray-500 py-6">لا توجد دفعات مسجلة</p>
              ) : (
                receipts.map(r => (
                  <div key={r.id} className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-4 shadow-sm">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-sm text-gray-800">إيصال</span>
                          <span className="font-mono text-sm bg-blue-100 text-blue-700 px-2 py-1 rounded">
                            {r.receipt_number || `#${r.id}`}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600">دفع يدوي</p>
                        <p className="text-xs text-gray-500">{formatDate(r.receipt_date)}</p>
                        {r.notes && (
                          <p className="text-xs text-gray-700 mt-1 italic">"{r.notes}"</p>
                        )}
                      </div>
                      <div className="text-right mr-3">
                        <p className="font-bold text-lg text-green-600">{formatCurrency(r.amount_received)}</p>
                        <div className="flex items-center justify-end mt-1 text-xs text-gray-500">
                          <User className="h-3 w-3 ml-1" />
                          <span>{getUserName(r.created_by)}</span>
                        </div>
                      </div>
                      {currentUser?.role === 'admin' && (
                        <button
                          onClick={() => openDeleteConfirm(r)}
                          className="text-red-600 hover:text-red-800 p-2 rounded-full hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <h3 className="text-xl font-bold text-gray-800 mb-5 flex items-center">
              <Package className="h-6 w-6 ml-2 text-indigo-600" />
              الطلبات ({orders.length})
            </h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {orders.map(o => {
                const feeMethod = paymentMethods.find(m => m.code === o.payment_method) || paymentMethods[0];
                const totalFee = o.total_price * (feeMethod.percentage_fee / 100) + feeMethod.fixed_fee;
                const net = o.total_price - totalFee;
                return (
                  <div key={o.id} className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl p-4 shadow-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-gray-800">#{o.order_number}</p>
                        <p className="text-sm text-gray-600">{o.customer_name}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">{formatCurrency(o.total_price)}</p>
                        <p className="text-xs text-red-600">−{formatCurrency(totalFee)}</p>
                        <p className="text-sm font-bold text-emerald-600">{formatCurrency(net)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {showManualPaymentModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-bold text-gray-900">تسجيل دفع يدوي ({name})</h3>
                  <button onClick={() => setShowManualPaymentModal(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="h-7 w-7" />
                  </button>
                </div>
                <form onSubmit={handleManualPayment} className="space-y-5">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">المبلغ المستلم</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={manualAmount}
                        onChange={e => setManualAmount(e.target.value)}
                        required
                        className="w-full px-4 py-3 pr-12 border-2 border-gray-300 rounded-xl focus:ring-4 focus:ring-green-500 focus:border-green-500 text-lg"
                        placeholder="0.00"
                      />
                      <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-600 font-bold">ر.س</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">تاريخ الاستلام</label>
                    <input
                      type="date"
                      value={manualDate}
                      onChange={e => setManualDate(e.target.value)}
                      required
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-4 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">ملاحظات</label>
                    <textarea
                      value={manualNotes}
                      onChange={e => setManualNotes(e.target.value)}
                      rows={2}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-4 focus:ring-green-500 focus:border-green-500"
                      placeholder="تحويل بنكي، نقدًا، إلخ..."
                    />
                  </div>
                  <div className="flex gap-3 pt-4 border-t border-gray-200">
                    <button
                      type="submit"
                      className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3 px-6 rounded-xl hover:from-green-700 hover:to-emerald-700 font-bold flex items-center justify-center space-x-2 shadow-md"
                    >
                      <CheckCircle className="h-5 w-5" />
                      <span>تسجيل الدفع</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowManualPaymentModal(false)}
                      className="flex-1 bg-gray-200 text-gray-700 py-3 px-6 rounded-xl hover:bg-gray-300 font-bold"
                    >
                      إلغاء
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      );
    }
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <Toaster position="top-center" reverseOrder={false} />
        <div className="mb-10">
          <h2 className="text-3xl font-extrabold text-gray-900">طرق الدفع</h2>
          <p className="text-gray-600 text-lg">اضغط على أي طريقة لعرض التفاصيل</p>
        </div>
        {methodSummaries.length === 0 ? (
          <div className="text-center py-20">
            <Wallet className="h-16 w-16 text-gray-400 mx-auto mb-6" />
            <p className="text-xl text-gray-600">لا توجد طرق دفع نشطة</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {methodSummaries.map(s => (
              <div
                key={s.code}
                onClick={() => setSelectedMethodSummary(s)}
                className="bg-gradient-to-br from-white to-gray-50 border-2 border-gray-200 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:-translate-y-1"
              >
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center space-x-4 space-x-reverse">
                    {s.logo_url ? (
                      <img src={s.logo_url} alt={s.name} className="h-14 w-14 object-contain rounded-xl shadow-md" />
                    ) : (
                      <div className="p-3 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl shadow-md">
                        <Wallet className="h-7 w-7 text-white" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-extrabold text-xl text-gray-900">{s.name}</h3>
                      {s.code === 'salla_basket' && (
                        <p className="text-xs text-indigo-600 mt-1">مدى + بطاقات ائتمانية</p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 font-medium">إجمالي الطلبات:</span>
                    <span className="font-bold text-gray-900">{formatCurrency(s.totalOriginal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 font-medium">المستلم منهم:</span>
                    <span className="font-bold text-green-600">−{formatCurrency(s.totalPaid)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 font-medium">المتبقي:</span>
                    <span className="font-bold text-indigo-600">{formatCurrency(s.totalRemaining)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 font-medium">الرسوم المتوقعة:</span>
                    <span className="font-bold text-red-600">−{formatCurrency(s.expectedFees)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-extrabold pt-4 border-t-2 border-indigo-100">
                    <span className="text-gray-900">المستحق الصافي:</span>
                    <span className="text-emerald-600">{formatCurrency(s.netDue)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };
  // تبويب الموظفين
  const renderEmployeesTab = () => {
    if (selectedEmployee) {
      const { user, current_balance, transactions } = selectedEmployee;
      return (
        <div className="p-6 max-w-7xl mx-auto">
          <Toaster position="top-center" reverseOrder={false} />
          <div className="flex justify-start items-center mb-6">
            <button
              onClick={() => setSelectedEmployee(null)}
              className="flex items-center text-blue-600 hover:text-blue-800 transition-colors"
            >
              <ArrowLeft className="h-5 w-5 ml-2" />
              <span className="font-medium">رجوع</span>
            </button>
          </div>
          <div className="flex items-center mb-8">
            <div className="h-16 w-16 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl shadow-md ml-4 flex items-center justify-center">
              <User className="h-9 w-9 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-gray-900">{user.full_name}</h2>
              <p className="text-gray-600 text-lg">{user.email}</p>
            </div>
          </div>
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-6 mb-8 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-800">ملخص الرصيد</h3>
              <button
                onClick={() => setShowEmployeeTransactionModal(true)}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-3 rounded-xl hover:from-blue-700 hover:to-indigo-700 flex items-center space-x-2 shadow-md transition-all"
              >
                <Banknote className="h-5 w-5" />
                <span className="font-medium">عملية جديدة</span>
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex justify-between text-xl font-extrabold">
                  <span className="text-gray-900">الرصيد الحالي:</span>
                  <span className={current_balance >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                    {formatCurrency(current_balance)}
                  </span>
                </div>
                <div className="flex justify-between text-base">
                  <span className="text-gray-700 font-medium">عدد العمليات:</span>
                  <span className="font-bold text-gray-900">{transactions.length}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-8 shadow-sm">
            <h3 className="text-xl font-bold text-gray-800 mb-5 flex items-center">
              <Receipt className="h-6 w-6 ml-2 text-blue-600" />
              سجل العمليات ({transactions.length})
            </h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {transactions.length === 0 ? (
                <p className="text-center text-gray-500 py-6">لا توجد عمليات مسجلة</p>
              ) : (
                transactions.map(t => (
                  <div key={t.id} className={`rounded-xl p-4 shadow-sm ${
                    t.type === 'credit'
                      ? 'bg-gradient-to-r from-green-50 to-emerald-50'
                      : 'bg-gradient-to-r from-red-50 to-rose-50'
                  }`}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`font-bold text-sm ${
                            t.type === 'credit' ? 'text-green-800' : 'text-red-800'
                          }`}>
                            {t.type === 'credit' ? 'إضافة' : 'سداد'}
                          </span>
                          <span className="font-mono text-sm bg-gray-100 text-gray-700 px-2 py-1 rounded">
                            #{t.id.slice(-6)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600">{formatDate(t.transaction_date)}</p>
                        {t.reason && (
                          <p className="text-xs text-gray-700 mt-1 italic">"{t.reason}"</p>
                        )}
                      </div>
                      <div className="text-right mr-3">
                        <p className={`font-bold text-lg ${
                          t.type === 'credit' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {formatCurrency(t.amount)}
                        </p>
                        <div className="flex items-center justify-end mt-1 text-xs text-gray-500">
                          <User className="h-3 w-3 ml-1" />
                          <span>{t.created_by_user?.full_name || 'النظام'}</span>
                        </div>
                      </div>
                      {currentUser?.role === 'admin' && (
                        <button
                          onClick={() => openTransactionDeleteConfirm(t)}
                          className="text-red-600 hover:text-red-800 p-2 rounded-full hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          {showEmployeeTransactionModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-bold text-gray-900">عملية جديدة ({user.full_name})</h3>
                  <button onClick={() => setShowEmployeeTransactionModal(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="h-7 w-7" />
                  </button>
                </div>
                <form onSubmit={handleEmployeeTransaction} className="space-y-5">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">نوع العملية</label>
                    <select
                      value={employeeTransactionType}
                      onChange={e => setEmployeeTransactionType(e.target.value as 'credit' | 'debit')}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-4 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="credit">إضافة رصيد (مدفوع للموظف)</option>
                      <option value="debit">سداد (خصم من رصيد الموظف)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">المبلغ</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={employeeTransactionAmount}
                        onChange={e => setEmployeeTransactionAmount(e.target.value)}
                        required
                        className="w-full px-4 py-3 pr-12 border-2 border-gray-300 rounded-xl focus:ring-4 focus:ring-blue-500 focus:border-blue-500 text-lg"
                        placeholder="0.00"
                      />
                      <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-600 font-bold">ر.س</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">تاريخ العملية</label>
                    <input
                      type="date"
                      value={employeeTransactionDate}
                      onChange={e => setEmployeeTransactionDate(e.target.value)}
                      required
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-4 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">السبب (اختياري)</label>
                    <textarea
                      value={employeeTransactionReason}
                      onChange={e => setEmployeeTransactionReason(e.target.value)}
                      rows={2}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-4 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="سبب الإضافة أو السداد..."
                    />
                  </div>
                  <div className="flex gap-3 pt-4 border-t border-gray-200">
                    <button
                      type="submit"
                      className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-6 rounded-xl hover:from-blue-700 hover:to-indigo-700 font-bold flex items-center justify-center space-x-2 shadow-md"
                    >
                      <CheckCircle className="h-5 w-5" />
                      <span>تسجيل العملية</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowEmployeeTransactionModal(false)}
                      className="flex-1 bg-gray-200 text-gray-700 py-3 px-6 rounded-xl hover:bg-gray-300 font-bold"
                    >
                      إلغاء
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      );
    }
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <Toaster position="top-center" reverseOrder={false} />
        <div className="mb-10">
          <h2 className="text-3xl font-extrabold text-gray-900">رصيد الموظفين</h2>
          <p className="text-gray-600 text-lg">اضغط على أي موظف لعرض التفاصيل</p>
        </div>
        {employees.length === 0 ? (
          <div className="text-center py-20">
            <Users className="h-16 w-16 text-gray-400 mx-auto mb-6" />
            <p className="text-xl text-gray-600">لا يوجد موظفون نشطون</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {employees.map(emp => (
              <div
                key={emp.user.id}
                onClick={() => setSelectedEmployee(emp)}
                className="bg-gradient-to-br from-white to-gray-50 border-2 border-gray-200 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:-translate-y-1"
              >
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center space-x-4 space-x-reverse">
                    <div className="p-3 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl shadow-md">
                      <User className="h-7 w-7 text-white" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-xl text-gray-900">{emp.user.full_name}</h3>
                      <p className="text-xs text-gray-600 mt-1">{emp.user.email}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-lg font-extrabold pt-4 border-t-2 border-green-100">
                    <span className="text-gray-900">الرصيد الحالي:</span>
                    <span className={emp.current_balance >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                      {formatCurrency(emp.current_balance)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 font-medium">عدد العمليات:</span>
                    <span className="font-bold text-gray-900">{emp.transactions.length}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };
  /* --------------------------------------------------- */
  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-center" reverseOrder={false} />
      {/* شريط التبويبات */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex space-x-1 space-x-reverse rounded-xl bg-gray-100 p-1 max-w-max">
            <button
              onClick={() => setActiveTab('payments')}
              className={`px-4 py-2.5 rounded-lg font-medium transition-all flex items-center space-x-2 space-x-reverse ${
                activeTab === 'payments'
                  ? 'bg-white shadow-sm text-blue-700'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Wallet className="h-5 w-5" />
              <span>طرق الدفع</span>
            </button>
            <button
              onClick={() => setActiveTab('employees')}
              className={`px-4 py-2.5 rounded-lg font-medium transition-all flex items-center space-x-2 space-x-reverse ${
                activeTab === 'employees'
                  ? 'bg-white shadow-sm text-green-700'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Users className="h-5 w-5" />
              <span>رصيد الموظفين</span>
            </button>
          </div>
        </div>
      </div>
      {/* المحتوى حسب التبويب */}
      {activeTab === 'payments' ? renderPaymentsTab() : renderEmployeesTab()}
      {/* نافذة تأكيد الحذف المشتركة */}
      {showDeleteConfirmModal && (receiptToDelete || transactionToDelete) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center mb-4 text-red-600">
              <AlertCircle className="h-8 w-8 ml-3" />
              <h3 className="text-xl font-bold">تأكيد الحذف</h3>
            </div>
            <p className="text-gray-700 mb-6">
              هل أنت متأكد من حذف هذه العملية بقيمة{' '}
              <strong>
                {receiptToDelete ? formatCurrency(receiptToDelete.amount_received) : formatCurrency(transactionToDelete!.amount)}
              </strong>
              ؟
            </p>
            <div className="flex gap-3">
              <button
                onClick={confirmDelete}
                className="flex-1 bg-gradient-to-r from-red-600 to-rose-600 text-white py-3 px-6 rounded-xl hover:from-red-700 hover:to-rose-700 font-bold shadow-md"
              >
                نعم، احذف
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirmModal(false);
                  setReceiptToDelete(null);
                  setTransactionToDelete(null);
                }}
                className="flex-1 bg-gray-200 text-gray-700 py-3 px-6 rounded-xl hover:bg-gray-300 font-bold"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default PaymentReceipts;