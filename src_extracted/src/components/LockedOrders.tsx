import React, { useState, useEffect } from 'react';
import {
  Search, Download, Eye, Lock, Package, DollarSign, Edit, Save, X, CreditCard, Banknote, Receipt, Ban, Trash2, History, User, Plus, AlertTriangle, Loader2
} from 'lucide-react';
import { useOrders } from '../hooks/useOrders';
import { useReceivables } from '../hooks/useReceivables';
import { Order } from '../types/order';
import { Entity } from '../types/receivables';
import * as XLSX from 'xlsx';
import { authService } from '../lib/auth';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface PaymentMethod {
  id: string;
  code: string;
  name: string;
  percentage_fee: number;
  fixed_fee: number;
}

const PAYMENT_METHOD_OPTIONS = [
  { value: 'bank', label: 'تحويل بنكي', icon: Banknote },
  { value: 'cod', label: 'دفع عند الاستلام', icon: Receipt },
  { value: 'credit_card', label: 'بطاقة ائتمانية', icon: CreditCard },
  { value: 'mada', label: 'مدى', icon: CreditCard },
  { value: 'madfu_installment', label: 'مدفوع للتقسيط', icon: Package },
  { value: 'tabby_installment', label: 'تابي', icon: Package },
  { value: 'tamara_installment', label: 'تمارا', icon: Package },
] as const;

const TAX_RATE = 0.15;

const LockedOrders: React.FC = () => {
  const { orders, loading, error, refetch } = useOrders();
  const { entities } = useReceivables();
  const currentUser = authService.getCurrentUser();
  const isAdmin = currentUser?.role === 'admin';
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [editedOrder, setEditedOrder] = useState<Order | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [cancelFormData, setCancelFormData] = useState({
    reason: '',
    fee: 0,
    feeBearer: 'customer' as 'customer' | 'store',
    cancelledBy: currentUser?.full_name || currentUser?.email || '',
  });
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const itemsPerPage = 10;
  const [orderLogs, setOrderLogs] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (selectedOrder) {
      const fetchLogs = async () => {
        const { data, error } = await supabase
          .from('order_logs')
          .select('*')
          .eq('order_id', selectedOrder.id)
          .order('created_at', { ascending: false });
        if (!error) {
          setOrderLogs(data || []);
        }
      };
      fetchLogs();
    } else {
      setOrderLogs([]);
    }
  }, [selectedOrder]);

  useEffect(() => {
    const fetchPaymentMethods = async () => {
      try {
        const { data, error } = await supabase
          .from('payment_methods')
          .select('id, code, name, percentage_fee, fixed_fee')
          .eq('is_active', true);
        if (error) throw error;
        setPaymentMethods(data || []);
      } catch (err) {
        console.error('Error fetching payment methods:', err);
      }
    };
    fetchPaymentMethods();
  }, []);

  const formatDateTime = (dateString: string) => {
    const [datePart, timePart] = dateString.split('T');
    const [year, month, day] = datePart.split('-');
    const [hour, minute] = timePart.substring(0, 5).split(':');
    let h = parseInt(hour, 10);
    const period = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${day}/${month}/${year} - ${h.toString().padStart(2, '0')}:${minute} ${period}`;
  };

  const getPaymentMethodLabel = (method: string | undefined) => {
    if (!method) return 'غير محدد';
    const option = PAYMENT_METHOD_OPTIONS.find(opt => opt.value === method);
    return option?.label || method;
  };

  const getPaymentFee = (paymentMethodCode: string | undefined, totalPrice: number) => {
    if (!paymentMethodCode) return { fee: 0, percentage: 0, fixed: 0 };
    const method = paymentMethods.find(m => m.code === paymentMethodCode);
    if (!method) return { fee: 0, percentage: 0, fixed: 0 };
    const percentageFee = totalPrice * (method.percentage_fee / 100);
    const totalFee = percentageFee + method.fixed_fee;
    return { fee: totalFee, percentage: method.percentage_fee, fixed: method.fixed_fee };
  };

  const getSupplierName = (supplierId: string | undefined) => {
    if (!supplierId) return 'غير محدد';
    const entity = entities.find((e: Entity) => e.id === supplierId);
    return entity?.name || 'غير محدد';
  };

  // معالجة shipping_bearer
  const getEffectiveShippingBearer = (bearer: any): 'customer' | 'store' => {
    return bearer === 'store' ? 'store' : 'customer';
  };

  const getShippingBearerLabel = (bearer: any): string => {
    return getEffectiveShippingBearer(bearer) === 'store' ? 'المتجر' : 'المشتري';
  };

  const getShippingBearerStyle = (bearer: any): string => {
    return getEffectiveShippingBearer(bearer) === 'customer'
      ? 'bg-green-100 text-green-800'
      : 'bg-red-100 text-red-800';
  };

  const calculateNetProfit = (order: Order) => {
    const revenue = order.total_price || 0;
    const productCostInclTax = order.products?.reduce((sum, p) => sum + (p.cost_subtotal || 0), 0) || 0;
    const shipping = order.shipping_cost || 0;
    const shippingWithTax = shipping * (1 + TAX_RATE);
    const { fee: paymentFee } = getPaymentFee(order.payment_method, revenue);
    const netProfit = revenue - paymentFee - shippingWithTax - productCostInclTax;
    const margin = (order.subtotal_before_tax || 0) > 0 ? (netProfit / (order.subtotal_before_tax || 0)) * 100 : 0;
    return {
      netProfit,
      margin,
      productCostInclTax,
      shippingWithTax,
      shippingBearer: getEffectiveShippingBearer((order as any).shipping_bearer)
    };
  };

  const lockedOrders = orders
    .filter(order => order.is_locked === true)
    .filter(order => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      const name = (order.customer_name || '').toLowerCase();
      const phone = (order.phone_number || '').toString();
      const number = (order.order_number || '').toString().toLowerCase();
      return name.includes(term) || phone.includes(term) || number.includes(term);
    })
    .sort((a, b) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime());

  const totalPages = Math.ceil(lockedOrders.length / itemsPerPage);
  const paginatedOrders = lockedOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleEdit = (order: Order) => {
    if (!isAdmin) {
      toast.error('غير مسموح لك بتعديل الطلبات المقفلة');
      return;
    }
    setEditedOrder({
      ...order,
      products: order.products?.map(p => ({ ...p })) || [],
      shipping_bearer: (order as any).shipping_bearer || 'customer'
    });
    setSelectedOrder(order);
    setEditMode(true);
  };

  const handleAddProduct = () => {
    if (!editedOrder) return;
    const newProduct = {
      id: `new-${Date.now()}`,
      name: '',
      quantity: 1,
      unit_price: 0,
      cost_subtotal: 0,
      subtotal: 0,
      cost_price: 0,
      supplier_id: undefined,
      supplier_name: '',
    };
    setEditedOrder({
      ...editedOrder,
      products: [...(editedOrder.products || []), newProduct]
    });
  };

  const handleSave = async () => {
    if (!editedOrder) return;
    setIsSaving(true);
    try {
      // 1. تحديث بيانات الطلب
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          customer_name: editedOrder.customer_name?.trim() || null,
          phone_number: editedOrder.phone_number?.trim() || null,
          shipping_company: editedOrder.shipping_company?.trim() || null,
          shipping_cost: parseFloat(editedOrder.shipping_cost?.toString() || '0') || 0,
          total_price: editedOrder.total_price || 0,
          payment_method: editedOrder.payment_method || null,
          shipping_bearer: editedOrder.shipping_bearer || 'customer',
        })
        .eq('id', editedOrder.id);
      if (orderError) throw orderError;
      // 2. تحديث المنتجات
      if (editedOrder.products && editedOrder.products.length > 0) {
        // فصل المنتجات الجديدة عن المنتجات الموجودة
        const newProducts = editedOrder.products.filter(p => p.id?.toString().startsWith('new-'));
        const existingProducts = editedOrder.products.filter(p => !p.id?.toString().startsWith('new-'));

        // تحديث المنتجات الموجودة
        if (existingProducts.length > 0) {
          const updates = existingProducts.map(p => ({
            id: p.id,
            order_id: editedOrder.id,
            product_name: p.name || 'منتج بدون اسم',
            quantity: Math.max(1, parseInt(p.quantity?.toString() || '1', 10)),
            unit_price: parseFloat(p.unit_price?.toString() || '0') || 0,
            cost_price: (parseFloat(p.cost_subtotal?.toString() || '0') || 0) /
              Math.max(1, parseInt(p.quantity?.toString() || '1', 10)),
            subtotal: (parseFloat(p.unit_price?.toString() || '0') || 0) *
              Math.max(1, parseInt(p.quantity?.toString() || '1', 10)),
            cost_subtotal: parseFloat(p.cost_subtotal?.toString() || '0') || 0,
            supplier_id: p.supplier_id || null,
            supplier_name: getSupplierName(p.supplier_id),
            receivable_id: null as string | null,
          }));
          const { error: updateError } = await supabase
            .from('order_products')
            .upsert(updates, { onConflict: 'id' });
          if (updateError) throw updateError;
        }

        // إضافة المنتجات الجديدة
        if (newProducts.length > 0) {
          const inserts = newProducts.map(p => ({
            order_id: editedOrder.id,
            product_name: p.name || 'منتج بدون اسم',
            quantity: Math.max(1, parseInt(p.quantity?.toString() || '1', 10)),
            unit_price: parseFloat(p.unit_price?.toString() || '0') || 0,
            cost_price: (parseFloat(p.cost_subtotal?.toString() || '0') || 0) /
              Math.max(1, parseInt(p.quantity?.toString() || '1', 10)),
            subtotal: (parseFloat(p.unit_price?.toString() || '0') || 0) *
              Math.max(1, parseInt(p.quantity?.toString() || '1', 10)),
            cost_subtotal: parseFloat(p.cost_subtotal?.toString() || '0') || 0,
            supplier_id: p.supplier_id || null,
            supplier_name: getSupplierName(p.supplier_id),
            receivable_id: null as string | null,
          }));
          const { error: insertError } = await supabase
            .from('order_products')
            .insert(inserts);
          if (insertError) throw insertError;
        }
      }
      // 3. تحديث مستحقات الموردين مع ربط receivable_id بالمنتجات
      if (editedOrder.products && editedOrder.products.length > 0) {
        const supplierCosts: Record<string, { cost: number; productIds: string[] }> = {};
        editedOrder.products.forEach(p => {
          const supplierId = p.supplier_id;
          const cost = parseFloat(p.cost_subtotal?.toString() || '0') || 0;
          if (supplierId && cost > 0) {
            if (!supplierCosts[supplierId]) {
              supplierCosts[supplierId] = { cost: 0, productIds: [] };
            }
            supplierCosts[supplierId].cost += cost;
            supplierCosts[supplierId].productIds.push(p.id);
          }
        });
        // حذف المستحقات القديمة
        await supabase
          .from('receivables')
          .delete()
          .ilike('description', `طلب #${editedOrder.order_number}%`);
        // إنشاء مستحقات جديدة وربط receivable_id بالمنتجات
        for (const [supplierId, { cost, productIds }] of Object.entries(supplierCosts)) {
          const { data: newReceivable, error } = await supabase
            .from('receivables')
            .insert({
              entity_id: supplierId,
              description: `طلب #${editedOrder.order_number} - تكلفة المنتجات`,
              total_amount: parseFloat(cost.toFixed(2)),
              remaining_amount: parseFloat(cost.toFixed(2)),
              purchase_date: new Date().toISOString().split('T')[0],
              due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              notes: `تم إنشاؤه تلقائيًا عند تعديل التكلفة - طلب #${editedOrder.order_number}`,
            })
            .select()
            .single();
          if (error) {
            console.error('فشل إنشاء مستحق للمورد:', error);
            continue;
          }
          // ربط receivable_id بالمنتجات
          if (newReceivable?.id && productIds.length > 0) {
            await supabase
              .from('order_products')
              .update({ receivable_id: newReceivable.id })
              .in('id', productIds);
          }
        }
      }
      // توليد تفاصيل التغييرات
      const changes: string[] = [];
      if (selectedOrder) {
        if (selectedOrder.customer_name !== editedOrder.customer_name) changes.push(`تعديل اسم العميل من "${selectedOrder.customer_name}" إلى "${editedOrder.customer_name}"`);
        if (selectedOrder.phone_number !== editedOrder.phone_number) changes.push(`تعديل رقم الهاتف من "${selectedOrder.phone_number}" إلى "${editedOrder.phone_number}"`);
        if (selectedOrder.shipping_company !== editedOrder.shipping_company) changes.push(`تعديل شركة الشحن من "${selectedOrder.shipping_company}" إلى "${editedOrder.shipping_company}"`);
        if (selectedOrder.shipping_cost !== editedOrder.shipping_cost) changes.push(`تعديل تكلفة الشحن من ${selectedOrder.shipping_cost} إلى ${editedOrder.shipping_cost}`);
        if ((selectedOrder as any).shipping_bearer !== editedOrder.shipping_bearer) changes.push(`تعديل متحمل الشحن`);
        if (selectedOrder.payment_method !== editedOrder.payment_method) changes.push(`تعديل طريقة الدفع`);
        if (selectedOrder.total_price !== editedOrder.total_price) changes.push(`تعديل إجمالي الطلب من ${selectedOrder.total_price} إلى ${editedOrder.total_price}`);

        // مقارنة المنتجات
        editedOrder.products?.forEach(p => {
          const original = selectedOrder.products?.find(op => op.id === p.id);
          if (original) {
            if (original.quantity !== p.quantity) changes.push(`تعديل كمية ${p.name} من ${original.quantity} إلى ${p.quantity}`);
            if (original.unit_price !== p.unit_price) changes.push(`تعديل سعر ${p.name} من ${original.unit_price} إلى ${p.unit_price}`);
            if (original.cost_subtotal !== p.cost_subtotal) changes.push(`تعديل تكلفة ${p.name} من ${original.cost_subtotal} إلى ${p.cost_subtotal}`);
          }
        });
      }

      const detailsText = changes.length > 0 ? changes.join('، ') : `تم تعديل الطلب #${editedOrder.order_number}`;

      // تسجيل التعديل في السجل
      await supabase.from('order_logs').insert({
        order_id: editedOrder.id,
        user_name: currentUser?.full_name || currentUser?.email || 'Unknown',
        action: 'edit',
        details: detailsText
      });

      toast.success('تم حفظ الطلب وتحديث مستحقات الموردين وربطها بالمنتجات بنجاح!');
      setEditMode(false);
      setEditedOrder(null);
      setSelectedOrder(null);
      await refetch();
    } catch (err: any) {
      console.error('فشل في الحفظ:', err);
      toast.error('فشل في الحفظ: ' + (err.message || 'خطأ غير معروف'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setEditedOrder(null);
  };

  const handleCancelOrder = (order: Order) => {
    if (!isAdmin) {
      toast.error('غير مسموح لك بإلغاء الطلبات المقفلة');
      return;
    }
    setCancellingOrderId(order.id);
    setCancelFormData({
      reason: '',
      fee: 0,
      feeBearer: 'customer',
      cancelledBy: currentUser?.email || currentUser?.full_name || '',
    });
    setShowCancelModal(true);
  };

  const executeCancel = async () => {
    if (!cancellingOrderId || !cancelFormData.reason || cancelFormData.fee < 0) {
      toast.error('يجب إدخال سبب الإلغاء ورسوم صحيحة');
      return;
    }
    try {
      const order = orders.find(o => o.id === cancellingOrderId);
      // 1. تحديث الطلب إلى ملغي وإلغاء القفل
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          status: 'ملغي',
          is_locked: false,
          cancelled_by: cancelFormData.cancelledBy,
          cancellation_reason: cancelFormData.reason,
          cancellation_fee: cancelFormData.fee,
          fee_bearer: cancelFormData.feeBearer,
          updated_at: new Date().toISOString(),
        })
        .eq('id', cancellingOrderId);
      if (updateError) throw updateError;
      // 2. إذا كان المتجر يتحمل الرسوم، أضف مصروفاً جديداً
      if (cancelFormData.feeBearer === 'store' && cancelFormData.fee > 0) {
        const { error: expenseError } = await supabase
          .from('expenses')
          .insert([{
            description: `رسوم إلغاء طلب رقم ${order?.order_number || cancellingOrderId}`,
            amount: cancelFormData.fee,
            category: 'رسوم إلغاء',
            date: new Date().toISOString().split('T')[0],
          }]);
        if (expenseError) {
          console.error('فشل في إضافة المصروف:', expenseError);
        }
      }
      toast.success('تم إلغاء الطلب بنجاح وإلغاء قفله');
      setShowCancelModal(false);
      setCancellingOrderId(null);
      setSelectedOrder(null);
      await refetch();
    } catch (err: any) {
      console.error('خطأ في الإلغاء:', err);
      toast.error('حدث خطأ في الإلغاء: ' + err.message);
    }
  };

  const handleDeleteOrder = (order: Order) => {
    if (!isAdmin) {
      toast.error('غير مسموح لك بحذف الطلبات');
      return;
    }
    setDeletingOrderId(order.id);
    setShowDeleteModal(true);
  };

  const executeDelete = async () => {
    if (!deletingOrderId) return;
    try {
      const order = orders.find(o => o.id === deletingOrderId);
      // حذف المستحقات المتعلقة
      await supabase
        .from('receivables')
        .delete()
        .ilike('description', `طلب #${order?.order_number}%`);
      // حذف المنتجات المتعلقة
      await supabase
        .from('order_products')
        .delete()
        .eq('order_id', deletingOrderId);
      // حذف الطلب
      await supabase
        .from('orders')
        .delete()
        .eq('id', deletingOrderId);
      toast.success('تم حذف الطلب نهائياً بنجاح');
      setShowDeleteModal(false);
      setDeletingOrderId(null);
      setSelectedOrder(null);
      await refetch();
    } catch (err: any) {
      console.error('خطأ في الحذف:', err);
      toast.error('حدث خطأ في الحذف: ' + (err.message || 'خطأ غير معروف'));
    }
  };

  const exportToExcel = () => {
    const headers = [
      'رقم الطلب', 'تاريخ الطلب', 'اسم العميل', 'رقم الهاتف', 'طريقة الدفع', 'من يحمل الشحن',
      'إجمالي المبيعات', 'رسوم الدفع', 'تكلفة المنتجات', 'تكلفة الشحن مع الضريبة', 'صافي الربح', 'هامش الربح %'
    ];
    const data = lockedOrders.map(order => {
      const { netProfit, margin, productCostInclTax, shippingWithTax } = calculateNetProfit(order);
      const { fee: paymentFee } = getPaymentFee(order.payment_method, order.total_price || 0);
      return [
        `#${order.order_number}`,
        formatDateTime(order.order_date),
        order.customer_name || '',
        order.phone_number || '',
        getPaymentMethodLabel(order.payment_method),
        getShippingBearerLabel((order as any).shipping_bearer),
        (order.total_price || 0).toFixed(2),
        paymentFee.toFixed(2),
        productCostInclTax.toFixed(2),
        shippingWithTax.toFixed(2),
        netProfit.toFixed(2),
        margin.toFixed(1) + '%'
      ];
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    ws['!cols'] = headers.map(() => ({ wch: 22 }));
    XLSX.utils.book_append_sheet(wb, ws, 'الطلبات المقفلة');
    XLSX.writeFile(wb, `الطلبات_المقفلة_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (loading) return <div className="p-6 text-center">جاري التحميل...</div>;
  if (error) return <div className="p-6 text-red-600">خطأ: {error}</div>;

  const formatNumber = (num: number, decimals = 2) => {
    return num.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  const formatPercent = (num: number) => {
    return num.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  };

  return (
    <div className="p-6 min-h-screen bg-gray-50">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900">الطلبات المقفلة</h2>
        <p className="text-gray-600 mt-2">إدارة كاملة للطلبات المكتملة مع تحليل مالي دقيق</p>
      </div>
      <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4 justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="البحث برقم الطلب أو اسم العميل أو الهاتف..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pr-12 pl-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button onClick={exportToExcel} className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700">
            <Download className="h-5 w-5" />
            تصدير إلى Excel
          </button>
        </div>
      </div>
      {/* الجدول */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
              <tr>
                <th className="px-6 py-4 text-right">الطلب</th>
                <th className="px-6 py-4 text-right">العميل</th>
                <th className="px-6 py-4 text-right">الدفع</th>
                <th className="px-6 py-4 text-right">الشحن</th>
                <th className="px-6 py-4 text-right">المبيعات</th>
                <th className="px-6 py-4 text-right">الرسوم</th>
                <th className="px-6 py-4 text-right">التكاليف</th>
                <th className="px-6 py-4 text-right">صافي الربح</th>
                <th className="px-6 py-4 text-right">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedOrders.map(order => {
                const { netProfit, margin, productCostInclTax, shippingWithTax } = calculateNetProfit(order);
                const { fee: paymentFee } = getPaymentFee(order.payment_method, order.total_price || 0);
                const totalCosts = productCostInclTax + shippingWithTax;
                const rawBearer = (order as any).shipping_bearer;
                return (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Lock className="h-5 w-5 text-green-600" />
                        <div>
                          <div className="font-bold">#{order.order_number}</div>
                          <div className="text-xs text-gray-500">{formatDateTime(order.order_date).split(' - ')[0]}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium">{order.customer_name}</div>
                        <div className="text-sm text-gray-500">{order.phone_number}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                        {getPaymentMethodLabel(order.payment_method)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${getShippingBearerStyle(rawBearer)}`}>
                        {getShippingBearerLabel(rawBearer)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-indigo-700">
                      {formatNumber(order.total_price || 0)} ر.س
                    </td>
                    <td className="px-6 py-4 text-right text-orange-700">
                      {paymentFee > 0 ? formatNumber(paymentFee) + ' ر.س' : '—'}
                    </td>
                    <td className="px-6 py-4 text-right text-red-700 font-medium">
                      {formatNumber(totalCosts)} ر.س
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className={`font-bold ${netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {formatNumber(netProfit)} ر.س
                      </div>
                      <div className="text-xs">{formatPercent(margin)}%</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setSelectedOrder(order)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg">
                          <Eye className="h-5 w-5" />
                        </button>
                        {isAdmin && (
                          <button onClick={() => handleEdit(order)} className="p-2 text-amber-600 hover:bg-amber-100 rounded-lg">
                            <Edit className="h-5 w-5" />
                          </button>
                        )}
                        {isAdmin && (
                          <>
                            <button onClick={() => handleCancelOrder(order)} className="p-2 text-red-600 hover:bg-red-100 rounded-lg" title="إلغاء الطلب">
                              <Ban className="h-5 w-5" />
                            </button>
                            <button onClick={() => handleDeleteOrder(order)} className="p-2 text-red-800 hover:bg-red-100 rounded-lg" title="حذف نهائي">
                              <Trash2 className="h-5 w-5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* التنقل بين الصفحات */}
        {totalPages > 1 && (
          <div className="bg-gray-50 px-6 py-4 flex justify-between items-center">
            <span className="text-sm text-gray-600">
              عرض {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, lockedOrders.length)} من {lockedOrders.length}
            </span>
            <div className="flex gap-2">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                className="px-4 py-2 border rounded-lg disabled:opacity-50">السابق</button>
              {[...Array(Math.min(5, totalPages))].map((_, i) => {
                const page = i + Math.max(1, currentPage - 2);
                if (page > totalPages) return null;
                return (
                  <button key={page} onClick={() => setCurrentPage(page)}
                    className={`px-4 py-2 rounded-lg ${currentPage === page ? 'bg-indigo-600 text-white' : 'border'}`}>
                    {page}
                  </button>
                );
              })}
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                className="px-4 py-2 border rounded-lg disabled:opacity-50">التالي</button>
            </div>
          </div>
        )}
      </div>
      {/* نافذة عرض التفاصيل – تصميم أبيض نظيف بدون بنفسجي نهائيًا */}
      {selectedOrder && !editMode && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[95vh] overflow-y-auto">

            {/* العنوان – شريط أزرق فاتح فقط */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-5 rounded-t-2xl flex justify-between items-center">
              <h3 className="text-2xl font-bold flex items-center gap-3">
                <Lock className="h-9 w-9" />
                طلب مقفل رقم #{selectedOrder.order_number}
              </h3>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-2.5 bg-white/20 hover:bg-white/30 rounded-full transition-all"
              >
                <X className="h-7 w-7" />
              </button>
            </div>
            <div className="p-8 space-y-10">
              {/* بيانات العميل والشحن – كروت بيضاء بحدود خفيفة */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                  <h4 className="text-gray-600 font-medium mb-2">العميل</h4>
                  <p className="text-2xl font-bold text-gray-900">{selectedOrder.customer_name}</p>
                  <p className="text-blue-600 mt-1">{selectedOrder.phone_number}</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                  <h4 className="text-gray-600 font-medium mb-2">تاريخ الطلب</h4>
                  <p className="text-2xl font-bold text-gray-900">{formatDateTime(selectedOrder.order_date)}</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                  <h4 className="text-gray-600 font-medium mb-2">طريقة الدفع</h4>
                  <p className="text-xl font-bold text-gray-900 flex items-center justify-center gap-2">
                    <CreditCard className="h-6 w-6 text-amber-600" />
                    {getPaymentMethodLabel(selectedOrder.payment_method)}
                  </p>
                </div>
                <div className={`bg-white border-2 rounded-xl p-6 shadow-sm text-center ${getEffectiveShippingBearer((selectedOrder as any).shipping_bearer) === 'customer'
                  ? 'border-green-500'
                  : 'border-red-500'
                  }`}>
                  <h4 className="text-gray-600 font-medium mb-3">تحمل تكلفة الشحن</h4>
                  <p className={`text-3xl font-bold ${getEffectiveShippingBearer((selectedOrder as any).shipping_bearer) === 'customer'
                    ? 'text-green-600' : 'text-red-600'
                    }`}>
                    {getShippingBearerLabel((selectedOrder as any).shipping_bearer)}
                  </p>
                  <div className="mt-4 text-sm">
                    <p className="text-gray-600">الأساسية: {formatNumber(selectedOrder.shipping_cost || 0)} ر.س</p>
                    <p className="font-semibold text-red-600">
                      مع الضريبة: {formatNumber((selectedOrder.shipping_cost || 0) * 1.15)} ر.س
                    </p>
                  </div>
                </div>
              </div>
              {/* المنتجات – خلفية بيضاء مع خطوط فاصلة خفيفة */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                  <h3 className="text-xl font-bold text-gray-800 flex items-center gap-3">
                    <Package className="h-7 w-7 text-blue-600" />
                    المنتجات ({selectedOrder.products?.length || 0})
                  </h3>
                </div>
                <div className="divide-y divide-gray-200">
                  {selectedOrder.products?.map((p, i) => {
                    const unitPriceInclTax = (p.unit_price || 0) * (1 + TAX_RATE);
                    const subtotalInclTax = (p.subtotal || 0) * (1 + TAX_RATE);
                    return (
                      <div key={i} className="p-6 hover:bg-gray-50 transition-colors">
                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 text-center">
                          <div className="lg:text-right lg:col-span-2">
                            <h4 className="text-lg font-bold text-gray-900">{p.name}</h4>
                            <p className="text-sm text-gray-500">المورد: {getSupplierName(p.supplier_id)}</p>
                            <p className="text-sm text-gray-600 mt-1">الكمية: ×{p.quantity}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">سعر البيع (شامل الضريبة)</p>
                            <p className="font-bold text-blue-700">{formatNumber(unitPriceInclTax)} ر.س</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">الإيراد (شامل الضريبة)</p>
                            <p className="font-bold text-green-700">{formatNumber(subtotalInclTax)} ر.س</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">تكلفة شاملة الضريبة</p>
                            <p className="font-bold text-red-700 text-lg">{formatNumber(p.cost_subtotal || 0)} ر.س</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* التحليل المالي – خلفية بيضاء مع كروت ملونة خفيفة */}
              <div className="bg-gray-50 rounded-2xl p-8 border border-gray-200">
                <h3 className="text-2xl font-bold text-center mb-8 text-gray-800">
                  <DollarSign className="inline h-9 w-9 text-blue-600 mr-2" />
                  التحليل المالي الشامل
                </h3>
                {(() => {
                  const { netProfit, margin, productCostInclTax, shippingWithTax } = calculateNetProfit(selectedOrder);
                  const revenue = selectedOrder.total_price || 0;
                  const { fee: paymentFee, percentage, fixed } = getPaymentFee(selectedOrder.payment_method, revenue);
                  const totalDeductions = paymentFee + shippingWithTax + productCostInclTax;
                  return (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* الإيرادات */}
                      <div className="bg-white rounded-xl p-6 border border-blue-200 shadow-sm">
                        <h4 className="font-bold text-blue-800 mb-4 text-lg">الإيرادات</h4>
                        <p className="text-3xl font-bold text-blue-900">
                          {formatNumber(revenue)} ر.س
                        </p>
                      </div>
                      {/* التكاليف */}
                      <div className="bg-white rounded-xl p-6 border border-red-200 shadow-sm">
                        <h4 className="font-bold text-red-800 mb-4 text-lg">إجمالي التكاليف</h4>
                        <div className="space-y-3 text-right text-sm">
                          <div className="flex justify-between"><span>رسوم الدفع:</span><span className="font-bold text-orange-600">{formatNumber(paymentFee)} ر.س</span></div>
                          <div className="flex justify-between"><span>شحن + ضريبة:</span><span className="font-bold text-red-600">{formatNumber(shippingWithTax)} ر.س</span></div>
                          <div className="flex justify-between"><span>تكلفة المنتجات:</span><span className="font-bold text-red-600">{formatNumber(productCostInclTax)} ر.س</span></div>
                        </div>
                        <div className="border-t border-gray-300 mt-4 pt-3">
                          <div className="flex justify-between text-lg font-bold">
                            <span>الإجمالي:</span>
                            <span className="text-red-700">{formatNumber(totalDeductions)} ر.س</span>
                          </div>
                        </div>
                      </div>
                      {/* صافي الربح */}
                      <div className={`rounded-xl p-8 text-center text-white shadow-lg ${netProfit >= 0 ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 'bg-gradient-to-br from-red-500 to-rose-600'
                        }`}>
                        <h4 className="text-xl font-bold mb-3">صافي الربح</h4>
                        <div className="text-5xl font-bold mb-3">
                          {formatNumber(netProfit)} ر.س
                        </div>
                        <div className="text-2xl">
                          الهامش: <strong>{formatPercent(margin)}%</strong>
                        </div>
                        <p className="mt-4 text-white/90">
                          {netProfit >= 0 ? 'الطلب مربح' : 'الطلب بخسارة'}
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* سجل الطلب */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                  <h3 className="text-xl font-bold text-gray-800 flex items-center gap-3">
                    <History className="h-6 w-6 text-purple-600" />
                    سجل الطلب
                  </h3>
                  {selectedOrder.locked_by && (
                    <div className="text-sm text-gray-600 bg-purple-50 px-3 py-1 rounded-full border border-purple-100 flex items-center gap-2">
                      <span>تم الإقفال بواسطة: <span className="font-semibold text-purple-700">{selectedOrder.locked_by}</span></span>
                      {selectedOrder.locked_at && (
                        <span className="text-xs text-gray-500 dir-ltr">({new Date(selectedOrder.locked_at).toLocaleString('en-US')})</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="divide-y divide-gray-100">
                  {orderLogs.length > 0 ? (
                    orderLogs.map((log) => (
                      <div key={log.id} className="p-4 hover:bg-gray-50 transition-colors flex items-start gap-4">
                        <div className="mt-1 bg-blue-100 p-2 rounded-full">
                          <User className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-start">
                            <p className="font-semibold text-gray-800">{log.user_name}</p>
                            <span className="text-xs text-gray-500 dir-ltr">{new Date(log.created_at).toLocaleString('en-US')}</span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{log.details}</p>
                          <span className="inline-block mt-2 text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded border border-gray-200">
                            {log.action}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-gray-500">
                      لا يوجد سجلات لهذا الطلب
                    </div>
                  )}
                </div>
              </div>
              {/* زر الإغلاق */}
              <div className="text-center pt-4">
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="px-10 py-4 bg-gray-700 text-white rounded-xl hover:bg-gray-800 text-lg font-medium transition-all"
                >
                  إغلاق التفاصيل
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* نافذة التعديل الكامل */}
      {editMode && editedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-7xl w-full max-h-[95vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-8 py-5 flex justify-between items-center z-10">
              <h3 className="text-2xl font-bold flex items-center gap-3">
                <Edit className="h-7 w-7 text-amber-600" />
                تعديل كامل للطلب #{editedOrder.order_number}
              </h3>
              <button onClick={handleCancelEdit} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-8 space-y-8">
              {/* بيانات الطلب الأساسية */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="col-span-1">
                  <label className="block text-sm font-bold text-gray-700 mb-2">اسم العميل</label>
                  <input type="text" value={editedOrder.customer_name || ''} onChange={e => setEditedOrder({ ...editedOrder, customer_name: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-amber-500 focus:ring-2 focus:ring-amber-200" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">رقم الهاتف</label>
                  <input type="text" value={editedOrder.phone_number || ''} onChange={e => setEditedOrder({ ...editedOrder, phone_number: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-amber-500" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">شركة الشحن</label>
                  <input type="text" value={editedOrder.shipping_company || ''} onChange={e => setEditedOrder({ ...editedOrder, shipping_company: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-amber-500" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">تكلفة الشحن (ر.س)</label>
                  <input type="number" value={editedOrder.shipping_cost || 0} onChange={e => setEditedOrder({ ...editedOrder, shipping_cost: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-amber-500" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">من يحمل تكلفة الشحن</label>
                  <select value={editedOrder.shipping_bearer || 'customer'} onChange={e => setEditedOrder({ ...editedOrder, shipping_bearer: e.target.value as 'customer' | 'store' })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-amber-500">
                    <option value="customer">المشتري</option>
                    <option value="store">المتجر</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">طريقة الدفع</label>
                  <select value={editedOrder.payment_method || ''} onChange={e => setEditedOrder({ ...editedOrder, payment_method: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-amber-500">
                    <option value="">اختر طريقة</option>
                    {PAYMENT_METHOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">المبلغ الإجمالي (ر.س)</label>
                  <input type="number" value={editedOrder.total_price || 0} onChange={e => setEditedOrder({ ...editedOrder, total_price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-amber-500 font-bold text-green-700" />
                </div>
              </div>
              {/* تعديل المنتجات */}
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h4 className="text-2xl font-bold flex items-center gap-3">
                    <Package className="h-7 w-7 text-indigo-600" />
                    تعديل المنتجات
                  </h4>
                  <button onClick={handleAddProduct} className="flex items-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors">
                    <Plus className="h-5 w-5" />
                    إضافة منتج
                  </button>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
                  <AlertTriangle className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-amber-800">تنبيه هام:</p>
                    <p className="text-amber-700 text-sm">عند إضافة أو تعديل المنتجات، يرجى التأكد من تحديث "المبلغ الإجمالي" للطلب يدوياً في الحقل المخصص أعلاه، حيث لا يتم حسابه تلقائياً لتجنب الأخطاء في الحسابات المعقدة.</p>
                  </div>
                </div>
                <div className="space-y-6">
                  {editedOrder.products?.map((product, i) => (
                    <div key={product.id} className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl p-6 border-2 border-gray-300">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 items-end">
                        <div className="lg:col-span-2">
                          <label className="block text-sm font-bold text-gray-700 mb-2">اسم المنتج</label>
                          <input
                            type="text"
                            value={product.name}
                            onChange={e => {
                              const prods = [...editedOrder.products!];
                              prods[i].name = e.target.value;
                              setEditedOrder({ ...editedOrder, products: prods });
                            }}
                            className="w-full px-4 py-2 border-2 border-gray-300 rounded-xl focus:border-indigo-500 mb-2 font-bold text-gray-900"
                            placeholder="اسم المنتج"
                          />
                          <label className="block text-sm font-bold text-gray-700 mb-2 mt-2">المورد</label>
                          <select
                            value={product.supplier_id || ''}
                            onChange={e => {
                              const prods = [...editedOrder.products!];
                              prods[i].supplier_id = e.target.value || undefined;
                              prods[i].supplier_name = getSupplierName(e.target.value);
                              setEditedOrder({ ...editedOrder, products: prods });
                            }}
                            className="w-full px-4 py-2 border-2 border-gray-300 rounded-xl focus:border-indigo-500"
                          >
                            <option value="">اختر المورد</option>
                            {entities.filter(e => e.type === 'مورد').map(supplier => (
                              <option key={supplier.id} value={supplier.id}>
                                {supplier.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-2">سعر البيع (ر.س)</label>
                          <input type="number" value={product.unit_price || 0}
                            onChange={e => {
                              const prods = [...editedOrder.products!];
                              prods[i].unit_price = parseFloat(e.target.value) || 0;
                              setEditedOrder({ ...editedOrder, products: prods });
                            }}
                            className="w-full px-4 py-3 border-2 border-indigo-300 rounded-xl focus:border-indigo-600 font-bold text-indigo-700" />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-2">الكمية</label>
                          <input type="number" min="1" value={product.quantity || 1}
                            onChange={e => {
                              const prods = [...editedOrder.products!];
                              prods[i].quantity = parseInt(e.target.value, 10) || 1;
                              setEditedOrder({ ...editedOrder, products: prods });
                            }}
                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl" />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-red-700 mb-2">تكلفة شاملة الضريبة (ر.س)</label>
                          <input type="number" value={product.cost_subtotal || 0}
                            onChange={e => {
                              const prods = [...editedOrder.products!];
                              prods[i].cost_subtotal = parseFloat(e.target.value) || 0;
                              setEditedOrder({ ...editedOrder, products: prods });
                            }}
                            className="w-full px-4 py-3 border-2 border-red-400 rounded-xl focus:border-red-600 font-bold text-red-700 bg-red-50" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* أزرار الحفظ */}
              <div className="sticky bottom-0 bg-white border-t pt-6 flex justify-end gap-4">
                <button onClick={handleCancelEdit} className="px-8 py-4 bg-gray-300 text-gray-800 rounded-xl hover:bg-gray-400 text-lg font-bold">
                  إلغاء
                </button>
                <button onClick={handleSave} disabled={isSaving} className="px-8 py-4 bg-green-600 text-white rounded-xl hover:bg-green-700 text-lg font-bold flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed">
                  {isSaving ? (
                    <>
                      <Loader2 className="h-6 w-6 animate-spin" />
                      جاري الحفظ...
                    </>
                  ) : (
                    <>
                      <Save className="h-6 w-6" />
                      حفظ جميع التغييرات
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* نافذة إلغاء الطلب */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
            <div className="text-center mb-6">
              <Ban className="h-16 w-16 text-red-600 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-gray-900">إلغاء الطلب</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">سبب الإلغاء *</label>
                <textarea
                  value={cancelFormData.reason}
                  onChange={(e) => setCancelFormData({ ...cancelFormData, reason: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                  rows={3}
                  placeholder="أدخل سبب إلغاء الطلب..."
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">رسوم الإلغاء</label>
                <input
                  type="number"
                  value={cancelFormData.fee}
                  onChange={(e) => setCancelFormData({ ...cancelFormData, fee: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">من يتحمل رسوم الإلغاء؟</label>
                <select
                  value={cancelFormData.feeBearer}
                  onChange={(e) => setCancelFormData({ ...cancelFormData, feeBearer: e.target.value as 'customer' | 'store' })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                >
                  <option value="customer">المشتري</option>
                  <option value="store">المتجر</option>
                </select>
              </div>
              <div className="text-xs text-gray-500">
                ملغي بواسطة: {cancelFormData.cancelledBy}
              </div>
            </div>
            <div className="flex justify-center gap-4 mt-6">
              <button
                onClick={() => setShowCancelModal(false)}
                className="px-8 py-3 bg-gray-300 rounded-xl hover:bg-gray-400 font-bold"
              >
                إلغاء
              </button>
              <button
                onClick={executeCancel}
                className="px-8 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 font-bold flex items-center gap-2"
              >
                <Ban className="h-5 w-5" />
                تأكيد الإلغاء
              </button>
            </div>
          </div>
        </div>
      )}
      {/* نافذة الحذف النهائي */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
            <div className="text-center mb-6">
              <Trash2 className="h-16 w-16 text-red-600 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-gray-900">حذف نهائي للطلب</h3>
              <p className="text-gray-600 mt-2">هل أنت متأكد من حذف هذا الطلب نهائياً؟ هذا الإجراء لا يمكن التراجع عنه، وسيتم حذف جميع البيانات المتعلقة.</p>
            </div>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-8 py-3 bg-gray-300 rounded-xl hover:bg-gray-400 font-bold"
              >
                إلغاء
              </button>
              <button
                onClick={executeDelete}
                className="px-8 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 font-bold flex items-center gap-2"
              >
                <Trash2 className="h-5 w-5" />
                تأكيد الحذف
              </button>
            </div>
          </div>
        </div>
      )}
      {lockedOrders.length === 0 && (
        <div className="text-center py-20">
          <Lock className="h-20 w-20 text-gray-300 mx-auto mb-6" />
          <h3 className="text-2xl font-bold text-gray-700">لا توجد طلبات مقفلة حاليًا</h3>
          <p className="text-gray-500 mt-3">سيظهر هنا كل طلب بعد إكمال تحليل التكاليف وقفله</p>
        </div>
      )}
    </div>
  );
};

export default LockedOrders;