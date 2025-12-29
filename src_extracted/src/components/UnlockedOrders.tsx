import React, { useState } from 'react';
import {
  Search, Download, Eye, Package, Calendar, CheckCircle, Filter, Trash2, X,
  Phone, Truck, CreditCard, Clock, User, DollarSign, Users2, ChevronLeft, ChevronRight,
  Loader2, Plus, Edit2, ChevronDown, Info, Brain, XCircle // إضافة: XCircle للأخطاء
} from 'lucide-react';
import { useOrders } from '../hooks/useOrders';
import { useReceivables } from '../hooks/useReceivables';
import { Order, Product } from '../types/order';
import { Entity } from '../types/receivables';
import toast from 'react-hot-toast';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { supabase } from '../lib/supabase'; // افتراض: إضافة import لـ supabase للعمليات
import { authService } from '../lib/auth'; // إضافة: استيراد authService للتحقق من الصلاحيات
// إضافة: API Key للـ AI (يجب تعيينه في environment variables كـ VITE_ATLASCLOUD_API_KEY)
const ATLASCLOUD_API_KEY = import.meta.env.VITE_ATLASCLOUD_API_KEY || '';
const NewOrders: React.FC = () => {
  // الحصول على المستخدم الحالي للتحقق من الصلاحيات
  const currentUser = authService.getCurrentUser();
  const {
    orders,
    loading,
    error,
    updateProductCost,
    deleteOrder,
    updateProduct,
    refetch,
    updateOrderTotals // ← هذا السطر الجديد المهم جدًا
  } = useOrders();
  const { entities, addReceivable, addEntity } = useReceivables();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPayment, setFilterPayment] = useState<string>('all');
  const [filterShipping, setFilterShipping] = useState<string>('all');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkAction, setBulkAction] = useState<'lock' | 'delete'>('lock');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [tempCosts, setTempCosts] = useState<Record<string, number>>({});
  const [tempSuppliers, setTempSuppliers] = useState<Record<string, string>>({});
  const [tempShipping, setTempShipping] = useState<Record<string, { company: string; cost: number; baseCost?: number }>>({}); // إضافة: state للشحن المؤقت مع baseCost للقيمة الأساسية
  const [tempShippingBearer, setTempShippingBearer] = useState<Record<string, 'store' | 'customer' | null>>({}); // إضافة: state لمُتحمل الشحن المؤقت
  const [supplierMode, setSupplierMode] = useState<'order' | 'product'>('order');
  const [currentStep, setCurrentStep] = useState(0);
  const [viewOrder, setViewOrder] = useState<Order | null>(null);
  // إضافة: states للـ loading و النجاح، مع دعم للعمليات المختلفة
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState(0); // 0: تحديث التكاليف، 1: إقفال، 2: مستحقات
  const [processingType, setProcessingType] = useState<'lock' | 'add'>('lock'); // إضافة: نوع العملية للشريط
  const [showSuccess, setShowSuccess] = useState(false);
  // إضافة: states لإضافة طلب جديد
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [currentStepNewOrder, setCurrentStepNewOrder] = useState(0); // 0: عميل، 1: منتجات، 2: شحن، 3: ملخص
  const [newOrder, setNewOrder] = useState({
    customer_name: '',
    phone_number: '',
    payment_method: '',
    shipping_company: '',
    shipping_cost: 0,
    status: 'بإنتظار المراجعة' as string,
    order_date: new Date().toISOString(),
    tax_included: false, // إضافة: هل السعر يشمل الضريبة
    products: [] as Product[], // إضافة: products في الـ state
    order_number: '', // إضافة: رقم الطلب من الاستخراج
    subtotal_before_tax: 0, // إضافة: الفرعي كما هو مستخرج
    tax_amount: 0, // إضافة: الضريبة كما هي مستخرجة
    total_price: 0, // إضافة: الإجمالي كما هو مستخرج
  });
  // إضافة: state للإقفال الفوري
  const [autoLockNewOrder, setAutoLockNewOrder] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: '',
    quantity: 1,
    unit_price: 0,
    tax_included: false, // إضافة: هل السعر يشمل الضريبة للمنتج
  });
  // إضافة: states لإضافة منتج إلى طلب موجود
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [addProduct, setAddProduct] = useState({
    name: '',
    quantity: 1,
    unit_price: 0,
    tax_included: false, // إضافة: tax_included للمنتج الجديد
  });
  // إضافة: states لإلغاء الطلب
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [cancelFormData, setCancelFormData] = useState({
    reason: '',
    fee: 0,
    feeBearer: 'customer' as 'customer' | 'store',
    cancelledBy: '' as string, // افتراضياً اسم المستخدم أو البريد
  });
  // إضافة: states لمودال إضافة من فاتورة (AI) - تعديل لدعم النص فقط
  const [showAIBillModal, setShowAIBillModal] = useState(false);
  const [pastedText, setPastedText] = useState(''); // إضافة: نص ملصوق
  const [extractedData, setExtractedData] = useState<any>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  // إضافة: حالة للإشعار بعد الاستخراج
  const [extractionStatus, setExtractionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [extractionMessage, setExtractionMessage] = useState('');
  // إضافة: state للـ dropdown في الجدول (للجوال)
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);

  // إضافة: states لإضافة مورد جديد من نافذة الإقفال
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [isAddingSupplier, setIsAddingSupplier] = useState(false);
  const itemsPerPage = 10;
  // إضافة: قائمة خيارات الشحن
  const shippingOptions = [
    { name: 'ريدبوكس', cost: 13.00 },
    { name: 'سمسا', cost: 25.65 },
    { name: 'ناقل اكسبريس', cost: 24.00 },
    { name: 'أوتو - بوابة الشحن الأفضل في المملكة', cost: 20 },
    { name: 'أرامكس', cost: 24 },
    { name: 'مندوب', cost: 50 },
  ];
  // إضافة: خيارات بوابة الدفع
  const paymentOptions = [
    { value: 'all', label: 'الكل' },
    { value: 'mada', label: 'مدى' },
    { value: 'credit_card', label: 'بطاقة ائتمانية' },
    { value: 'tamara_installment', label: 'تمارا للتقسيط' },
    { value: 'tabby_installment', label: 'تابي للتقسيط' },
    { value: 'madfu_installment', label: 'مدفوع للتقسيط' },
    { value: 'bank', label: 'تحويل بنكي' },
    { value: 'cod', label: 'عند الاستلام' },
    { value: 'waiting', label: 'قيد الانتظار' },
  ];
  // إضافة: خيارات الحالة الموسعة
  const statusOptions = [
    { value: 'all', label: 'الكل' },
    { value: 'بإنتظار المراجعة', label: 'بإنتظار المراجعة' },
    { value: 'ملغي', label: 'ملغي' },
  ];
  // دالة للبحث عن تطابق الشركة
  const findShippingMatch = (companyName: string) => {
    const normalizedInput = companyName.toLowerCase().trim();
    return shippingOptions.find(option =>
      option.name.toLowerCase().includes(normalizedInput) || normalizedInput.includes(option.name.toLowerCase())
    );
  };
  // تنسيق العملة (معدل للشحن: إذا غير مسجل، عول 0)
  const formatSAR = (amount: number | string | undefined, isShipping = false) => {
    let num: number;
    if (isShipping && (amount === undefined || amount === null || amount === '')) {
      num = 0; // إجبار الشحن إلى 0 إذا غير مسجل
    } else if (amount === undefined || amount === null || amount === '') {
      return 'غير مسجل';
    } else {
      num = typeof amount === 'string' ? parseFloat(amount) : amount;
      if (isNaN(num)) return 'غير مسجل';
    }
    return `ر.س ${num.toLocaleString('EN-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  // تنسيق التاريخ والوقت بالتوقيت السعودي (UTC+3)
  const formatDateTime = (dateString: string) => {
    const [datePart, timePart] = dateString.split('T');
    const [year, month, day] = datePart.split('-');
    const [hour, minute] = timePart.substring(0, 5).split(':');
    let h = parseInt(hour, 10);
    const period = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${day}/${month}/${year} - ${h.toString().padStart(2, '0')}:${minute} ${period}`;
  };
  // تحويل طريقة الدفع
  const getPaymentMethodLabel = (method: string | undefined) => {
    if (!method) return 'غير مسجل';
    const map: Record<string, string> = {
      tabby_installment: 'تابي للتقسيط',
      tamara_installment: 'تمارا',
      Madfu_installment: 'مدفوع للتقسيط',
      bank: 'تحويل بنكي',
      mada: 'مدى',
      credit_card: 'بطاقة ائتمانية',
      apple_pay: 'Apple Pay',
      visa_mastercard: 'فيزا/ماستركارد',
      stc_pay: 'STC Pay',
      madfu: 'مدفوع',
      cod: 'عند الاستلام',
    };
    return map[method] || method;
  };
  // فلترة + ترتيب من الأحدث إلى الأقدم (استثناء الملغيات من التحديد، لكن عرضها)
  const filteredOrders = orders
    .filter(order => order.is_locked === false)
    .filter(order => {
      // فلتر الحالة
      if (filterStatus !== 'all' && order.status !== filterStatus) return false;
      // فلتر بوابة الدفع
      if (filterPayment !== 'all' && order.payment_method !== filterPayment) return false;
      // فلتر شركة الشحن
      if (filterShipping !== 'all' && order.shipping_company !== filterShipping) return false;
      // فلتر التاريخ
      if (fromDate || toDate) {
        const orderDate = new Date(order.order_date).toISOString().split('T')[0];
        if (fromDate && orderDate < fromDate) return false;
        if (toDate && orderDate > toDate) return false;
      }
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      const name = (order.customer_name || '').toLowerCase();
      const phone = (order.phone_number || '').toString();
      const number = (order.order_number || '').toString().toLowerCase();
      return name.includes(term) || phone.includes(term) || number.includes(term);
    })
    .sort((a, b) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime());
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  // تحديد الطلبات (استثناء الملغيات)
  const toggleOrderSelection = (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (order?.status === 'ملغي') {
      alert('لا يمكن تحديد الطلبات الملغيات للإجراءات الجماعية');
      return;
    }
    setSelectedOrders(prev =>
      prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
    );
  };
  const toggleSelectAll = () => {
    const pageOrderIds = paginatedOrders
      .filter(o => o.status !== 'ملغي')
      .map(o => o.id);
    if (pageOrderIds.every(id => selectedOrders.includes(id))) {
      setSelectedOrders(prev => prev.filter(id => !pageOrderIds.includes(id)));
    } else {
      setSelectedOrders(prev => [...new Set([...prev, ...pageOrderIds])]);
    }
  };
  // فتح مودال إقفال طلب واحد (استثناء الملغيات)
  const openLockSingleModal = (order: Order) => {
    if (order.status === 'ملغي') {
      alert('لا يمكن إقفال الطلبات الملغيات');
      return;
    }
    setSelectedOrders([order.id]);
    setCurrentStep(0);
    setShowBulkModal(true);
    setBulkAction('lock');
    setSupplierMode('order');
    const initialCosts: Record<string, number> = {};
    const initialSuppliers: Record<string, string> = {};
    const initialShipping: Record<string, { company: string; cost: number; baseCost?: number }> = {};
    const initialShippingBearer: Record<string, 'store' | 'customer' | null> = {}; // إضافة: تهيئة bearer
    order.products?.forEach(p => {
      initialCosts[`${order.id}-${p.id}`] = p.cost_price ?? 0;
    });
    initialSuppliers[order.id] = '';
    // إضافة: تهيئة الشحن إذا كانت التكلفة صفر أو غير مسجلة (معدل للإجبار على 0)
    const shippingCost = order.shipping_cost ?? 0; // إجبار على 0 إذا null
    if (shippingCost === 0) {
      const match = findShippingMatch(order.shipping_company || '');
      const baseCost = match ? match.cost : 0;
      initialShipping[order.id] = {
        company: order.shipping_company || '',
        cost: baseCost,
        baseCost,
      };
      initialShippingBearer[order.id] = 'store'; // افتراضي: المتجر
    }
    setTempCosts(initialCosts);
    setTempSuppliers(initialSuppliers);
    setTempShipping(initialShipping);
    setTempShippingBearer(initialShippingBearer);
  };
  // فتح مودال إقفال دفعة (استثناء الملغيات)
  const openBulkLockModal = () => {
    const hasCancelled = orders.some(o => selectedOrders.includes(o.id) && o.status === 'ملغي');
    if (hasCancelled) {
      alert('لا يمكن إقفال الطلبات الملغيات');
      return;
    }
    setCurrentStep(0);
    setShowBulkModal(true);
    setBulkAction('lock');
    setSupplierMode('order');
    const initialCosts: Record<string, number> = {};
    const initialSuppliers: Record<string, string> = {};
    const initialShipping: Record<string, { company: string; cost: number; baseCost?: number }> = {};
    const initialShippingBearer: Record<string, 'store' | 'customer' | null> = {}; // إضافة: تهيئة bearer
    const selectedOrderObjects = orders.filter(o => selectedOrders.includes(o.id));
    selectedOrderObjects.forEach(order => {
      order.products?.forEach(p => {
        initialCosts[`${order.id}-${p.id}`] = p.cost_price ?? 0;
      });
      initialSuppliers[order.id] = '';
      // إضافة: تهيئة الشحن إذا كانت التكلفة صفر أو غير مسجلة (معدل للإجبار على 0)
      const shippingCost = order.shipping_cost ?? 0; // إجبار على 0 إذا null
      if (shippingCost === 0) {
        const match = findShippingMatch(order.shipping_company || '');
        const baseCost = match ? match.cost : 0;
        initialShipping[order.id] = {
          company: order.shipping_company || '',
          cost: baseCost,
          baseCost,
        };
        initialShippingBearer[order.id] = 'store'; // افتراضي: المتجر
      }
    });
    setTempCosts(initialCosts);
    setTempSuppliers(initialSuppliers);
    setTempShipping(initialShipping);
    setTempShippingBearer(initialShippingBearer);
  };
  // الحصول على الطلب الحالي
  const getCurrentOrder = () => {
    const selectedOrderObjects = orders.filter(o => selectedOrders.includes(o.id));
    return selectedOrderObjects[currentStep];
  };
  // التحقق من اكتمال التكاليف
  const areAllCostsFilled = () => {
    const currentOrder = getCurrentOrder();
    if (!currentOrder) return false;
    for (const product of currentOrder.products || []) {
      const key = `${currentOrder.id}-${product.id}`;
      const cost = tempCosts[key];
      if (cost === undefined || cost < 0) return false;
    }
    return true;
  };
  // التحقق من اختيار الموردين
  const areAllSuppliersSelected = () => {
    const currentOrder = getCurrentOrder();
    if (!currentOrder) return false;
    if (supplierMode === 'order') {
      return tempSuppliers[currentOrder.id] && tempSuppliers[currentOrder.id] !== '';
    } else {
      // لكل منتج
      for (const product of currentOrder.products || []) {
        const key = `${currentOrder.id}-${product.id}`;
        if (!tempSuppliers[key] || tempSuppliers[key] === '') return false;
      }
      return true;
    }
  };
  // إضافة: التحقق من اكتمال الشحن إذا كانت التكلفة صفر
  const isShippingComplete = () => {
    const currentOrder = getCurrentOrder();
    if (!currentOrder) return true;
    const shippingCost = currentOrder.shipping_cost ?? 0; // إجبار على 0 إذا null
    if (shippingCost > 0) return true;
    const shippingKey = currentOrder.id;
    const shipping = tempShipping[shippingKey];
    const bearer = tempShippingBearer[shippingKey];
    return shipping && shipping.company && shipping.cost >= 0 && bearer !== null && bearer !== undefined;
  };
  // التحقق من اكتمال جميع المتطلبات للطلب الحالي
  const isCurrentStepReady = () => {
    return areAllCostsFilled() && areAllSuppliersSelected() && isShippingComplete();
  };
  // الانتقال إلى الخطوة التالية
  const nextStep = () => {
    if (currentStep < selectedOrders.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };
  // الانتقال إلى الخطوة السابقة
  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };
  // إضافة: دالة لاقتراح تكلفة الشحن بناءً على الشركة
  const suggestShippingCost = (orderId: string, companyName: string) => {
    const match = findShippingMatch(companyName);
    if (match) {
      const baseCost = match.cost;
      setTempShipping(prev => ({
        ...prev,
        [orderId]: { company: companyName, cost: baseCost, baseCost }
      }));
    }
  };
  // إضافة: دالة لتحديث تكلفة الشحن المؤقتة
  const updateTempShippingCost = (orderId: string, baseCost: number) => {
    setTempShipping(prev => ({
      ...prev,
      [orderId]: { ...prev[orderId], cost: baseCost, baseCost }
    }));
  };
  // تنفيذ الإقفال مع التكاليف والمستحقات (مع إضافة الـ loading المحسن)
  const executeLockWithCosts = async () => {
    if (!isCurrentStepReady()) {
      alert('يجب إدخال تكلفة صحيحة لكل منتج واختيار مورد لكل طلب/منتج، وإكمال معلومات الشحن إذا لزم الأمر');
      return;
    }
    if (currentStep < selectedOrders.length - 1) {
      nextStep();
      return;
    }
    try {
      setIsProcessing(true);
      setProcessingType('lock');
      setProcessingStep(0);
      const selectedOrderObjects = orders.filter(o => selectedOrders.includes(o.id));
      // 1. تحديث تكاليف المنتجات + الموردين
      await Promise.all(
        selectedOrderObjects.flatMap(order =>
          (order.products || []).map(async (product) => {
            const key = `${order.id}-${product.id}`;
            const newCost = tempCosts[key];
            if (newCost !== undefined && newCost >= 0 && newCost !== product.cost_price) {
              const { error } = await supabase
                .from('order_products')
                .update({
                  cost_price: newCost,
                  cost_subtotal: newCost * product.quantity
                })
                .eq('id', product.id);
              if (error) throw error;
            }
            const supplierId = supplierMode === 'order'
              ? tempSuppliers[order.id]
              : tempSuppliers[key];
            if (supplierId && supplierId !== product.supplier_id) {
              const supplierName = entities.find(e => e.id === supplierId)?.name || '';
              const { error } = await supabase
                .from('order_products')
                .update({
                  supplier_id: supplierId,
                  supplier_name: supplierName
                })
                .eq('id', product.id);
              if (error) throw error;
            }
          })
        )
      );
      setProcessingStep(1);
      // 2. تحديث الشحن + إقفال الطلبات
      await Promise.all(
        selectedOrderObjects.map(async (order) => {
          const updates: any = {
            is_locked: true,
            locked_by: currentUser?.full_name,
            locked_at: new Date().toISOString()
          };
          if ((order.shipping_cost ?? 0) === 0) {
            const shipping = tempShipping[order.id];
            const bearer = tempShippingBearer[order.id];
            if (shipping?.company) {
              updates.shipping_company = shipping.company;
              updates.shipping_cost = shipping.cost;
            }
            updates.shipping_bearer = bearer === 'store' ? 'store' : null;
          }
          const { error } = await supabase
            .from('orders')
            .update(updates)
            .eq('id', order.id);
          if (error) throw error;
        })
      );
      setProcessingStep(2);
      // 3. إضافة المستحقات + ربط receivable_id بالمنتجات (الجزء الجديد والأهم)
      for (const order of selectedOrderObjects) {
        const supplierMap: Record<string, { cost: number; productIds: string[] }> = {};
        order.products?.forEach(p => {
          const key = `${order.id}-${p.id}`;
          const supplierId = supplierMode === 'order'
            ? tempSuppliers[order.id]
            : tempSuppliers[key];
          const cost = (tempCosts[key] || 0) * p.quantity;
          if (supplierId && cost > 0) {
            if (!supplierMap[supplierId]) {
              supplierMap[supplierId] = { cost: 0, productIds: [] };
            }
            supplierMap[supplierId].cost += cost;
            supplierMap[supplierId].productIds.push(p.id);
          }
        });
        // حذف المستحقات القديمة لهذا الطلب (اختياري، لكن أنظف)
        await supabase
          .from('receivables')
          .delete()
          .ilike('description', `طلب #${order.order_number}%`);
        // إنشاء مستحق جديد لكل مورد + ربط receivable_id
        for (const [supplierId, { cost, productIds }] of Object.entries(supplierMap)) {
          const productNames = order.products
            ?.filter(p => productIds.includes(p.id))
            .map(p => p.name)
            .join(', ') || 'منتجات';
          const { data: receivable, error } = await supabase
            .from('receivables')
            .insert({
              entity_id: supplierId,
              description: `طلب #${order.order_number} - ${productNames}`,
              total_amount: parseFloat(cost.toFixed(2)),
              remaining_amount: parseFloat(cost.toFixed(2)),
              purchase_date: new Date().toISOString().split('T')[0],
              due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              notes: `تم إنشاؤه عند إقفال الطلب #${order.order_number}`,
            })
            .select()
            .single();
          if (error) {
            console.error('فشل إنشاء المستحق:', error);
            continue;
          }
          // ربط receivable_id بالمنتجات المرتبطة
          if (receivable?.id && productIds.length > 0) {
            const { error: linkError } = await supabase
              .from('order_products')
              .update({ receivable_id: receivable.id })
              .in('id', productIds);
            if (linkError) {
              console.error('فشل ربط receivable_id:', linkError);
            }
          }
        }
      }
      // 4. إعادة حساب الإجماليات
      for (const order of selectedOrderObjects) {
        await updateOrderTotals(order.id);
      }
      // نجاح كامل!
      toast.success('تم إقفال الطلبات وربط المستحقات بالمنتجات بنجاح!');
      setIsProcessing(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      // تنظيف
      setSelectedOrders([]);
      setShowBulkModal(false);
      setTempCosts({});
      setTempSuppliers({});
      setTempShipping({});
      setTempShippingBearer({});
      setCurrentStep(0);
      await refetch();
    } catch (err: any) {
      setIsProcessing(false);
      console.error('خطأ في إقفال الطلبات:', err);
      toast.error(`فشل في الإقفال: ${err.message || 'خطأ غير معروف'}`);
    }
  };

  // تنفيذ الحذف النهائي (استثناء الملغيات)
  const executeBulkDelete = async () => {
    if (currentUser?.role !== 'admin') {
      alert('عذراً، هذه الصلاحية للمسؤولين فقط');
      return;
    }
    if (deleteConfirmText !== 'حذف نهائي') {
      alert('يجب كتابة "حذف نهائي"');
      return;
    }
    const hasCancelled = orders.some(o => selectedOrders.includes(o.id) && o.status === 'ملغي');
    if (hasCancelled) {
      alert('لا يمكن حذف الطلبات الملغيات');
      return;
    }
    try {
      await Promise.all(selectedOrders.map(id => deleteOrder(id)));
      alert(`تم حذف ${selectedOrders.length} طلب نهائيًا`);
      setSelectedOrders([]);
      setShowBulkModal(false);
      setDeleteConfirmText('');
      await refetch(); // إضافة: إعادة تحميل
    } catch (err) {
      alert('حدث خطأ أثناء الحذف');
    }
  };
  // إضافة: فتح مودال إلغاء طلب واحد
  const openCancelModal = (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (order) {
      setCancellingOrderId(orderId);
      setCancelFormData({
        reason: '',
        fee: 0,
        feeBearer: 'customer',
        cancelledBy: currentUser?.full_name || currentUser?.email || '',
      });
      setShowCancelModal(true);
    }
  };
  // إضافة: تنفيذ الإلغاء
  const executeCancel = async () => {
    if (currentUser?.role !== 'admin') {
      alert('عذراً، هذه الصلاحية للمسؤولين فقط');
      return;
    }
    if (!cancellingOrderId || !cancelFormData.reason || cancelFormData.fee < 0) {
      alert('يجب إدخال سبب الإلغاء ورسوم صحيحة');
      return;
    }
    try {
      setIsProcessing(true);
      // 1. تحديث الطلب إلى ملغي مع التفاصيل
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          status: 'ملغي',
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
        const order = orders.find(o => o.id === cancellingOrderId);
        const { error: expenseError } = await supabase
          .from('expenses')
          .insert([{
            description: `رسوم إلغاء طلب رقم ${order?.order_number || cancellingOrderId}`,
            amount: cancelFormData.fee,
            category: 'رسوم إلغاء', // فئة افتراضية، يمكن تخصيص
            date: new Date().toISOString().split('T')[0],
            created_by: 'إلغاء طلب'
          }]);
        if (expenseError) {
          console.error('فشل في إضافة المصروف:', expenseError);
          // لا نوقف، لكن نرسل إشعار
        }
      }
      setIsProcessing(false);
      alert('تم إلغاء الطلب بنجاح');
      setShowCancelModal(false);
      setCancellingOrderId(null);
      await refetch();
    } catch (err) {
      setIsProcessing(false);
      console.error('خطأ في الإلغاء:', err);
      alert('حدث خطأ في الإلغاء');
    }
  };
  const getStatusColor = (status: string) => {
    const map: Record<string, string> = {
      'بإنتظار المراجعة': 'bg-blue-100 text-blue-800',
      مؤكد: 'bg-indigo-100 text-indigo-800',
      'قيد التجهيز': 'bg-yellow-100 text-yellow-800',
      'تم الشحن': 'bg-purple-100 text-purple-800',
      مكتمل: 'bg-green-100 text-green-800',
      ملغي: 'bg-red-100 text-red-800',
      مرتجع: 'bg-orange-100 text-orange-800',
      مقفل: 'bg-gray-100 text-gray-800',
    };
    return map[status] || 'bg-gray-100 text-gray-800';
  };
  // تصدير إلى Excel (مع إضافة عمود "تكلفة الوحدة" كبيانات جديدة، ومعالجة الشحن كـ 0)
  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('الطلبات غير المقفلة', {
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true },
      properties: { defaultColWidth: 18 },
      views: [{ rightToLeft: true }]
    });
    worksheet.mergeCells('A1:O1'); // تعديل: إضافة عمود واحد إضافي
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'تقرير الطلبات غير المقفلة';
    titleCell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    const now = new Date().toLocaleString('en-US', { timeZone: 'Asia/Riyadh' });
    worksheet.mergeCells('A2:O2'); // تعديل: للعمود الجديد
    const dateCell = worksheet.getCell('A2');
    dateCell.value = `تاريخ التصدير: ${now}`;
    dateCell.font = { size: 12, italic: true };
    dateCell.alignment = { horizontal: 'center' };
    const headerRow = worksheet.addRow([
      'رقم الطلب', 'اسم العميل', 'الهاتف', 'تاريخ الطلب',
      'الحالة', 'طريقة الدفع', 'المنتج', 'المورد', 'الكمية', 'سعر الوحدة',
      'تكلفة الوحدة', // إضافة جديدة: عمود لتكلفة الوحدة
      'الفرعي', 'الضريبة', 'الشحن', 'الإجمالي'
    ]);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    headerRow.eachCell((cell) => {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });
    let totalSum = 0;
    filteredOrders.forEach((order) => {
      const orderTotal = order.total_price || 0;
      totalSum += orderTotal;
      order.products?.forEach((product, idx) => {
        const shippingCost = order.shipping_cost ?? 0; // إجبار الشحن على 0 في التصدير
        const row = worksheet.addRow([
          idx === 0 ? `#${order.order_number}` : '',
          idx === 0 ? (order.customer_name || 'غير مسجل') : '',
          idx === 0 ? (order.phone_number || 'غير مسجل') : '',
          idx === 0 ? formatDateTime(order.order_date) : '',
          idx === 0 ? order.status : '',
          idx === 0 ? getPaymentMethodLabel(order.payment_method) : '',
          product.name,
          product.supplier_name || 'غير محدد',
          product.quantity,
          formatSAR(product.unit_price),
          formatSAR(product.cost_price), // إضافة جديدة: تكلفة الوحدة
          idx === 0 ? formatSAR(order.subtotal_before_tax) : '',
          idx === 0 ? formatSAR(order.tax_amount) : '',
          idx === 0 ? formatSAR(shippingCost, true) : '', // استخدام الإجبار على 0
          idx === 0 ? formatSAR(order.total_price) : ''
        ]);
        row.eachCell((cell, colNumber) => {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          if (colNumber >= 10 && colNumber <= 15) cell.numFmt = '#,##0.00'; // تعديل: للأعمدة الجديدة
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });
        if (worksheet.rowCount % 2 === 0) {
          row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
        }
      });
      if (order.products?.length) {
        worksheet.addRow([]).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1D5DB' } };
      }
    });
    worksheet.mergeCells(`A${worksheet.rowCount + 2}:N${worksheet.rowCount + 2}`); // تعديل: للإجمالي
    const totalLabel = worksheet.getCell(`A${worksheet.rowCount + 2}`);
    totalLabel.value = 'إجمالي الطلبات';
    totalLabel.font = { bold: true };
    totalLabel.alignment = { horizontal: 'center' };
    const totalCell = worksheet.getCell(`O${worksheet.rowCount + 2}`); // تعديل: عمود الإجمالي الجديد
    totalCell.value = totalSum;
    totalCell.numFmt = '#,##0.00';
    totalCell.font = { bold: true, color: { argb: 'FF166534' } };
    totalCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `طلبات_غير_مقفلة_${new Date().toISOString().slice(0, 10)}.xlsx`;
    saveAs(new Blob([buffer]), fileName);
  };
  // تصحيح: دالة لحفظ الطلب الجديد (تنفيذ مباشر باستخدام Supabase لربط order_id) - استخدام القيم المستخرجة مباشرة دون إعادة حساب
  const saveNewOrder = async () => {
    if (!newOrder.customer_name || newOrder.products.length === 0) {
      alert('يجب إدخال اسم العميل وإضافة منتج واحد على الأقل');
      return;
    }
    // إضافة: التحقق من الشحن إذا كانت التكلفة 0
    if (newOrder.shipping_cost === 0 && !newOrder.shipping_company) {
      alert('يجب إدخال اسم شركة الشحن إذا كانت تكلفة الشحن 0');
      return;
    }
    try {
      // إضافة: بدء التحميل مع تحديد النوع
      setIsProcessing(true);
      setProcessingType('add');
      setProcessingStep(0);
      // 1. إنشاء الطلب أولاً في جدول orders (افترض أن orders لديه حقول مطابقة)
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_name: newOrder.customer_name,
          phone_number: newOrder.phone_number,
          payment_method: newOrder.payment_method,
          shipping_company: newOrder.shipping_company,
          shipping_cost: newOrder.shipping_cost ?? 0, // إجبار على 0 إذا null
          shipping_bearer: newOrder.shipping_company || 'store', // إضافة: تسجيل اسم الشركة في shipping_bearer (افتراضي "store" إذا فارغ)
          status: newOrder.status,
          order_date: newOrder.order_date,
          order_number: newOrder.order_number || `ORD-${Date.now()}`, // إضافة: رقم الطلب
          is_locked: false, // افتراضي
          subtotal_before_tax: newOrder.subtotal_before_tax, // كما هو مستخرج
          tax_amount: newOrder.tax_amount, // كما هي مستخرجة
          total_price: newOrder.total_price, // كما هو مستخرج
          // لا نحسب عبر triggers، نستخدم المستخرجة مباشرة
        })
        .select('id, order_number') // احصل على id و order_number
        .single();
      if (orderError) throw orderError;
      setProcessingStep(1); // خطوة 1: إنشاء الطلب
      const orderId = orderData.id;
      // إضافة جديدة: تسجيل شركة الشحن في جدول inventory (عمود shipping_bearer) - تعديل من store إلى inventory
      // 2. إدراج المنتجات في order_products مع ربط order_id (تسريع: batch insert)
      const productsForInsert = newOrder.products.map(p => {
        // استخدم unit_price كما هو مستخرج، بدون تعديل للضريبة
        return {
          order_id: orderId, // تصحيح: ربط order_id
          product_name: p.name,
          quantity: p.quantity,
          unit_price: p.unit_price, // كما هو مستخرج
          cost_price: 0, // افتراضي، سيتم تحديثه في الإقفال
          subtotal: 0, // سيحسب عبر trigger أو يمكن تحديثه لاحقاً
          cost_subtotal: 0, // سيحسب عبر trigger
          supplier_name: null,
          supplier_id: null,
          // tax_included غير مدعوم في الجدول، لكن يمكن إضافته إذا عدلت الجدول
        };
      });
      const { data: insertedProducts, error: productsError } = await supabase
        .from('order_products')
        .insert(productsForInsert)
        .select(); // إضافة: select للحصول على ids المنتجات
      if (productsError) throw productsError;
      setProcessingStep(2); // خطوة 2: إدراج المنتجات
      // إنشاء كائن Order محلي للإقفال الفوري
      const newOrderObject: Order = {
        id: orderData.id,
        order_number: orderData.order_number,
        customer_name: newOrder.customer_name,
        phone_number: newOrder.phone_number,
        payment_method: newOrder.payment_method,
        shipping_company: newOrder.shipping_company,
        shipping_cost: newOrder.shipping_cost ?? 0, // إجبار على 0
        status: newOrder.status,
        order_date: newOrder.order_date,
        subtotal_before_tax: newOrder.subtotal_before_tax,
        tax_amount: newOrder.tax_amount,
        total_price: newOrder.total_price,
        is_locked: false,
        products: insertedProducts.map((ip: any, idx: number) => ({
          ...newOrder.products[idx],
          id: ip.id, // استخدم id الحقيقي من الإدراج
          cost_price: 0, // افتراضي للإقفال
          supplier_id: null,
          supplier_name: null,
        })),
        // باقي الحقول إذا لزم
      };
      alert('تم إضافة الطلب بنجاح');
      setShowNewOrderModal(false);
      setCurrentStepNewOrder(0);
      setNewOrder({
        customer_name: '',
        phone_number: '',
        shipping_company: '',
        shipping_cost: 0,
        payment_method: '',
        status: 'بإنتظار المراجعة',
        order_date: new Date().toISOString(),
        tax_included: false,
        products: [],
        order_number: '',
        subtotal_before_tax: 0,
        tax_amount: 0,
        total_price: 0,
      });
      setNewProduct({
        name: '',
        quantity: 1,
        unit_price: 0,
        tax_included: false,
      });
      setIsProcessing(false);
      await refetch();
      // إضافة: إذا تم اختيار الإقفال الفوري، افتح المودال مباشرة
      if (autoLockNewOrder) {
        setAutoLockNewOrder(false); // إعادة تعيين
        openLockSingleModal(newOrderObject); // استخدم الكائن المحلي
      }
    } catch (err) {
      setIsProcessing(false);
      console.error('خطأ في حفظ الطلب:', err);
      alert(err.message || 'حدث خطأ في حفظ الطلب');
    }
  };
  // تصحيح: دالة لإضافة منتج إلى طلب موجود (استخدام order_id المعروف) مع تحديث الإجماليات
  const addProductToExistingOrder = async () => {
    if (!editingOrderId || !addProduct.name) {
      alert('يجب اختيار طلب وإدخال اسم المنتج');
      return;
    }
    try {
      setIsProcessing(true); // إضافة: loading
      let unitPrice = addProduct.unit_price;
      if (addProduct.tax_included) unitPrice = unitPrice / 1.15; // تصحيح: السعر قبل الضريبة
      const newProdData = {
        order_id: editingOrderId, // تصحيح: ربط order_id
        product_name: addProduct.name,
        quantity: addProduct.quantity,
        unit_price: unitPrice,
        cost_price: 0, // افتراضي
        subtotal: 0, // سيحسب عبر trigger
        cost_subtotal: 0, // سيحسب عبر trigger
        supplier_name: null,
        supplier_id: null,
      };
      const { error } = await supabase
        .from('order_products')
        .insert(newProdData);
      if (error) throw error;
      // إضافة: تحديث الإجماليات في جدول orders
      const { data: currentOrder } = await supabase
        .from('orders')
        .select('subtotal_before_tax, tax_amount, total_price, shipping_cost')
        .eq('id', editingOrderId)
        .single();
      if (currentOrder) {
        // جلب جميع المنتجات الحالية لإعادة الحساب
        const { data: allProducts } = await supabase
          .from('order_products')
          .select('unit_price, quantity')
          .eq('order_id', editingOrderId);
        if (allProducts) {
          let newSubtotal = allProducts.reduce((sum: number, p: any) => sum + (p.unit_price * p.quantity), 0);
          const newTax = newSubtotal * 0.15;
          const shippingCost = currentOrder.shipping_cost ?? 0; // إجبار على 0
          const newTotal = newSubtotal + newTax + shippingCost;
          const { error: updateError } = await supabase
            .from('orders')
            .update({
              subtotal_before_tax: newSubtotal,
              tax_amount: newTax,
              total_price: newTotal,
            })
            .eq('id', editingOrderId);
          if (updateError) {
            console.error('فشل في تحديث الإجماليات:', updateError);
          }
        }
      }
      alert('تم إضافة المنتج بنجاح');
      setShowAddProductModal(false);
      setEditingOrderId(null);
      setAddProduct({
        name: '',
        quantity: 1,
        unit_price: 0,
        tax_included: false,
      });
      setIsProcessing(false);
      await refetch();
    } catch (err) {
      setIsProcessing(false);
      console.error('خطأ في إضافة المنتج:', err);
      alert(err.message || 'حدث خطأ في إضافة المنتج');
    }
  };
  // إضافة: إضافة منتج جديد إلى newOrder (بدون تكلفة أو مورد)
  const addNewProductToOrder = () => {
    if (!newProduct.name) {
      alert('يجب إدخال اسم المنتج');
      return;
    }
    const newProd: Product = {
      id: Date.now().toString(), // مؤقت للعرض
      ...newProduct,
      subtotal: newProduct.unit_price * newProduct.quantity,
    };
    setNewOrder(prev => ({ ...prev, products: [...prev.products, newProd] }));
    setNewProduct({
      name: '',
      quantity: 1,
      unit_price: 0,
      tax_included: false,
    });
  };
  // إضافة: حذف منتج من newOrder
  const removeNewProduct = (id: string) => {
    setNewOrder(prev => ({
      ...prev,
      products: prev.products.filter(p => p.id !== id),
    }));
  };
  // إضافة: حساب الإجمالي للطلب الجديد للعرض (استخدام المستخرج إذا وجد)
  const calculateOrderTotal = () => {
    // إذا كانت القيم مستخرجة، استخدمها مباشرة
    if (newOrder.subtotal_before_tax > 0 && newOrder.tax_amount > 0) {
      return {
        subtotal: newOrder.subtotal_before_tax,
        tax: newOrder.tax_amount,
        total: newOrder.total_price,
      };
    }
    // fallback إلى الحساب اليدوي إذا لم تكن مستخرجة
    let subtotal = newOrder.products.reduce((sum, p) => {
      let price = p.unit_price;
      if (p.tax_included) {
        price = price / 1.15;
      }
      return sum + (price * p.quantity);
    }, 0);
    const tax = subtotal * 0.15;
    if (newOrder.tax_included) {
      subtotal = (subtotal + tax); // إذا كان الإجمالي يشمل الضريبة، أعد الحساب
    }
    return { subtotal, tax, total: subtotal + tax + (newOrder.shipping_cost ?? 0) }; // shipping_cost كما هو مع إجبار على 0
  };
  // إضافة: الانتقال بين خطوات الطلب الجديد
  const nextStepNewOrder = () => {
    switch (currentStepNewOrder) {
      case 0:
        if (!newOrder.customer_name) {
          alert('يجب إدخال اسم العميل');
          return;
        }
        setCurrentStepNewOrder(1);
        break;
      case 1:
        if (newOrder.products.length === 0) {
          alert('يجب إضافة منتج واحد على الأقل');
          return;
        }
        setCurrentStepNewOrder(2);
        break;
      case 2:
        // إضافة: التحقق من الشحن إذا كانت التكلفة 0
        if ((newOrder.shipping_cost ?? 0) === 0 && !newOrder.shipping_company) {
          alert('يجب إدخل اسم شركة الشحن إذا كانت تكلفة الشحن 0');
          return;
        }
        setCurrentStepNewOrder(3);
        break;
      case 3:
        saveNewOrder();
        break;
    }
  };
  const prevStepNewOrder = () => {
    if (currentStepNewOrder > 0) {
      setCurrentStepNewOrder(prev => prev - 1);
    }
  };
  // أضف هذا في أعلى الـ component (مرة واحدة فقط)
  const isMountedRef = React.useRef<boolean>(true);
  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  // دالة الاستخراج المُصححة بالكامل
  const extractFromText = async () => {
    if (!pastedText.trim()) {
      alert('يجب لصق نص الطلب أولاً');
      return;
    }
    if (!ATLASCLOUD_API_KEY) {
      alert('خطأ: مفتاح API غير متوفر. تحقق من المتغيرات البيئية.');
      return;
    }
    setIsExtracting(true);
    setExtractedData(null);
    setExtractionStatus('idle');
    setExtractionMessage('');
    try {
      const prompt = `
أنت خبير فائق الدقة في استخراج بيانات الطلبات من النصوص العربية المُنسوخة من واتساب أو سلة أو أي منصة.
مهمتك: استخراج البيانات التالية بدقة مطلقة، وإرجاع JSON صارم فقط (بدون أي نص إضافي، بدون \`\`\`json، بدون شرح، بدون كلمة "إليك" أو أي شيء خارج الـ JSON).
### قواعد صارمة يجب اتباعها حرفيًا:
1. الأرقام تُؤخذ كما هي مكتوبة بالضبط (لا تُحسب، لا تُضرب، لا تُضاف ضريبة، لا تُقرب).
2. إذا كان الشحن "مجاني" أو "مجاناً" أو "شحن مجاني" أو "بدون شحن" → shipping_cost = 0.00
3. إذا لم يُذكر الشحن أبدًا → shipping_company = "غير محدد" و shipping_cost = 0.00
4. shipping_company: اكتب اسم الشركة بالعربية كما هو بالضبط (مثال: سمسا، أرامكس، ناقل اكسبريس، ريدبوكس، مندوب، زاجل، فاستلو، إلخ). لا تترجم أبدًا.
5. التاريخ: إذا لم يُذكر → استخدم تاريخ اليوم: ${new Date().toISOString().split('T')[0]}
6. الوقت: حوّله إلى صيغة 24 ساعة (مثلاً: 2:30 م → 14:30، 11:45 ص → 11:45)
7. الحالة دائمًا: "بإنتظار المراجعة" (ما عدا إذا كان الطلب مدفوع ومكتمل بوضوح → "مكتمل")
### تحويل طريقة الدفع من العربية إلى الكود الإنجليزي (إجباري):
استخدم هذا الجدول بالضبط:
"تمارا للتقسيط" أو "تمارا" أو "تقسيط تمارا" → "tamara_installment"
"تابي للتقسيط" أو "تابي" أو "تقسيط تابي" → "tabby_installment"
"مدفوع للتقسيط" أو "مدفوع" → "madfu_installment"
"مدى" أو "مادا" → "mada"
"بطاقة ائتمانية" أو "فيزا" أو "ماستركارد" → "credit_card"
"تحويل بنكي" أو "حوالة" أو "تحويل" → "bank"
"عند الاستلام" أو "كاش" أو "دفع عند الاستلام" → "cash_on_delivery"
"سلة" أو "دفع عبر سلة" → "salla_basket"
"أبل باي" أو "Apple Pay" → "apple_pay"
"STC Pay" أو "ستك باي" → "stc_pay"
إذا لم تُطابق أي شيء → "unknown_payment_method"
### تنسيق الإخراج الإجباري (JSON فقط):
{
  "order_number": "رقم الطلب كما هو أو غير محدد",
  "order_date": "YYYY-MM-DD",
  "order_time": "HH:MM",
  "status": "بإنتظار المراجعة",
  "customer_name": "اسم العميل كما هو",
  "phone_number": "05xxxxxxxxx أو أول رقم هاتف واضح",
  "shipping_company": "اسم الشركة بالعربية أو غير محدد",
  "shipping_cost": 0.00,
  "payment_method": "الكود الإنجليزي فقط من الجدول أعلاه",
  "payment_transaction": "رقم العملية إن وُجد وإلا null",
  "subtotal_before_tax": 0.00,
  "tax_amount": 0.00,
  "tax_rate": 15.00,
  "total": 0.00,
  "products": [
    {
      "name": "اسم المنتج كما هو بالضبط",
      "quantity": 1,
      "weight": 0.0,
      "price": 0.00,
      "total": 0.00
    }
  ]
}
النص المراد تحليله:
${pastedText}
أخرج JSON فقط. لا شيء غيره. لا تعليقات. لا تنسيق. لا \`\`\`.
`;

      const response = await fetch('https://api.atlascloud.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ATLASCLOUD_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gemini-2.5-flash-lite',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 2048,
          temperature: 0.1,
          stream: false,
        }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`فشل في الاتصال بالـ AI: ${response.status} ${errorText}`);
      }
      const data = await response.json();
      let content = data.choices?.[0]?.message?.content || '';
      // تنظيف النص من علامات الكود والمسافات
      content = content.replace(/```json|```/g, '').trim();
      let parsedData;
      try {
        parsedData = JSON.parse(content);
      } catch (e) {
        // محاولة استخراج JSON من وسط النص
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('الـ AI لم يُرجع JSON صالح');
        }
      }
      // معالجة التاريخ والوقت
      if (!parsedData.order_date || !parsedData.order_date.includes('-')) {
        parsedData.order_date = new Date().toISOString().split('T')[0];
      }
      if (parsedData.order_time && parsedData.order_time.includes(':')) {
        const [h, m] = parsedData.order_time.split(':');
        const hour = parseInt(h);
        const ampm = parsedData.order_time.toLowerCase().includes('م') ? 'pm' : 'am';
        const fixedHour = (ampm === 'pm' && hour < 12) ? hour + 12 : hour;
        parsedData.order_time = `${fixedHour.toString().padStart(2, '0')}:${m}`;
      } else {
        parsedData.order_time = new Date().toTimeString().slice(0, 5);
      }
      // دمج التاريخ والوقت في order_date
      parsedData.order_date = `${parsedData.order_date}T${parsedData.order_time}:00`;
      // معالجة الشحن
      if (!parsedData.shipping_cost && parsedData.shipping_cost !== 0) {
        parsedData.shipping_cost = 0;
      }
      if (!parsedData.shipping_company || parsedData.shipping_company.trim() === '') {
        parsedData.shipping_company = 'غير محدد';
      }
      // ضمان وجود status
      parsedData.status = parsedData.status || 'بإنتظار المراجعة';
      // حماية من تحديث الحالة بعد إغلاق المودال
      if (!isMountedRef.current) return;
      setExtractedData(parsedData);
      setExtractionStatus('success');
      setExtractionMessage('تم استخراج البيانات بنجاح! يمكنك الآن إضافتها كطلب جديد.');

    } catch (err: any) {
      if (!isMountedRef.current) return;
      console.error('خطأ في استخراج الطلب بالـ AI:', err);
      setExtractionStatus('error');
      setExtractionMessage(`فشل الاستخراج: ${err.message || 'تأكد من النص والاتصال بالإنترنت'}`);
    } finally {
      if (isMountedRef.current) {
        setIsExtracting(false);
      }
    }
  };

  // إضافة: دالة لإضافة الطلب من البيانات المستخرجة (تعديل لدعم الحقول الجديدة كما هي)
  const addFromExtractedData = () => {
    if (!extractedData) return;
    // نقل البيانات إلى newOrder كما هي
    setNewOrder(prev => ({
      ...prev,
      customer_name: extractedData.customer_name || '',
      phone_number: extractedData.phone_number || '',
      order_number: extractedData.order_number || '',
      order_date: extractedData.order_date || new Date().toISOString(),
      status: 'بإنتظار المراجعة',
      shipping_company: extractedData.shipping_company || '',
      shipping_cost: extractedData.shipping_cost ?? 0, // إجبار على 0
      payment_method: extractedData.payment_method === 'البطاقة الائتمانية' ? 'credit_card' : (extractedData.payment_method?.toLowerCase() || ''),
      subtotal_before_tax: extractedData.subtotal_before_tax || 0, // كما هو مستخرج
      tax_amount: extractedData.tax_amount || 0, // كما هي مستخرجة
      total_price: extractedData.total || 0, // كما هو مستخرج
      products: (extractedData.products || []).map((p: any) => ({
        id: Date.now().toString() + Math.random(),
        name: p.name || '',
        quantity: p.quantity || 1,
        unit_price: p.price || 0, // كما هو مستخرج
        tax_included: false, // افتراضي، يمكن تعديله
        subtotal: (p.total || 0), // استخدم المجموع المستخرج للمنتج
      })),
      tax_included: false,
    }));
    setShowAIBillModal(false);
    setShowNewOrderModal(true);
    setCurrentStepNewOrder(0); // ابدأ من البداية للمراجعة
    setPastedText(''); // تنظيف النص
    setExtractedData(null);
    setExtractionStatus('idle'); // إعادة تعيين الحالة
  };
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
        <h2 className="text-xl font-semibold text-slate-700 mb-2">جاري تحميل البيانات...</h2>
        <p className="text-slate-500">يرجى الانتظار قليلاً</p>
      </div>
    </div>
  );
  if (error) return <div className="p-6 text-red-600 text-center">خطأ: {error}</div>;
  const currentOrder = getCurrentOrder();
  const steps = ['بيانات العميل', 'المنتجات', 'معلومات الشحن', 'الملخص'];
  const handleAddSupplier = async () => {
    if (!newSupplierName.trim()) return;
    setIsAddingSupplier(true);
    try {
      await addEntity({
        name: newSupplierName,
        type: 'مورد'
      });
      toast.success('تم إضافة المورد بنجاح');
      setNewSupplierName('');
      setShowAddSupplierModal(false);
    } catch (error) {
      toast.error('حدث خطأ أثناء إضافة المورد');
    } finally {
      setIsAddingSupplier(false);
    }
  };

  return (
    <div className="min-h-screen bg-white p-3 md:p-6">
      {/* === العنوان الرئيسي === */}
      <div className="mb-4 md:mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-slate-800">إدارة الطلبات</h1>
          <p className="text-slate-600 mt-1 text-sm md:text-base">إدارة، إقفال، وحذف الطلبات</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowAIBillModal(true)}
            className="px-3 md:px-6 py-2 md:py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg md:rounded-xl hover:shadow-md flex items-center justify-center gap-2 font-medium text-sm md:text-base min-h-[44px]"
          >
            <Brain className="h-4 w-4 md:h-5 md:w-5 flex-shrink-0" />
            <span className="hidden sm:inline">إضافة من نص</span> (AI)
          </button>
          <button
            onClick={() => setShowNewOrderModal(true)}
            className="px-3 md:px-6 py-2 md:py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg md:rounded-xl hover:shadow-md flex items-center justify-center gap-2 font-medium text-sm md:text-base min-h-[44px]"
          >
            <Plus className="h-4 w-4 md:h-5 md:w-5 flex-shrink-0" />
            إضافة طلب
          </button>
        </div>
      </div>
      {/* === شريط البحث والفلاتر === */}
      <div className="bg-white rounded-xl md:rounded-2xl shadow-md border border-slate-100 overflow-hidden mb-4 md:mb-6">
        <div className="p-3 md:p-5 lg:p-7">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4 items-end">
            <div className="relative col-span-1 sm:col-span-2">
              <Search className="absolute right-3 md:right-4 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4 md:h-5 md:w-5" />
              <input
                type="text"
                placeholder="بحث..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pr-10 md:pr-12 pl-3 md:pl-4 py-2 md:py-3 rounded-lg md:rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm min-h-[44px]"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">الحالة</label>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="w-full px-2 md:px-3 py-2 rounded-lg md:rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 text-xs md:text-sm min-h-[44px]"
              >
                {statusOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">الدفع</label>
              <select
                value={filterPayment}
                onChange={e => setFilterPayment(e.target.value)}
                className="w-full px-2 md:px-3 py-2 rounded-lg md:rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 text-xs md:text-sm min-h-[44px]"
              >
                {paymentOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">الشحن</label>
              <select
                value={filterShipping}
                onChange={e => setFilterShipping(e.target.value)}
                className="w-full px-2 md:px-3 py-2 rounded-lg md:rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 text-xs md:text-sm min-h-[44px]"
              >
                <option value="all">الكل</option>
                {shippingOptions.map(opt => (
                  <option key={opt.name} value={opt.name}>{opt.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-slate-500 mb-1">من تاريخ</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={e => setFromDate(e.target.value)}
                  className="w-full px-2 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 text-sm min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">إلى تاريخ</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={e => setToDate(e.target.value)}
                  className="w-full px-2 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 text-sm min-h-[44px]"
                />
              </div>
            </div>
            <button
              onClick={exportToExcel}
              disabled={filteredOrders.length === 0}
              className="col-span-1 px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl hover:shadow-md flex items-center gap-2 font-medium disabled:opacity-50 min-h-[44px]"
            >
              <Download className="h-5 w-5 flex-shrink-0" /> تصدير Excel
            </button>
          </div>
        </div>
      </div>
      {/* === إشعار التحديد === */}
      {selectedOrders.length > 0 && (
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-2xl p-4 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="text-indigo-900 font-semibold text-center sm:text-left">تم تحديد <span className="text-indigo-700">{selectedOrders.length}</span> طلب</p>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <button
              onClick={openBulkLockModal}
              className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl hover:shadow-md text-sm font-medium min-h-[44px]"
            >
              إقفال مع التكاليف
            </button>
            {currentUser?.role === 'admin' && (
              <button
                onClick={() => { setBulkAction('delete'); setShowBulkModal(true); }}
                className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-xl hover:shadow-md text-sm font-medium min-h-[44px]"
              >
                حذف نهائي
              </button>
            )}
          </div>
        </div>
      )}
      {/* === الجدول === */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] sm:min-w-full">
            <thead className="bg-gradient-to-r from-slate-50 to-slate-100">
              <tr>
                <th className="px-3 sm:px-6 py-4 text-center">
                  <input
                    type="checkbox"
                    checked={paginatedOrders.length > 0 && paginatedOrders.filter(o => o.status !== 'ملغي').every(o => selectedOrders.includes(o.id))}
                    onChange={toggleSelectAll}
                    className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
                <th className="px-3 sm:px-6 py-4 text-right text-sm font-semibold text-slate-700">رقم الطلب</th>
                <th className="px-3 sm:px-6 py-4 text-right text-sm font-semibold text-slate-700">اسم العميل</th>
                <th className="px-3 sm:px-6 py-4 text-right text-sm font-semibold text-slate-700">طريقة الدفع</th>
                <th className="px-3 sm:px-6 py-4 text-right text-sm font-semibold text-slate-700">المنتجات</th>
                <th className="px-3 sm:px-6 py-4 text-right text-sm font-semibold text-slate-700">الإجمالي</th>
                <th className="px-3 sm:px-6 py-4 text-right text-sm font-semibold text-slate-700">الحالة</th>
                <th className="px-3 sm:px-6 py-4 text-right text-sm font-semibold text-slate-700">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedOrders.map((order) => {
                const shippingCost = order.shipping_cost ?? 0; // إجبار الشحن على 0 في الجدول
                const isActionsOpen = openActionsId === order.id;
                return (
                  <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3 sm:px-6 py-4 text-center">
                      {order.status !== 'ملغي' ? (
                        <input
                          type="checkbox"
                          checked={selectedOrders.includes(order.id)}
                          onChange={() => toggleOrderSelection(order.id)}
                          className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      ) : (
                        <div className="w-5 h-5 bg-gray-200 rounded border border-gray-300"></div> // placeholder للملغيات
                      )}
                    </td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-semibold text-slate-800">#{order.order_number}</div>
                      <div className="text-xs text-slate-500">{formatDateTime(order.order_date).split(' - ')[0]}</div>
                    </td>
                    <td className="px-3 sm:px-6 py-4">
                      <div className="font-semibold text-slate-800">{order.customer_name || 'غير مسجل'}</div>
                      <div className="text-xs text-slate-500">{order.phone_number || 'غير مسجل'}</div>
                    </td>
                    <td className="px-3 sm:px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <CreditCard className="h-4 w-4 text-amber-600 flex-shrink-0" />
                        <span className="text-sm font-medium text-slate-700">{getPaymentMethodLabel(order.payment_method)}</span>
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Package className="h-4 w-4 text-slate-400 flex-shrink-0" />
                        <span className="font-semibold text-slate-700">{order.products?.length || 0} عنصر</span>
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-4 text-right">
                      <div className="text-lg font-bold text-indigo-600">{formatSAR(order.total_price)}</div>
                    </td>
                    <td className="px-3 sm:px-6 py-4">
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(order.status)}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-4 text-right relative">
                      {/* زر افتتاح القائمة في الجوال */}
                      <button
                        onClick={() => setOpenActionsId(isActionsOpen ? null : order.id)}
                        className="sm:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors flex items-center justify-center w-10 h-10"
                      >
                        <ChevronDown className={`h-4 w-4 transition-transform ${isActionsOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {/* القائمة المنسدلة في الجوال */}
                      {isActionsOpen && (
                        <div className="sm:hidden absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg py-2 w-48 z-10">
                          <button
                            onClick={() => { setViewOrder(order); setOpenActionsId(null); }}
                            className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3"
                          >
                            <Eye className="h-4 w-4 text-indigo-600" /> عرض التفاصيل
                          </button>
                          {order.status !== 'ملغي' && (
                            <>
                              {currentUser?.role === 'admin' && (
                                <button
                                  onClick={() => {
                                    setEditingOrderId(order.id);
                                    setShowAddProductModal(true);
                                    setOpenActionsId(null);
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3"
                                >
                                  <Plus className="h-4 w-4 text-blue-600" /> إضافة منتج
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  openLockSingleModal(order);
                                  setOpenActionsId(null);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3"
                              >
                                <CheckCircle className="h-4 w-4 text-emerald-600" /> إقفال مع التكاليف
                              </button>
                              {currentUser?.role === 'admin' && (
                                <button
                                  onClick={() => {
                                    openCancelModal(order.id);
                                    setOpenActionsId(null);
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-red-50 flex items-center gap-3"
                                >
                                  <X className="h-4 w-4 text-red-600" /> إلغاء الطلب
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      )}
                      {/* الأزرار المباشرة في الشاشات الكبيرة */}
                      <div className="hidden sm:flex items-center gap-1">
                        <button
                          onClick={() => setViewOrder(order)}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors min-w-[40px] h-[40px] flex items-center justify-center"
                          title="عرض التفاصيل"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {order.status !== 'ملغي' && (
                          <>
                            {currentUser?.role === 'admin' && (
                              <button
                                onClick={() => {
                                  setEditingOrderId(order.id);
                                  setShowAddProductModal(true);
                                }}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors min-w-[40px] h-[40px] flex items-center justify-center"
                                title="إضافة منتج"
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              onClick={() => openLockSingleModal(order)}
                              className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors min-w-[40px] h-[40px] flex items-center justify-center"
                              title="إقفال مع التكاليف"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </button>
                            {currentUser?.role === 'admin' && (
                              <button
                                onClick={() => openCancelModal(order.id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors min-w-[40px] h-[40px] flex items-center justify-center"
                                title="إلغاء الطلب"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            )}
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
        {/* === Pagination === */}
        {totalPages > 1 && (
          <div className="bg-slate-50 px-6 py-4 flex flex-col sm:flex-row items-center justify-between border-t border-slate-200 gap-3">
            <div className="text-sm text-slate-600 text-center sm:text-left">
              عرض {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredOrders.length)} من {filteredOrders.length}
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-center">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 text-sm border border-slate-300 rounded-xl disabled:opacity-50 hover:bg-slate-50 transition-colors min-h-[40px]"
              >
                السابق
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-4 py-2 text-sm border rounded-xl ${currentPage === page
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'border-slate-300 hover:bg-slate-50'
                    } min-h-[40px]`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 text-sm border border-slate-300 rounded-xl disabled:opacity-50 hover:bg-slate-50 transition-colors min-h-[40px]"
              >
                التالي
              </button>
            </div>
          </div>
        )}
      </div>
      {/* === مودال عرض تفاصيل الطلب === */}
      {viewOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <h3 className="text-2xl font-bold text-slate-800">تفاصيل الطلب #{viewOrder.order_number}</h3>
              <button onClick={() => setViewOrder(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                <X className="h-6 w-6 text-slate-500" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div className="space-y-6">
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
                  <div className="p-3 bg-indigo-100 rounded-xl">
                    <User className="h-6 w-6 text-indigo-600" />
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-600">اسم العميل</p>
                    <p className="font-semibold text-slate-800">{viewOrder.customer_name || 'غير مسجل'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
                  <div className="p-3 bg-green-100 rounded-xl">
                    <Phone className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-600">رقم الهاتف</p>
                    <p className="font-semibold text-slate-800">{viewOrder.phone_number || 'غير مسجل'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
                  <div className="p-3 bg-blue-100 rounded-xl">
                    <Clock className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-600">تاريخ ووقت الطلب</p>
                    <p className="font-semibold text-slate-800">{formatDateTime(viewOrder.order_date)}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
                  <div className="p-3 bg-purple-100 rounded-xl">
                    <Truck className="h-6 w-6 text-purple-600" />
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-600">شركة الشحن</p>
                    <p className="font-semibold text-slate-800">{viewOrder.shipping_company || 'غير مسجل'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
                  <div className="p-3 bg-emerald-100 rounded-xl">
                    <DollarSign className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-600">تكلفة الشحن</p>
                    <p className="font-semibold text-slate-800">{formatSAR(viewOrder.shipping_cost ?? 0, true)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
                  <div className="p-3 bg-amber-100 rounded-xl">
                    <CreditCard className="h-6 w-6 text-amber-600" />
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-600">طريقة الدفع</p>
                    <p className="font-semibold text-slate-800">{getPaymentMethodLabel(viewOrder.payment_method)}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="mb-8">
              <h4 className="text-xl font-bold text-slate-800 mb-4 text-right">المنتجات</h4>
              <div className="space-y-3">
                {viewOrder.products?.map((product, i) => (
                  <div key={i} className="bg-slate-50 rounded-xl p-4 flex justify-between items-center">
                    <div className="text-right">
                      <p className="font-semibold text-slate-800">{product.name}</p>
                      <p className="text-sm text-slate-600">الكمية: {product.quantity}</p>
                      <p className="text-sm text-slate-600">القيمة غير شاملة الضريبة: {formatSAR(product.unit_price)}</p>
                      <p className="text-sm text-slate-600">القيمة شاملة الضريبة: {formatSAR(product.unit_price * 1.15)}</p>
                      <p className="text-sm text-slate-600">المورد: {product.supplier_name || 'غير محدد'}</p>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-slate-700">التكلفة: {formatSAR(product.cost_price)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="border-t pt-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-xl">
                  <p className="text-xs text-indigo-600">الفرعي</p>
                  <p className="text-lg font-bold text-indigo-700">{formatSAR(viewOrder.subtotal_before_tax)}</p>
                </div>
                <div className="bg-gradient-to-br from-yellow-50 to-amber-50 p-4 rounded-xl">
                  <p className="text-xs text-amber-600">الضريبة</p>
                  <p className="text-lg font-bold text-amber-700">{formatSAR(viewOrder.tax_amount)}</p>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-violet-50 p-4 rounded-xl">
                  <p className="text-xs text-purple-600">الشحن</p>
                  <p className="text-lg font-bold text-purple-700">{formatSAR(viewOrder.shipping_cost ?? 0, true)}</p>
                </div>
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-4 rounded-xl">
                  <p className="text-xs text-emerald-600">الإجمالي</p>
                  <p className="text-lg font-bold text-emerald-700">{formatSAR(viewOrder.total_price)}</p>
                </div>
              </div>
            </div>
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setViewOrder(null)}
                className="px-6 py-3 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 font-medium min-h-[44px]"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
      {/* === مودال الإقفال / الحذف === */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">
                {bulkAction === 'lock' ? 'إقفال الطلبات مع التكاليف والموردين' : 'حذف نهائي'}
              </h3>
              <button onClick={() => { setShowBulkModal(false); setTempCosts({}); setTempSuppliers({}); setTempShipping({}); setTempShippingBearer({}); setCurrentStep(0); setDeleteConfirmText(''); }}>
                <X className="h-6 w-6 text-slate-500" />
              </button>
            </div>
            {bulkAction === 'lock' ? (
              <div className="space-y-6">
                {/* شريط التقدم */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">الخطوة {currentStep + 1} من {selectedOrders.length}</span>
                  <div className="flex-1 mx-4 bg-slate-200 rounded-full h-2">
                    <div className="bg-indigo-600 h-2 rounded-full" style={{ width: `${((currentStep + 1) / selectedOrders.length) * 100}%` }}></div>
                  </div>
                  <span className="text-sm font-semibold">طلب #{currentOrder?.order_number}</span>
                </div>
                {/* اختيار وضع المورد */}
                <div className="p-3 bg-slate-50 rounded-lg">
                  <label className="block text-sm font-medium text-slate-700 mb-2">وضع اختيار المورد</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        value="order"
                        checked={supplierMode === 'order'}
                        onChange={() => setSupplierMode('order')}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>لكامل الطلب</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        value="product"
                        checked={supplierMode === 'product'}
                        onChange={() => setSupplierMode('product')}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>لكل منتج</span>
                    </label>
                  </div>
                </div>
                {currentOrder && (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-lg">طلب #{currentOrder.order_number}</h4>
                      <span className="text-sm text-slate-600">
                        {currentOrder.customer_name} • {new Date(currentOrder.order_date).toLocaleDateString('ar-SA')}
                      </span>
                    </div>
                    {/* إضافة: قسم الشحن إذا كانت التكلفة صفر (معدل للإجبار على 0) */}
                    {(currentOrder.shipping_cost ?? 0) === 0 && (
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl mb-4">
                        <h5 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
                          <Truck className="h-4 w-4" />
                          إضافة معلومات الشحن (التكلفة الحالية: 0)
                        </h5>
                        {/* إضافة جديدة: توضيح الشركة المسجلة في الطلب للمطابقة */}
                        {currentOrder.shipping_company && (
                          <div className="mb-3 p-2 bg-blue-50 rounded-lg">
                            <p className="text-sm text-blue-700">
                              <Info className="h-4 w-4 inline mr-1" />
                              الشركة المسجلة في الطلب: <strong>{currentOrder.shipping_company}</strong>
                              (سيتم مطابقتها مع القائمة المنسدلة أدناه)
                            </p>
                          </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">شركة الشحن</label>
                            <select
                              value={tempShipping[currentOrder.id]?.company || ''}
                              onChange={(e) => {
                                const company = e.target.value;
                                setTempShipping(prev => ({
                                  ...prev,
                                  [currentOrder.id]: { ...prev[currentOrder.id], company }
                                }));
                                // اقتراح التكلفة تلقائياً
                                suggestShippingCost(currentOrder.id, company);
                              }}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 min-h-[44px]"
                            >
                              <option value="">اختر شركة الشحن</option>
                              {shippingOptions.map(option => (
                                <option key={option.name} value={option.name}>
                                  {option.name}
                                </option>
                              ))}
                              <option value="أخرى">أخرى (يدوي)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">تكلفة الشحن (ر.س) *</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={tempShipping[currentOrder.id]?.cost || ''}
                              onChange={(e) => {
                                const cost = parseFloat(e.target.value) || 0;
                                updateTempShippingCost(currentOrder.id, cost);
                              }}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 text-right min-h-[44px]"
                              placeholder="0.00"
                            />
                          </div>
                        </div>
                        {/* إضافة: اختيار مُتحمل الشحن */}
                        <div className="mt-4">
                          <label className="block text-sm font-medium text-slate-700 mb-2">من يتحمل قيمة الشحن؟</label>
                          <select
                            value={tempShippingBearer[currentOrder.id] || 'store'}
                            onChange={(e) => {
                              const bearer = e.target.value as 'store' | 'customer';
                              setTempShippingBearer(prev => ({
                                ...prev,
                                [currentOrder.id]: bearer
                              }));
                            }}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 min-h-[44px]"
                          >
                            <option value="store">المتجر</option>
                            <option value="customer">العميل</option>
                          </select>
                        </div>
                        {tempShipping[currentOrder.id]?.company === 'أخرى' && (
                          <div className="mt-2 p-2 bg-slate-100 rounded">
                            <input
                              type="text"
                              value={tempShipping[currentOrder.id]?.company || ''}
                              onChange={(e) => {
                                setTempShipping(prev => ({
                                  ...prev,
                                  [currentOrder.id]: { ...prev[currentOrder.id], company: e.target.value }
                                }));
                              }}
                              className="w-full px-3 py-1 text-sm border rounded focus:ring-2 focus:ring-amber-500 min-h-[36px]"
                              placeholder="أدخل اسم الشركة يدوياً"
                            />
                          </div>
                        )}
                      </div>
                    )}
                    {supplierMode === 'order' && (
                      <div className="mb-3">
                        <label className="block text-sm font-medium text-slate-700 mb-2">المورد للطلب</label>
                        <div className="flex gap-2">
                          <select
                            value={tempSuppliers[currentOrder.id] || ''}
                            onChange={e => setTempSuppliers(prev => ({ ...prev, [currentOrder.id]: e.target.value }))}
                            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 min-h-[44px]"
                          >
                            <option value="">اختر المورد</option>
                            {entities.map((entity: Entity) => (
                              <option key={entity.id} value={entity.id}>
                                {entity.name}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => setShowAddSupplierModal(true)}
                            className="px-3 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors"
                            title="إضافة مورد جديد"
                          >
                            <Plus className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="space-y-2">
                      {currentOrder.products?.map(product => {
                        const costKey = `${currentOrder.id}-${product.id}`;
                        const supplierKey = supplierMode === 'product' ? costKey : currentOrder.id;
                        return (
                          <div key={product.id} className="flex items-center justify-between bg-slate-50 p-3 rounded-lg">
                            <div className="text-sm">
                              <span className="font-medium">{product.name}</span>
                              <span className="text-slate-600 mx-2">× {product.quantity}</span>
                              <span className="text-slate-500">{formatSAR(product.unit_price)}</span>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              {supplierMode === 'product' && (
                                <div className="w-full">
                                  <label className="text-xs text-slate-600 block mb-1">المورد:</label>
                                  <div className="flex gap-1">
                                    <select
                                      value={tempSuppliers[supplierKey] || ''}
                                      onChange={e => setTempSuppliers(prev => ({ ...prev, [supplierKey]: e.target.value }))}
                                      className="flex-1 px-2 py-1 text-xs border rounded focus:ring-2 focus:ring-indigo-500 min-h-[36px]"
                                    >
                                      <option value="">اختر المورد</option>
                                      {entities.map((entity: Entity) => (
                                        <option key={entity.id} value={entity.id}>
                                          {entity.name}
                                        </option>
                                      ))}
                                    </select>
                                    <button
                                      onClick={() => setShowAddSupplierModal(true)}
                                      className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition-colors"
                                      title="إضافة مورد جديد"
                                    >
                                      <Plus className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                              )}
                              <div className="flex items-center gap-2">
                                <label className="text-xs text-slate-600">تكلفة الوحدة:</label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={tempCosts[costKey] ?? ''}
                                  onChange={e => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setTempCosts(prev => ({ ...prev, [costKey]: val }));
                                  }}
                                  className="w-24 px-2 py-1 text-center border rounded-lg focus:ring-2 focus:ring-emerald-500 min-h-[36px]"
                                  placeholder="0.00"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
                <div className="flex justify-between items-center">
                  <button
                    onClick={prevStep}
                    disabled={currentStep === 0}
                    className="px-4 py-2 bg-slate-200 rounded-lg hover:bg-slate-300 disabled:opacity-50 flex items-center gap-2 min-h-[44px]"
                  >
                    <ChevronRight className="h-4 w-4" />
                    السابق
                  </button>
                  <div className="flex gap-3">
                    <button
                      onClick={() => { setShowBulkModal(false); setTempCosts({}); setTempSuppliers({}); setTempShipping({}); setTempShippingBearer({}); setCurrentStep(0); }}
                      className="px-5 py-2 bg-slate-200 rounded-lg hover:bg-slate-300 min-h-[44px]"
                    >
                      إلغاء
                    </button>
                    <button
                      onClick={executeLockWithCosts}
                      disabled={!isCurrentStepReady()}
                      className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg hover:shadow-md disabled:opacity-50 flex items-center gap-2 min-h-[44px]"
                    >
                      {currentStep < selectedOrders.length - 1 ? (
                        <>
                          التالي <ChevronLeft className="h-4 w-4" />
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-5 w-5" />
                          إقفال الطلبات ({selectedOrders.length})
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-red-600 font-medium">
                  سيتم حذف {selectedOrders.length} طلب نهائيًا ولن يمكن استرجاعها.
                </p>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={e => setDeleteConfirmText(e.target.value)}
                  placeholder='اكتب "حذف نهائي"'
                  className="w-full px-4 py-2 border border-red-300 rounded-lg text-right focus:ring-red-500 min-h-[44px]"
                />
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => { setShowBulkModal(false); setDeleteConfirmText(''); }}
                    className="px-5 py-2 bg-slate-200 rounded-lg min-h-[44px]"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={executeBulkDelete}
                    disabled={deleteConfirmText !== 'حذف نهائي'}
                    className="px-5 py-2 bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-lg hover:shadow-md disabled:opacity-50 min-h-[44px]"
                  >
                    حذف نهائي
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* === إضافة: مودال إلغاء الطلب === */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <h3 className="text-xl font-bold text-slate-800">إلغاء الطلب</h3>
              <button onClick={() => setShowCancelModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                <X className="h-6 w-6 text-slate-500" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">سبب الإلغاء *</label>
                <textarea
                  value={cancelFormData.reason}
                  onChange={(e) => setCancelFormData(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 min-h-[80px]"
                  placeholder="أدخل سبب الإلغاء"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">رسوم الإلغاء (ر.س)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={cancelFormData.fee}
                  onChange={(e) => setCancelFormData(prev => ({ ...prev, fee: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 text-right min-h-[44px]"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">من يتحمل الرسوم؟</label>
                <select
                  value={cancelFormData.feeBearer}
                  onChange={(e) => setCancelFormData(prev => ({ ...prev, feeBearer: e.target.value as 'customer' | 'store' }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 min-h-[44px]"
                >
                  <option value="customer">العميل</option>
                  <option value="store">المتجر</option>
                </select>
              </div>
              <div className="text-xs text-slate-500">
                ملغي بواسطة: {cancelFormData.cancelledBy}
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  onClick={() => setShowCancelModal(false)}
                  className="px-6 py-3 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 font-medium min-h-[44px]"
                >
                  إلغاء
                </button>
                <button
                  onClick={executeCancel}
                  disabled={!cancelFormData.reason}
                  className="px-6 py-3 bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-xl hover:shadow-md font-medium disabled:opacity-50 min-h-[44px]"
                >
                  تأكيد الإلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* === مودال إضافة طلب جديد (محسن التصميم على خطوات) - إزالة base_shipping_cost وإظهار الإجمالي كما هو === */}
      {showNewOrderModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[95vh] overflow-y-auto p-8">
            <div className="flex justify-between items-center mb-8 border-b pb-4">
              <h3 className="text-3xl font-bold text-slate-800">إضافة طلب جديد</h3>
              <button onClick={() => { setShowNewOrderModal(false); setCurrentStepNewOrder(0); setAutoLockNewOrder(false); }} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                <X className="h-6 w-6 text-slate-500" />
              </button>
            </div>
            {/* شريط التقدم للخطوات */}
            <div className="mb-8">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">الخطوة {currentStepNewOrder + 1} من {steps.length}</span>
                <div className="flex-1 mx-4 bg-slate-200 rounded-full h-2">
                  <div className="bg-indigo-600 h-2 rounded-full transition-all duration-300" style={{ width: `${((currentStepNewOrder + 1) / steps.length) * 100}%` }}></div>
                </div>
                <span className="text-sm font-semibold">{steps[currentStepNewOrder]}</span>
              </div>
            </div>
            <div className="space-y-8">
              {/* خطوة 1: بيانات العميل */}
              {currentStepNewOrder === 0 && (
                <div className="space-y-6">
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-2xl border border-blue-200">
                    <h4 className="text-lg font-semibold text-blue-800 mb-4 flex items-center gap-2">
                      <User className="h-5 w-5" />
                      بيانات العميل
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">اسم العميل *</label>
                        <input
                          type="text"
                          value={newOrder.customer_name}
                          onChange={(e) => setNewOrder(prev => ({ ...prev, customer_name: e.target.value }))}
                          className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[44px]"
                          placeholder="أدخل اسم العميل"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">رقم الهاتف</label>
                        <input
                          type="tel"
                          value={newOrder.phone_number}
                          onChange={(e) => setNewOrder(prev => ({ ...prev, phone_number: e.target.value }))}
                          className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[44px]"
                          placeholder="أدخل رقم الهاتف"
                        />
                      </div>
                    </div>
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-slate-700 mb-2">طريقة الدفع</label>
                      <select
                        value={newOrder.payment_method}
                        onChange={(e) => setNewOrder(prev => ({ ...prev, payment_method: e.target.value }))}
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                      >
                        <option value="">اختر طريقة الدفع</option>
                        <option value="tamara_installment">تمارا</option>
                        <option value="bank">تحويل بنكي</option>
                        <option value="mada">مدى</option>
                        <option value="credit_card">بطاقة ائتمانية</option>
                        <option value="madfu_installment">مدفوع للتقسيط</option>
                        <option value="tabby_installment">تابي للتقسيط</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
              {/* خطوة 2: المنتجات */}
              {currentStepNewOrder === 1 && (
                <div className="space-y-6">
                  <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-6 rounded-2xl border border-emerald-200">
                    <h4 className="text-lg font-semibold text-emerald-800 mb-4 flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      إضافة المنتجات
                    </h4>
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {newOrder.products.map((product, index) => (
                        <div key={product.id} className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                          <div className="flex-1 text-right">
                            <p className="font-semibold text-slate-800">{product.name}</p>
                            <p className="text-sm text-slate-600">
                              الكمية: {product.quantity} × {formatSAR(product.unit_price)} = {formatSAR(product.subtotal)}
                              {product.tax_included && <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">شامل الضريبة</span>}
                            </p>
                          </div>
                          <button
                            onClick={() => removeNewProduct(product.id)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors min-w-[40px] h-[40px] flex items-center justify-center"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    {/* إضافة منتج جديد */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4 p-4 bg-slate-50 rounded-xl">
                      <input
                        type="text"
                        placeholder="اسم المنتج *"
                        value={newProduct.name}
                        onChange={(e) => setNewProduct(prev => ({ ...prev, name: e.target.value }))}
                        className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 min-h-[44px]"
                      />
                      <input
                        type="number"
                        placeholder="الكمية"
                        value={newProduct.quantity}
                        onChange={(e) => setNewProduct(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                        className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 text-right min-h-[44px]"
                        min="1"
                      />
                      <input
                        type="number"
                        placeholder="سعر الوحدة (ر.س)"
                        value={newProduct.unit_price}
                        onChange={(e) => setNewProduct(prev => ({ ...prev, unit_price: parseFloat(e.target.value) || 0 }))}
                        className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 text-right min-h-[44px]"
                        min="0"
                        step="0.01"
                      />
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="tax_included"
                          checked={newProduct.tax_included}
                          onChange={(e) => setNewProduct(prev => ({ ...prev, tax_included: e.target.checked }))}
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <label htmlFor="tax_included" className="text-sm text-slate-600 cursor-pointer">شامل الضريبة</label>
                      </div>
                      <button
                        onClick={addNewProductToOrder}
                        disabled={!newProduct.name}
                        className="col-span-1 md:col-span-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-medium flex items-center justify-center gap-2 min-h-[44px]"
                      >
                        <Plus className="h-4 w-4 flex-shrink-0" />
                        إضافة
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {/* خطوة 3: معلومات الشحن - إزالة base_shipping_cost */}
              {currentStepNewOrder === 2 && (
                <div className="space-y-6">
                  <div className="bg-gradient-to-br from-purple-50 to-violet-50 p-6 rounded-2xl border border-purple-200">
                    <h4 className="text-lg font-semibold text-purple-800 mb-4 flex items-center gap-2">
                      <Truck className="h-5 w-5" />
                      معلومات الشحن
                    </h4>
                    {/* إضافة جديدة: توضيح للمطابقة مع القائمة المنسدلة (للطلب الجديد، لا توجد شركة مسجلة بعد) */}
                    <div className="mb-3 p-2 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-700">
                        <Info className="h-4 w-4 inline mr-1" />
                        اختر شركة الشحن من القائمة المنسدلة أدناه للاقتراح التلقائي للتكلفة، أو أدخل يدوياً.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">شركة الشحن *</label>
                        <select
                          value={newOrder.shipping_company}
                          onChange={(e) => {
                            const company = e.target.value;
                            setNewOrder(prev => ({ ...prev, shipping_company: company }));
                            // اقتراح التكلفة تلقائياً للطلب الجديد
                            const match = findShippingMatch(company);
                            if (match) {
                              setNewOrder(prev => ({ ...prev, shipping_cost: match.cost }));
                            }
                          }}
                          className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent min-h-[44px]"
                        >
                          <option value="">اختر شركة الشحن</option>
                          {shippingOptions.map(option => (
                            <option key={option.name} value={option.name}>
                              {option.name} ({formatSAR(option.cost)})
                            </option>
                          ))}
                          <option value="أخرى">أخرى (يدوي)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">تكلفة الشحن (ر.س)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={newOrder.shipping_cost ?? 0}
                          onChange={(e) => setNewOrder(prev => ({ ...prev, shipping_cost: parseFloat(e.target.value) || 0 }))}
                          className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-right min-h-[44px]"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    {newOrder.shipping_company === 'أخرى' && (
                      <div className="mt-4 p-2 bg-slate-100 rounded">
                        <input
                          type="text"
                          value={newOrder.shipping_company}
                          onChange={(e) => setNewOrder(prev => ({ ...prev, shipping_company: e.target.value }))}
                          className="w-full px-3 py-1 text-sm border rounded focus:ring-2 focus:ring-purple-500 min-h-[36px]"
                          placeholder="أدخل اسم الشركة يدوياً"
                        />
                      </div>
                    )}
                    <div className="mt-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={newOrder.tax_included}
                          onChange={(e) => setNewOrder(prev => ({ ...prev, tax_included: e.target.checked }))}
                          className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm text-slate-700">الإجمالي يشمل الضريبة</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}
              {/* خطوة 4: الملخص - إزالة عرض base_shipping_cost */}
              {currentStepNewOrder === 3 && (
                <div className="space-y-6">
                  <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-6 rounded-2xl border border-indigo-200">
                    <h4 className="text-lg font-semibold text-indigo-800 mb-4">ملخص الطلب</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="text-right">
                        <h5 className="font-medium text-slate-700 mb-3">بيانات العميل:</h5>
                        <p><strong>الاسم:</strong> {newOrder.customer_name}</p>
                        <p><strong>الهاتف:</strong> {newOrder.phone_number || 'غير محدد'}</p>
                        <p><strong>طريقة الدفع:</strong> {getPaymentMethodLabel(newOrder.payment_method)}</p>
                        {newOrder.order_number && <p><strong>رقم الطلب:</strong> {newOrder.order_number}</p>}
                      </div>
                      <div className="text-right">
                        <h5 className="font-medium text-slate-700 mb-3">معلومات الشحن:</h5>
                        <p><strong>الشركة:</strong> {newOrder.shipping_company || 'غير محدد'}</p>
                        <p><strong>التكلفة:</strong> {formatSAR(newOrder.shipping_cost ?? 0)}</p>
                        {newOrder.shipping_address && <p><strong>العنوان:</strong> {newOrder.shipping_address}</p>}
                      </div>
                    </div>
                    <div className="mt-6">
                      <h5 className="font-medium text-slate-700 mb-3">المنتجات ({newOrder.products.length} عنصر):</h5>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {newOrder.products.map((p) => (
                          <p key={p.id} className="text-sm text-slate-600">{p.name} × {p.quantity} - {formatSAR(p.subtotal)}</p>
                        ))}
                      </div>
                    </div>
                    <div className="mt-6 border-t pt-4">
                      <div className="space-y-1 text-right">
                        <div className="flex justify-between text-sm text-slate-600">
                          <span>الفرعي:</span>
                          <span>{formatSAR(calculateOrderTotal().subtotal)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-slate-600">
                          <span>الضريبة (15%):</span>
                          <span>{formatSAR(calculateOrderTotal().tax)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-slate-600">
                          <span>الشحن:</span>
                          <span>{formatSAR(newOrder.shipping_cost ?? 0)}</span>
                        </div>
                        <div className="border-t pt-2 mt-2 flex justify-between text-lg font-bold text-emerald-700">
                          <span>الإجمالي:</span>
                          <span>{formatSAR(calculateOrderTotal().total)}</span>
                        </div>
                      </div>
                    </div>
                    {/* إضافة: خيار الإقفال الفوري */}
                    <div className="mt-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={autoLockNewOrder}
                          onChange={(e) => setAutoLockNewOrder(e.target.checked)}
                          className="rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500 h-5 w-5"
                        />
                        <span className="text-sm font-medium text-emerald-800">
                          إقفال الطلب فوراً بعد الإضافة (سيتم فتح نافذة إدخال التكاليف والموردين والشحن)
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-between items-center pt-8 border-t mt-8">
              <button
                onClick={prevStepNewOrder}
                disabled={currentStepNewOrder === 0}
                className="px-8 py-3 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 font-medium disabled:opacity-50 flex items-center gap-2 min-h-[44px]"
              >
                <ChevronRight className="h-5 w-5" />
                السابق
              </button>
              <div className="flex gap-4">
                <button
                  onClick={() => { setShowNewOrderModal(false); setCurrentStepNewOrder(0); setAutoLockNewOrder(false); }}
                  className="px-8 py-3 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 font-medium min-h-[44px]"
                >
                  إلغاء
                </button>
                <button
                  onClick={nextStepNewOrder}
                  disabled={
                    currentStepNewOrder === 0 && !newOrder.customer_name ||
                    currentStepNewOrder === 1 && newOrder.products.length === 0
                  }
                  className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl hover:shadow-lg font-medium disabled:opacity-50 flex items-center gap-2 min-h-[44px]"
                >
                  {currentStepNewOrder === 3 ? (
                    <>
                      <CheckCircle className="h-5 w-5 flex-shrink-0" />
                      حفظ الطلب
                    </>
                  ) : (
                    <>
                      التالي <ChevronLeft className="h-5 w-5 flex-shrink-0" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* === مودال إضافة منتج إلى طلب موجود (بدون تكلفة أو مورد) === */}
      {showAddProductModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <h3 className="text-xl font-bold text-slate-800">إضافة منتج إلى الطلب</h3>
              <button onClick={() => setShowAddProductModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                <X className="h-6 w-6 text-slate-500" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">اسم المنتج *</label>
                <input
                  type="text"
                  value={addProduct.name}
                  onChange={(e) => setAddProduct(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 min-h-[44px]"
                  placeholder="أدخل اسم المنتج"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">الكمية</label>
                  <input
                    type="number"
                    value={addProduct.quantity}
                    onChange={(e) => setAddProduct(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 text-right min-h-[44px]"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">سعر الوحدة (ر.س)</label>
                  <input
                    type="number"
                    value={addProduct.unit_price}
                    onChange={(e) => setAddProduct(prev => ({ ...prev, unit_price: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 text-right min-h-[44px]"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="add_tax_included"
                  checked={addProduct.tax_included}
                  onChange={(e) => setAddProduct(prev => ({ ...prev, tax_included: e.target.checked }))}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="add_tax_included" className="text-sm text-slate-600 cursor-pointer">شامل الضريبة</label>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  onClick={() => setShowAddProductModal(false)}
                  className="px-6 py-3 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 font-medium min-h-[44px]"
                >
                  إلغاء
                </button>
                <button
                  onClick={addProductToExistingOrder}
                  className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl hover:shadow-md font-medium disabled:opacity-50 min-h-[44px]"
                  disabled={!addProduct.name}
                >
                  إضافة المنتج
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showAIBillModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[85vh] overflow-hidden flex flex-col">
            {/* الهيدر */}
            <div className="flex justify-between items-center p-5 border-b">
              <button
                onClick={() => {
                  setShowAIBillModal(false);
                  setPastedText('');
                  setExtractedData(null);
                  setExtractionStatus('idle');
                  setExtractionMessage('');
                }}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="h-6 w-6 text-slate-500" />
              </button>
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Brain className="h-6 w-6 text-purple-600" />
                إضافة من نص الطلب (AI)
              </h3>
              <div className="w-10" /> {/* للتوازن */}
            </div>
            {/* الجسم: عمودين (معاينة يمين ← إدخال يسار) */}
            <div className="flex flex-col lg:flex-row-reverse flex-1 overflow-hidden">

              {/* الجانب الأيمن: البيانات المستخرجة */}
              <div className="w-full lg:w-1/2 p-5 bg-gradient-to-b from-green-50 to-white overflow-y-auto border-l lg:border-l border-green-200">
                <h4 className="font-bold text-lg text-green-800 mb-4 text-right">البيانات المستخرجة</h4>

                {extractedData ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 text-sm text-right">
                      <p><strong>العميل:</strong> {extractedData.customer_name || 'غير محدد'}</p>
                      <p><strong>الهاتف:</strong> {extractedData.phone_number || 'غير محدد'}</p>
                      <p><strong>رقم الطلب:</strong> {extractedData.order_number || 'غير محدد'}</p>
                      <p><strong>طريقة الدفع:</strong> {getPaymentMethodLabel(extractedData.payment_method) || 'غير محدد'}</p>
                      <p><strong>شركة الشحن:</strong> {extractedData.shipping_company || 'غير محدد'}</p>
                      <p><strong>الفرعي:</strong> {formatSAR(extractedData.subtotal_before_tax)}</p>
                      <p><strong>الضريبة:</strong> {formatSAR(extractedData.tax_amount)}</p>
                      <p><strong>الشحن:</strong> {formatSAR(extractedData.shipping_cost ?? 0)}</p>
                      <p className="col-span-2 text-lg font-bold text-green-700">
                        <strong>الإجمالي:</strong> {formatSAR(extractedData.total)}
                      </p>
                    </div>
                    {extractedData.products && extractedData.products.length > 0 && (
                      <div className="mt-4">
                        <h5 className="font-semibold text-green-700 mb-2 text-right">
                          المنتجات ({extractedData.products.length} عنصر)
                        </h5>
                        <div className="max-h-64 overflow-y-auto border border-green-200 rounded-lg bg-white">
                          {extractedData.products.map((p: any, i: number) => (
                            <div key={i} className="flex justify-between px-3 py-2 border-b last:border-0 text-sm">
                              <span className="font-medium">{formatSAR(p.price)}</span>
                              <span className="truncate max-w-[220px] text-right">
                                {p.name} × {p.quantity}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <button
                      onClick={addFromExtractedData}
                      className="w-full mt-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-lg transition-shadow shadow-md min-h-[44px]"
                    >
                      إضافة الطلب من هذه البيانات
                    </button>
                  </div>
                ) : (
                  <div className="text-center text-slate-500 mt-20">
                    <Brain className="h-16 w-16 mx-auto text-slate-300 mb-4" />
                    <p className="text-lg">سيظهر هنا معاينة البيانات بعد الاستخراج بالـ AI</p>
                  </div>
                )}
              </div>
              {/* الجانب الأيسر: لصق النص + زر الاستخراج */}
              <div className="w-full lg:w-1/2 p-5 flex flex-col bg-gray-50">
                <div className="flex flex-col flex-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2 text-right">
                      لصق نص الطلب هنا *
                    </label>
                    <textarea
                      value={pastedText}
                      onChange={(e) => setPastedText(e.target.value)}
                      placeholder="الصق نص الطلب الكامل هنا (اسم العميل، الهاتف، المنتجات، الأسعار، الإجمالي...)"
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent h-48 text-sm resize-none text-right placeholder:text-right placeholder:text-slate-400"
                    // تم حذف dir="rtl" نهائياً (السبب الرئيسي للخطأ مع StrictMode)
                    />
                  </div>
                  <button
                    onClick={extractFromText}
                    disabled={!pastedText.trim() || isExtracting}
                    className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 transition-all shadow-lg min-h-[44px]"
                  >
                    {isExtracting ? (
                      <>
                        <Loader2 className="h-6 w-6 animate-spin flex-shrink-0" />
                        جاري الاستخراج...
                      </>
                    ) : (
                      <>
                        <Brain className="h-6 w-6 flex-shrink-0" />
                        استخراج بالـ AI
                      </>
                    )}
                  </button>
                  {/* رسائل الحالة */}
                  {extractionStatus === 'success' && (
                    <div className="p-4 bg-green-100 border border-green-300 rounded-xl text-green-800 flex items-center gap-2 text-right">
                      <CheckCircle className="h-5 w-5 flex-shrink-0" />
                      <span>{extractionMessage}</span>
                    </div>
                  )}
                  {extractionStatus === 'error' && (
                    <div className="p-4 bg-red-100 border border-red-300 rounded-xl text-red-800 flex items-center gap-2 text-right">
                      <XCircle className="h-5 w-5 flex-shrink-0" />
                      <span>{extractionMessage}</span>
                    </div>
                  )}
                </div>
                <div className="mt-6 pt-4 border-t text-center">
                  <button
                    onClick={() => {
                      setShowAIBillModal(false);
                      setPastedText('');
                      setExtractedData(null);
                      setExtractionStatus('idle');
                      setExtractionMessage('');
                    }}
                    className="px-8 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-medium transition-colors min-h-[44px]"
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === إضافة: مودال التحميل والنجاح (محسن للارتباط بالعملية) === */}
      {(isProcessing || showSuccess) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-center">
            {isProcessing ? (
              <div className="space-y-4">
                <div className="mx-auto w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center">
                  <Loader2 className={`h-8 w-8 text-indigo-600 animate-spin ${processingStep === 0 ? 'block' : 'hidden'}`} />
                  <CheckCircle className={`h-8 w-8 text-emerald-600 ${processingStep === 1 ? 'block' : 'hidden'}`} />
                  <DollarSign className={`h-8 w-8 text-green-600 ${processingStep === 2 ? 'block' : 'hidden'}`} />
                  {processingType === 'add' && processingStep === 2 && <Package className="h-8 w-8 text-blue-600" />}
                </div>
                <div className="text-sm text-slate-600 space-y-1">
                  {processingType === 'lock' ? (
                    <>
                      <p className={processingStep === 0 ? 'text-indigo-600 font-medium' : ''}>جاري إقفال الطلب - تحديث التكاليف والموردين...</p>
                      <p className={processingStep === 1 ? 'text-emerald-600 font-medium' : ''}>جاري إقفال الطلب - إغلاق الطلبات...</p>
                      <p className={processingStep === 2 ? 'text-green-600 font-medium' : ''}>جاري إقفال الطلب - إضافة المستحقات...</p>
                    </>
                  ) : (
                    <>
                      <p className={processingStep === 0 ? 'text-indigo-600 font-medium' : ''}>جاري إضافة الطلب - إنشاء الطلب...</p>
                      <p className={processingStep === 1 ? 'text-emerald-600 font-medium' : ''}>جاري إضافة الطلب - حفظ الإجماليات...</p>
                      <p className={processingStep === 2 ? 'text-green-600 font-medium' : ''}>جاري إضافة الطلب - إدراج المنتجات...</p>
                    </>
                  )}
                </div>
              </div>
            ) : (
              showSuccess && (
                <div className="space-y-4">
                  <div className="mx-auto w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="h-8 w-8 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-emerald-700 mb-2">{processingType === 'lock' ? 'تم الإقفال بنجاح!' : 'تم الإضافة بنجاح!'}</h3>
                    <p className="text-sm text-slate-600">تم {processingType === 'lock' ? 'تحديث التكاليف والموردين وإضافة المستحقات.' : 'إنشاء الطلب وإدراج المنتجات.'}</p>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}
      {/* === حالة عدم وجود بيانات === */}
      {filteredOrders.length === 0 && !loading && (
        <div className="text-center py-16 bg-white rounded-2xl shadow-md">
          <Package className="h-16 w-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-2xl font-bold text-slate-600 mb-2">لا توجد طلبات تطابق بحثك.</h3>
          <p className="text-slate-500">جرب تعديل الفلاتر أو البحث</p>
        </div>
      )}
      {/* === مودال إضافة مورد جديد === */}
      {showAddSupplierModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <h3 className="text-xl font-bold text-slate-800">إضافة مورد جديد</h3>
              <button onClick={() => setShowAddSupplierModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                <X className="h-6 w-6 text-slate-500" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">اسم المورد *</label>
                <input
                  type="text"
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 min-h-[44px]"
                  placeholder="أدخل اسم المورد"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  onClick={() => setShowAddSupplierModal(false)}
                  className="px-6 py-3 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 font-medium min-h-[44px]"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleAddSupplier}
                  disabled={!newSupplierName.trim() || isAddingSupplier}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium disabled:opacity-50 min-h-[44px] flex items-center gap-2"
                >
                  {isAddingSupplier ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      جاري الإضافة...
                    </>
                  ) : (
                    'إضافة المورد'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default NewOrders;