import React, { useState, useEffect } from 'react';
import { DollarSign, Truck, Trash2, Clock, AlertCircle } from 'lucide-react';
import { authService } from '../lib/auth';
import { 
  fetchSupplierLedgers, 
  fetchPaymentsByLedger,
  paySupplierLedger,
  deleteSupplierLedger,
  SupplierLedger as SupplierLedgerType,
  SupplierPayment
} from '../lib/supplierService';
import { formatDateTime } from '../lib/dateFormatter';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';

const SupplierLedger = () => {
  const [ledgers, setLedgers] = useState<SupplierLedgerType[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLedger, setSelectedLedger] = useState<SupplierLedgerType | null>(null);
  const [payments, setPayments] = useState<SupplierPayment[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [employeeBalance, setEmployeeBalance] = useState(0);

  const currentUser = authService.getCurrentUser();
  const isAdmin = currentUser?.role === 'admin';

  useEffect(() => {
    loadLedgers();
    loadEmployeeBalance();
  }, []);

  const loadLedgers = async () => {
    setLoading(true);
    const data = await fetchSupplierLedgers();
    setLedgers(data);
    setLoading(false);
  };

  const loadEmployeeBalance = async () => {
    if (!currentUser) return;
    
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('current_balance')
        .eq('id', currentUser.id)
        .single();
      
      setEmployeeBalance(data?.current_balance || 0);
    } catch (error) {
      console.error('Error loading employee balance:', error);
      setEmployeeBalance(0);
    }
  };

  const handleShowPayments = async (ledger: SupplierLedgerType) => {
    setSelectedLedger(ledger);
    const paymentData = await fetchPaymentsByLedger(ledger.id);
    setPayments(paymentData);
  };

  const handlePayment = async () => {
    if (!selectedLedger) return;

    const amount = parseFloat(paymentAmount);

    if (isNaN(amount) || amount <= 0) {
      toast.error('المبلغ غير صحيح');
      return;
    }

    if (amount > employeeBalance) {
      toast.error(`رصيد العهدة غير كافٍ. الرصيد المتاح: ${employeeBalance} ر.س`);
      return;
    }

    if (amount > selectedLedger.remaining_amount) {
      toast.error(`المبلغ أكبر من المتبقي. المبلغ المتبقي: ${selectedLedger.remaining_amount} ر.س`);
      return;
    }

    const result = await paySupplierLedger(selectedLedger.id, amount, paymentNotes);

    if (result.success) {
      toast.success('تم السداد بنجاح');
      setShowPaymentModal(false);
      setPaymentAmount('');
      setPaymentNotes('');
      loadLedgers();
      loadEmployeeBalance();
    } else {
      toast.error(result.error || 'فشل السداد');
    }
  };

  const handleDelete = async (ledgerId: string) => {
    if (!isAdmin) {
      toast.error('غير مصرح لك بالحذف');
      return;
    }

    const confirmed = window.confirm('هل أنت متأكد من حذف هذا المستحق؟');
    if (!confirmed) return;

    const result = await deleteSupplierLedger(ledgerId);

    if (result.success) {
      toast.success('تم الحذف بنجاح');
      loadLedgers();
    } else {
      toast.error(result.error || 'فشل الحذف');
    }
  };

  if (!currentUser) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900">غير مصرح</h2>
        <p className="text-gray-600 mt-2">يجب تسجيل الدخول أولاً</p>
      </div>
    );
  }

  return (
    <div className="p-6 min-h-screen bg-gray-50">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Truck className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">مستحقات الموردين</h1>
        </div>
        <p className="text-gray-600">إدارة المستحقات والسدادات</p>
      </div>

      {/* رصيد العهدة (للموظف) */}
      {!isAdmin && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DollarSign className="h-6 w-6 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">رصيد العهدة المتاح</p>
                <p className="text-2xl font-bold text-gray-900">{employeeBalance.toFixed(2)} ر.س</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* الجدول */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">المورد</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">رقم الطلب</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">التفاصيل</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">المبلغ الأصلي</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">المسدد</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">المتبقي</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">تم بواسطة</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">التاريخ</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                    جاري التحميل...
                  </td>
                </tr>
              ) : ledgers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                    لا توجد مستحقات
                  </td>
                </tr>
              ) : (
                ledgers.map((ledger) => (
                  <tr key={ledger.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {ledger.supplier_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {ledger.order_id || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                      {ledger.product_details}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {ledger.amount.toFixed(2)} ر.س
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                      {ledger.paid_amount.toFixed(2)} ر.س
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-semibold ${ledger.remaining_amount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {ledger.remaining_amount.toFixed(2)} ر.س
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {ledger.locked_by}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {formatDateTime(ledger.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-2">
                        {/* زر السداد (للجميع، لكن يُخصم من عهدة الموظف فقط) */}
                        {ledger.remaining_amount > 0 && (
                          <button
                            onClick={() => {
                              setSelectedLedger(ledger);
                              setShowPaymentModal(true);
                            }}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="سداد دفعة"
                          >
                            <DollarSign className="h-4 w-4" />
                          </button>
                        )}
                        
                        {/* زر عرض السدادات */}
                        <button
                          onClick={() => handleShowPayments(ledger)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="عرض السدادات"
                        >
                          <Clock className="h-4 w-4" />
                        </button>

                        {/* زر الحذف (للمدير فقط) */}
                        {isAdmin && (
                          <button
                            onClick={() => handleDelete(ledger.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="حذف"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal السداد */}
      {showPaymentModal && selectedLedger && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <DollarSign className="h-6 w-6 text-green-600" />
              سداد دفعة للمورد
            </h3>

            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <p className="text-sm text-gray-600 mb-1">المورد</p>
              <p className="font-bold text-lg">{selectedLedger.supplier_name}</p>
              
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div>
                  <p className="text-xs text-gray-500">المبلغ المتبقي</p>
                  <p className="font-semibold text-red-600">{selectedLedger.remaining_amount.toFixed(2)} ر.س</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">رصيد العهدة</p>
                  <p className="font-semibold text-blue-600">{employeeBalance.toFixed(2)} ر.س</p>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2">المبلغ المراد سداده</label>
              <input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="0.00"
                step="0.01"
                min="0"
                max={Math.min(selectedLedger.remaining_amount, employeeBalance)}
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2">ملاحظات (اختياري)</label>
              <textarea
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                rows={3}
                placeholder="أضف ملاحظات..."
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handlePayment}
                className="flex-1 bg-green-600 text-white py-2 rounded-lg font-semibold hover:bg-green-700 transition-colors"
              >
                تأكيد السداد
              </button>
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setPaymentAmount('');
                  setPaymentNotes('');
                }}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal عرض السدادات */}
      {selectedLedger && !showPaymentModal && payments.length > 0 && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Clock className="h-6 w-6 text-blue-600" />
                سجل السدادات - {selectedLedger.supplier_name}
              </h3>
              <button
                onClick={() => {
                  setSelectedLedger(null);
                  setPayments([]);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                ✕
              </button>
            </div>

            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700">المبلغ</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700">تم بواسطة</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700">التاريخ</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700">ملاحظات</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-4 py-3 text-sm font-semibold text-green-600">
                      {payment.paid_amount.toFixed(2)} ر.س
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{payment.paid_by}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatDateTime(payment.payment_date)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {payment.notes || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierLedger;
