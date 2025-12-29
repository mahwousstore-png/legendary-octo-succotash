import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, Banknote, Package, Receipt, Trash2, Wallet, X, CheckCircle,
  CreditCard, Smartphone, User, AlertCircle
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
  const { orders: allOrders } = useOrders();
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [userProfiles, setUserProfiles] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedMethodSummary, setSelectedMethodSummary] = useState<PaymentMethodSummary | null>(null);
  const [showManualPaymentModal, setShowManualPaymentModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [receiptToDelete, setReceiptToDelete] = useState<PaymentReceipt | null>(null);

  const [manualAmount, setManualAmount] = useState<string>('');
  const [manualDate, setManualDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [manualNotes, setManualNotes] = useState<string>('');

  const currentUser = authService.getCurrentUser();
  const [methodSummaries, setMethodSummaries] = useState<PaymentMethodSummary[]>([]);

  // للعد التنازلي
  const [countdown, setCountdown] = useState<number | null>(null);
  const [pendingEntryCode, setPendingEntryCode] = useState<string | null>(null);

  /* --------------------------------------------------- */
  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (paymentMethods.length > 0) {
      calculateMethodSummaries();
    }
  }, [paymentMethods, allOrders, receipts, userProfiles]);

  /* --------------------------------------------------- */
  useEffect(() => {
    if (countdown === null || countdown <= 0) return;

    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown]);

  useEffect(() => {
    if (countdown === 0 && pendingEntryCode) {
      const targetSummary = methodSummaries.find(s => s.code === pendingEntryCode);
      if (targetSummary) {
        setSelectedMethodSummary(targetSummary);
      }
      setPendingEntryCode(null);
      setCountdown(null);
    }
  }, [countdown, pendingEntryCode, methodSummaries]);

  /* --------------------------------------------------- */
  const fetchInitialData = async () => {
    setLoading(true);
    try {
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
      toast.error('فشل جلب البيانات');
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
    if (!currentUser || !manualAmount || !selectedMethodSummary) return;

    const amount = parseFloat(manualAmount);
    if (amount <= 0) return;

    try {
      const receiptNumber = await generateReceiptNumber();

      // تحديد طريقة الدفع المستهدفة
      let targetCode = selectedMethodSummary.code;
      if (['mada', 'credit_card'].includes(targetCode)) {
        targetCode = 'salla_basket'; // استثناء: مدى وبطاقة → سلة
      }

      const targetMethod = paymentMethods.find(m => m.code === targetCode);
      if (!targetMethod) throw new Error('طريقة الدفع غير موجودة');

      // 1. إضافة الإيصال
      const newReceipt: PaymentReceipt = {
        id: `local-${Date.now()}`,
        order_id: null,
        payment_method_code: targetCode,
        amount_received: amount,
        receipt_date: manualDate,
        notes: manualNotes || undefined,
        created_by: currentUser.id,
        receipt_number: receiptNumber,
      };

      // 2. تحديث الحالة محليًا (فوري)
      setReceipts(prev => [newReceipt, ...prev]);

      const updatedMethods = paymentMethods.map(m =>
        m.code === targetCode ? { ...m, total_paid: (m.total_paid || 0) + amount } : m
      );
      setPaymentMethods(updatedMethods);

      // 3. إرسال للخادم
      await supabase.from('payment_receipts').insert({
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
        receipt_number: receiptNumber
      });

      await supabase
        .from('payment_methods')
        .update({ total_paid: (targetMethod.total_paid || 0) + amount })
        .eq('id', targetMethod.id);

      // 4. إغلاق النافذة + إعادة تعيين النموذج
      resetManualForm();
      setShowManualPaymentModal(false);
      toast.success(`تم تسجيل الدفع: ${receiptNumber}`);

      // 5. الرجوع + العد التنازلي + الدخول
      setSelectedMethodSummary(null);
      setCountdown(3);
      setPendingEntryCode(targetCode);

    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء التسجيل');
    }
  };

  /* --------------------------------------------------- */
  const openDeleteConfirm = (receipt: PaymentReceipt) => {
    setReceiptToDelete(receipt);
    setShowDeleteConfirmModal(true);
  };

  const confirmDelete = async () => {
    if (!receiptToDelete || !currentUser || currentUser.role !== 'admin') return;

    try {
      const rec = receiptToDelete;
      const targetCode = rec.payment_method_code;

      // تحديث محلي
      setReceipts(prev => prev.filter(r => r.id !== rec.id));

      const updatedMethods = paymentMethods.map(m =>
        m.code === targetCode ? { ...m, total_paid: Math.max(0, (m.total_paid || 0) - rec.amount_received) } : m
      );
      setPaymentMethods(updatedMethods);

      // حذف من الخادم
      await supabase.from('payment_receipts').delete().eq('id', rec.id);

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

      setShowDeleteConfirmModal(false);
      setReceiptToDelete(null);
      toast.success(`تم حذف الإيصال: ${rec.receipt_number || `#${rec.id}`}`);
      calculateMethodSummaries();

    } catch (err) {
      console.error(err);
      toast.error('خطأ أثناء الحذف');
    }
  };

  const resetManualForm = () => {
    setManualAmount('');
    setManualNotes('');
    setManualDate(new Date().toISOString().split('T')[0]);
  };

  const formatCurrency = (v: number): string => {
  // تقريب الرقم إلى رقمين عشريين أولاً
  const rounded = Math.round(v * 100) / 100;
  
  // تنسيق باللغة العربية مع فصل الآلاف وثبات رقمين عشريين
  return `${rounded.toLocaleString('EN-SA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ر.س`;
};

  const formatDate = (d: string) => new Date(d).toLocaleDateString('ar-SA');

  const getUserName = (userId: string) => userProfiles.get(userId) || 'مستخدم';

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
                <span className="text-gray-700 font-medium">المسدد:</span>
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

        {/* باقي المحتوى (الإيصالات، الطلبات، المودالات) */}
        {/* ... نفس الكود السابق ... */}
      </div>
    );
  }

  /* --------------------------------------------------- */
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Toaster position="top-center" reverseOrder={false} />

      <div className="mb-10">
        <h2 className="text-3xl font-extrabold text-gray-900">طرق الدفع</h2>
        <p className="text-gray-600 text-lg">اضغط على أي طريقة لعرض التفاصيل</p>

        {/* العد التنازلي */}
        {countdown !== null && (
          <div className="mt-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 shadow-sm flex items-center justify-center">
            <span className="text-lg font-bold text-indigo-700">
              العودة إلى الطريقة بعد <span className="text-2xl">{countdown}</span> ثوانٍ...
            </span>
          </div>
        )}
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
              onClick={() => {
                setSelectedMethodSummary(s);
                setCountdown(null); // إلغاء العد إذا اختار يدويًا
                setPendingEntryCode(null);
              }}
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
                  <span className="text-gray-600 font-medium">المسدد:</span>
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

export default PaymentReceipts;