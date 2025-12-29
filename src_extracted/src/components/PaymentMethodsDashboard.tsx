import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft, Banknote, Package, Receipt, Trash2, Wallet, X, CheckCircle,
  CreditCard, Smartphone, User, AlertCircle, Download, FileText, Eye
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useOrders } from '../hooks/useOrders';
import { authService } from '../lib/auth';
import toast, { Toaster } from 'react-hot-toast';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';
// ======================== INTERFACES ========================
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
  is_locked: boolean;
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
// ======================== COMPONENT ========================
const PaymentReceipts: React.FC = () => {
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
  const [showPreview, setShowPreview] = useState(false);
  const currentUser = authService.getCurrentUser();
  const { orders: allOrders } = useOrders();
  // فقط الطلبات المقفولة (is_locked = true)
  const lockedOrders = allOrders.filter(o => o.is_locked === true);
  // ======================== EFFECTS ========================
  useEffect(() => {
    fetchAllData();
  }, []);
  // ======================== DATA FETCHING ========================
  const fetchAllData = async () => {
    setLoading(true);
    try {
      // جلب طرق الدفع
      const { data: methodsData, error: methodsError } = await supabase
        .from('payment_methods')
        .select('*, total_paid')
        .eq('is_active', true)
        .order('name');
      if (methodsError) throw methodsError;
      setPaymentMethods(methodsData || []);
      // جلب الإيصالات
      const { data: receiptsData, error: receiptsError } = await supabase
        .from('payment_receipts')
        .select(`
          *,
          order:orders(order_number, customer_name, total_price)
        `)
        .order('created_at', { ascending: false });
      if (receiptsError) throw receiptsError;
      setReceipts(receiptsData || []);
      // جلب أسماء المستخدمين
      const userIds = [...new Set(receiptsData?.map(r => r.created_by) || [])];
      if (userIds.length > 0) {
        const { data: profiles, error: profileError } = await supabase
          .from('user_profiles')
          .select('id, full_name')
          .in('id', userIds);
        if (profileError) throw profileError;
        const profileMap = new Map<string, string>();
        profiles?.forEach(p => profileMap.set(p.id, p.full_name || 'مستخدم'));
        setUserProfiles(profileMap);
      }
    } catch (e: any) {
      console.error('Error fetching data:', e);
      toast.error('فشل جلب البيانات');
    } finally {
      setLoading(false);
    }
  };
  // ======================== RECEIPT NUMBER ========================
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
  // ======================== CALCULATE SUMMARIES ========================
const methodSummaries = useMemo(() => {
  const summaries: PaymentMethodSummary[] = [];

  // جلب طرق الدفع اللي تابعة لسلة من قاعدة البيانات
  const sallaGateways = paymentMethods.filter(m => m.is_salla_gateway === true);
  const basketMethod = paymentMethods.find(m => m.code === 'salla_basket');

  // === سلة - تجميع كل البوابات اللي is_salla_gateway = true ===
  if (basketMethod && sallaGateways.length > 0) {
    // جمع كل الطلبات من بوابات سلة
    const sallaOrders = lockedOrders.filter(o =>
      o.payment_method && sallaGateways.some(g => g.code === o.payment_method)
    );

    const totalOriginal = sallaOrders.reduce((sum, o) => sum + o.total_price, 0, 0);
    const orderCount = sallaOrders.length;

    // الإيصالات اليدوية تُسجل فقط تحت salla_basket
    const sallaReceipts = receipts.filter(r => r.payment_method_code === 'salla_basket');
    const totalPaid = sallaReceipts.reduce((sum, r) => sum + r.amount_received, 0);

    const totalRemaining = Math.max(0, totalOriginal - totalPaid);

    let expectedFees = 0;
    const subMethods: any[] = [];

    // حساب الرسوم لكل بوابة فرعية
    sallaGateways.forEach(gateway => {
      const subOrders = sallaOrders.filter(o => o.payment_method === gateway.code);
      if (subOrders.length === 0) {
        // حتى لو صفر طلبات → نعرض الكرت مع 0
        subMethods.push({
          name: gateway.name,
          code: gateway.code,
          orders: [],
          receipts: [],
          totalPaid: 0,
          totalOriginal: 0,
          expectedFees: 0,
          feeMethod: gateway
        });
        return;
      }

      const subTotal = subOrders.reduce((s, o) => s + o.total_price, 0);
      const fixed = subOrders.length * gateway.fixed_fee;
      const perc = (subTotal * gateway.percentage_fee) / 100;
      const subFees = fixed + perc;

      expectedFees += subFees;

      subMethods.push({
        name: gateway.name,
        code: gateway.code,
        orders: subOrders,
        receipts: [], // لا إيصالات منفصلة
        totalPaid: 0,
        totalOriginal: subTotal,
        expectedFees: subFees,
        feeMethod: gateway
      });
    });

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
      orders: sallaOrders,
      receipts: sallaReceipts,
      logo_url: basketMethod.logo_url || 'https://cdn.salla.sa/images/salla-logo.png',
      subMethods: subMethods.length > 0 ? subMethods : undefined
    });
  }

  // === باقي طرق الدفع (اللي مو تابعة لسلة) ===
  paymentMethods.forEach(method => {
    if (method.code === 'salla_basket' || method.is_salla_gateway === true) {
      return; // تمت معالجتها فوق
    }

    const relatedOrders = lockedOrders.filter(o => o.payment_method === method.code);
    const totalOriginal = relatedOrders.reduce((s, o) => s + o.total_price, 0, 0);
    const totalPaid = receipts
      .filter(r => r.payment_method_code === method.code)
      .reduce((sum, r) => sum + r.amount_received, 0);

    const totalRemaining = Math.max(0, totalOriginal - totalPaid);
    const expectedFees = relatedOrders.length * method.fixed_fee + (totalOriginal * method.percentage_fee) / 100;
    const netDue = Math.max(0, totalRemaining - expectedFees);

    // حتى لو صفر → نعرض الكرت
    summaries.push({
      method,
      name: method.name,
      code: method.code,
      totalOriginal,
      totalRemaining,
      orderCount: relatedOrders.length,
      expectedFees,
      netDue,
      totalPaid,
      orders: relatedOrders,
      receipts: receipts.filter(r => r.payment_method_code === method.code),
      logo_url: method.logo_url
    });
  });

  return summaries;
}, [paymentMethods, lockedOrders, receipts]);
  // ======================== MANUAL PAYMENT ========================
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
      let targetCode = selectedMethodSummary.code;
      if (['mada', 'credit_card'].includes(targetCode)) {
        targetCode = 'salla_basket';
      }
      const targetMethod = paymentMethods.find(m => m.code === targetCode);
      if (!targetMethod) {
        toast.error('طريقة الدفع غير موجودة');
        return;
      }
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
      };
      setReceipts(prev => [newReceipt, ...prev]);
      setPaymentMethods(prev =>
        prev.map(m => m.code === targetCode ? { ...m, total_paid: (m.total_paid || 0) + amount } : m)
      );
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
      setReceipts(prev => prev.map(r => (r.id === localId ? { ...r, ...inserted } : r)));
      await supabase
        .from('payment_methods')
        .update({ total_paid: (targetMethod.total_paid || 0) + amount })
        .eq('id', targetMethod.id);
      resetManualForm();
      setShowManualPaymentModal(false);
      toast.success(`تم تسجيل الدفع: ${receiptNumber}`);
    } catch (err: any) {
      console.error('خطأ في تسجيل الدفع:', err);
      toast.error(err.message || 'فشل تسجيل الدفع');
    }
  };
  // ======================== DELETE RECEIPT ========================
  const openDeleteConfirm = (receipt: PaymentReceipt) => {
    setReceiptToDelete(receipt);
    setShowDeleteConfirmModal(true);
  };
  const confirmDelete = async () => {
    if (!currentUser || currentUser.role !== 'admin' || !receiptToDelete) return;
    const rec = receiptToDelete;
    try {
      if (rec.id.startsWith('local-')) {
        setReceipts(prev => prev.filter(r => r.id !== rec.id));
        toast.success('تم حذف الإيصال محليًا');
      } else {
        const targetCode = rec.payment_method_code;
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
        setReceipts(prev => prev.filter(r => r.id !== rec.id));
        setPaymentMethods(prev =>
          prev.map(m => m.code === targetCode
            ? { ...m, total_paid: Math.max(0, (m.total_paid || 0) - rec.amount_received) }
            : m
          )
        );
        toast.success(`تم حذف الإيصال: ${rec.receipt_number || rec.id}`);
      }
      setShowDeleteConfirmModal(false);
      setReceiptToDelete(null);
      setSelectedMethodSummary(null);
    } catch (err: any) {
      console.error('خطأ في الحذف:', err);
      toast.error(err.message || 'فشل الحذف');
    }
  };
  const resetManualForm = () => {
    setManualAmount('');
    setManualNotes('');
    setManualDate(new Date().toISOString().split('T')[0]);
  };
  // ======================== HELPERS ========================
  const formatCurrency = (v: number): string => {
    const rounded = Math.round(v * 100) / 100;
    return `${rounded.toLocaleString('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س`;
  };
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'غير محدد';
    return date.toLocaleDateString('ar-SA', { day: 'numeric', month: 'long', year: 'numeric' });
  };
  const getUserName = (userId: string): string => {
    return userProfiles.get(userId) || 'مستخدم غير معروف';
  };
  // ======================== EXPORT FUNCTIONS ========================
  const handleExportExcel = async (summary: PaymentMethodSummary) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`${summary.name}`);
    worksheet.views = [{ rightToLeft: true }];
    worksheet.mergeCells('A1:D1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `تقرير طريقة الدفع: ${summary.name}`;
    titleCell.font = { size: 18, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
    titleCell.font = { ...titleCell.font, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).height = 30;
    worksheet.addRow([]);
    const summaryData = [
      ['إجمالي المستحق', formatCurrency(summary.totalRemaining)],
      ['إجمالي المستلم', formatCurrency(summary.totalPaid)],
      ['عدد الطلبات', summary.orderCount],
      ['الرسوم المتوقعة', formatCurrency(summary.expectedFees)],
      ['الصافي المستحق', formatCurrency(summary.netDue)]
    ];
    summaryData.forEach(([label, value]) => {
      const row = worksheet.addRow([label, value]);
      row.font = { bold: true };
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      });
    });
    worksheet.addRow([]);
    if (summary.receipts.length > 0) {
      const receiptsHeaderRow = worksheet.addRow(['سجل الدفعات']);
      receiptsHeaderRow.font = { size: 14, bold: true };
      receiptsHeaderRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
      receiptsHeaderRow.getCell(1).font = { ...receiptsHeaderRow.font, color: { argb: 'FFFFFFFF' } };
      receiptsHeaderRow.height = 25;
      const receiptsHeader = worksheet.addRow(['التاريخ', 'المبلغ', 'رقم الإيصال', 'المستخدم']);
      receiptsHeader.font = { bold: true };
      receiptsHeader.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
      summary.receipts.forEach((receipt, index) => {
        const row = worksheet.addRow([
          formatDate(receipt.receipt_date),
          parseFloat(receipt.amount_received.toString()).toFixed(2),
          receipt.receipt_number || `#${receipt.id.slice(-6)}`,
          getUserName(receipt.created_by)
        ]);
        row.eachCell((cell, colNumber) => {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          if (colNumber === 2) {
            cell.numFmt = '#,##0.00';
          }
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
          if (index % 2 === 0) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
          }
        });
      });
      worksheet.addRow([]);
    }
    if (summary.orders.length > 0) {
      const ordersHeaderRow = worksheet.addRow(['الطلبات المقفولة']);
      ordersHeaderRow.font = { size: 14, bold: true };
      ordersHeaderRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6366F1' } };
      ordersHeaderRow.getCell(1).font = { ...ordersHeaderRow.font, color: { argb: 'FFFFFFFF' } };
      ordersHeaderRow.height = 25;
      const ordersHeader = worksheet.addRow(['رقم الطلب', 'العميل', 'المبلغ', 'الرسوم', 'الصافي']);
      ordersHeader.font = { bold: true };
      ordersHeader.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
      summary.orders.forEach((order, index) => {
        const feeMethod = paymentMethods.find(m => m.code === order.payment_method) || paymentMethods[0];
        const totalFee = order.total_price * (feeMethod.percentage_fee / 100) + feeMethod.fixed_fee;
        const net = order.total_price - totalFee;
        const row = worksheet.addRow([
          order.order_number,
          order.customer_name,
          parseFloat(order.total_price.toString()).toFixed(2),
          parseFloat(totalFee.toString()).toFixed(2),
          parseFloat(net.toString()).toFixed(2)
        ]);
        row.eachCell((cell, colNumber) => {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          if (colNumber >= 3) {
            cell.numFmt = '#,##0.00';
          }
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
          if (index % 2 === 0) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
          }
        });
      });
    }
    worksheet.columns = [
      { width: 25 },
      { width: 20 },
      { width: 20 },
      { width: 20 },
      { width: 20 }
    ];
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `${summary.name}_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('تم تصدير Excel بنجاح');
  };
  const handleExportPDF = async () => {
    const previewElement = document.getElementById('payment-method-preview-content');
    if (!previewElement) return;
    try {
      const canvas = await html2canvas(previewElement, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 10;
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight - 20;
      while (heightLeft > 0) {
        position = heightLeft - imgHeight + 10;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight - 20;
      }
      const fileName = `${selectedMethodSummary?.name}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
      toast.success('تم تصدير PDF بنجاح');
    } catch (err) {
      console.error('Error generating PDF:', err);
      toast.error('حدث خطأ أثناء إنشاء ملف PDF');
    }
  };
  // ======================== LOADING STATE ========================
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
  // ======================== DETAIL VIEW ========================
  if (selectedMethodSummary) {
    const { name, totalOriginal, totalRemaining, expectedFees, netDue, totalPaid, orders, receipts, subMethods, logo_url } = selectedMethodSummary;
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <Toaster position="top-center" reverseOrder={false} />
        <div className="flex justify-start mb-6">
          <button onClick={() => setSelectedMethodSummary(null)} className="flex items-center text-blue-600 hover:text-blue-800">
            <ArrowLeft className="h-5 w-5 ml-2" /> رجوع
          </button>
        </div>
        <div className="bg-white rounded-2xl shadow-xl p-8">
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
              {name === 'سلة' && <p className="text-gray-600">يجمع مدى وبطاقات الائتمان</p>}
            </div>
          </div>
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 mb-8 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">ملخص المستحقات (الطلبات المقفولة فقط)</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowPreview(true)}
                  className="bg-gray-600 text-white px-4 py-3 rounded-xl hover:bg-gray-700 flex items-center shadow-md">
                  <Eye className="h-5 w-5 ml-2" />
                  <span>معاينة وتصدير</span>
                </button>
                <button
                  onClick={() => setShowManualPaymentModal(true)}
                  className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-6 py-3 rounded-xl hover:from-emerald-700 hover:to-teal-700 flex items-center shadow-md">
                  <Banknote className="h-5 w-5 ml-2" />
                  <span>تسجيل دفع يدوي</span>
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-lg">
              <div className="space-y-4">
                <div className="flex justify-between"><span>إجمالي الطلبات المقفولة:</span> <strong>{formatCurrency(totalOriginal)}</strong></div>
                <div className="flex justify-between"><span>المستلم:</span> <strong className="text-green-600">−{formatCurrency(totalPaid)}</strong></div>
                <div className="flex justify-between text-xl font-bold pt-3 border-t border-indigo-200">
                  <span className="text-blue-700">إجمالي المستحق:</span>
                  <strong className="text-blue-700">{formatCurrency(totalRemaining)}</strong>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between"><span>الرسوم المتوقعة:</span> <strong className="text-red-600">−{formatCurrency(expectedFees)}</strong></div>
                <div className="flex justify-between text-2xl font-extrabold pt-4 border-t-2 border-indigo-300">
                  <span>الصافي المستحق:</span>
                  <span className="text-emerald-600">{formatCurrency(netDue)}</span>
                </div>
              </div>
            </div>
          </div>
          {/* SubMethods (Mada & Credit Card) */}
          {subMethods && subMethods.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {subMethods.map(sub => {
                const net = sub.totalOriginal - sub.expectedFees;
                return (
                  <div key={sub.code} className="bg-white border rounded-2xl p-5 shadow">
                    <div className="flex items-center mb-3">
                      {sub.code === 'mada' ? <Smartphone className="h-6 w-6 ml-2 text-green-600" /> : <CreditCard className="h-6 w-6 ml-2 text-blue-600" />}
                      <h4 className="font-bold text-lg">{sub.name}</h4>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span>عدد الطلبات:</span> <strong>{sub.orders.length}</strong></div>
                      <div className="flex justify-between"><span>الإجمالي:</span> <strong>{formatCurrency(sub.totalOriginal)}</strong></div>
                      <div className="flex justify-between"><span>الرسوم:</span> <strong className="text-red-600">{formatCurrency(sub.expectedFees)}</strong></div>
                      <div className="flex justify-between font-bold"><span>الصافي:</span> <strong className="text-emerald-600">{formatCurrency(net)}</strong></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {/* الإيصالات */}
          <div className="bg-white border rounded-2xl p-6 mb-8 shadow">
            <h3 className="text-xl font-bold mb-4 flex items-center">
              <Receipt className="h-6 w-6 ml-2 text-blue-600" />
              سجل الدفعات ({receipts.length})
            </h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {receipts.length === 0 ? (
                <p className="text-center text-gray-500 py-8">لا توجد دفعات مسجلة</p>
              ) : (
                receipts.map(r => (
                  <div key={r.id} className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-4 shadow-sm">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-sm">إيصال</span>
                          <span className="font-mono bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
                            {r.receipt_number || `#${r.id.slice(-6)}`}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600">دفع يدوي</p>
                        <p className="text-xs text-gray-500">{formatDate(r.receipt_date)}</p>
                        {r.notes && <p className="text-xs italic text-gray-700 mt-1">"{r.notes}"</p>}
                      </div>
                      <div className="text-right mr-4">
                        <p className="font-bold text-lg text-green-600">{formatCurrency(r.amount_received)}</p>
                        <div className="flex items-center justify-end text-xs text-gray-500 mt-1">
                          <User className="h-3 w-3 ml-1" />
                          <span>{getUserName(r.created_by)}</span>
                        </div>
                      </div>
                      {currentUser?.role === 'admin' && (
                        <button onClick={() => openDeleteConfirm(r)} className="text-red-600 hover:text-red-800 p-2">
                          <Trash2 className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          {/* الطلبات */}
          <div className="bg-white border rounded-2xl p-6 shadow">
            <h3 className="text-xl font-bold mb-4 flex items-center">
              <Package className="h-6 w-6 ml-2 text-indigo-600" />
              الطلبات المقفولة ({orders.length})
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
                        <p className="font-bold">#{o.order_number}</p>
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
        </div>
        {/* Modal تسجيل دفع يدوي */}
        {showManualPaymentModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold">تسجيل دفع يدوي ({name})</h3>
                <button onClick={() => setShowManualPaymentModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-7 w-7" />
                </button>
              </div>
              <form onSubmit={handleManualPayment} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold mb-2">المبلغ المستلم</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      value={manualAmount}
                      onChange={e => setManualAmount(e.target.value)}
                      required
                      className="w-full px-4 py-3 pr-12 border-2 border-gray-300 rounded-xl focus:ring-4 focus:ring-green-500 focus:border-green-500 text-lg"
                      placeholder="0.00"
                    />
                    <span className="absolute left-4 top-1/2 transform -translate-y-1/2 font-bold text-gray-600">ر.س</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">تاريخ الاستلام</label>
                  <input
                    type="date"
                    value={manualDate}
                    onChange={e => setManualDate(e.target.value)}
                    required
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-4 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">ملاحظات (اختياري)</label>
                  <textarea
                    value={manualNotes}
                    onChange={e => setManualNotes(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-4 focus:ring-green-500 focus:border-green-500"
                    placeholder="تحويل بنكي، نقدًا..."
                  />
                </div>
                <div className="flex gap-3 pt-4 border-t">
                  <button type="submit" className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3 rounded-xl font-bold flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 ml-2" /> تسجيل الدفع
                  </button>
                  <button type="button" onClick={() => setShowManualPaymentModal(false)} className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-bold">
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {/* مودال معاينة التقرير */}
        {showPreview && selectedMethodSummary && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[95vh] overflow-y-auto shadow-2xl">
              <div className="sticky top-0 bg-white border-b px-8 py-5 flex justify-between items-center z-10 rounded-t-2xl">
                <h3 className="text-2xl font-bold flex items-center gap-3">
                  <FileText className="h-7 w-7 text-indigo-600" />
                  معاينة تقرير طريقة الدفع
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={handleExportPDF}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2 space-x-reverse"
                  >
                    <Download className="h-4 w-4" />
                    <span>PDF</span>
                  </button>
                  <button
                    onClick={() => handleExportExcel(selectedMethodSummary)}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2 space-x-reverse"
                  >
                    <Download className="h-4 w-4" />
                    <span>Excel</span>
                  </button>
                  <button
                    onClick={() => setShowPreview(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <span className="text-2xl">✕</span>
                  </button>
                </div>
              </div>
              <div className="p-8">
                <div id="payment-method-preview-content" className="bg-white" dir="rtl">
                  <div className="text-center mb-8 border-b pb-6">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                      تقرير طريقة الدفع: {selectedMethodSummary.name}
                    </h1>
                    <p className="text-gray-600">تاريخ التقرير: {formatDate(new Date().toISOString())}</p>
                  </div>
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6 mb-8">
                    <div className="grid grid-cols-2 gap-6 text-center">
                      <div>
                        <p className="text-lg text-gray-700 mb-2">إجمالي المستحق</p>
                        <p className="text-3xl font-bold text-indigo-600">{formatCurrency(selectedMethodSummary.totalRemaining)}</p>
                      </div>
                      <div>
                        <p className="text-lg text-gray-700 mb-2">إجمالي المستلم</p>
                        <p className="text-3xl font-bold text-green-600">{formatCurrency(selectedMethodSummary.totalPaid)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="mb-8 grid grid-cols-3 gap-4">
                    <div className="bg-gray-50 p-4 rounded-lg text-center">
                      <p className="text-sm text-gray-600 mb-1">عدد الطلبات</p>
                      <p className="text-2xl font-bold text-gray-900">{selectedMethodSummary.orderCount}</p>
                    </div>
                    <div className="bg-red-50 p-4 rounded-lg text-center">
                      <p className="text-sm text-gray-600 mb-1">الرسوم المتوقعة</p>
                      <p className="text-2xl font-bold text-red-600">{formatCurrency(selectedMethodSummary.expectedFees)}</p>
                    </div>
                    <div className="bg-emerald-50 p-4 rounded-lg text-center">
                      <p className="text-sm text-gray-600 mb-1">الصافي المستحق</p>
                      <p className="text-2xl font-bold text-emerald-600">{formatCurrency(selectedMethodSummary.netDue)}</p>
                    </div>
                  </div>
                  {selectedMethodSummary.receipts.length > 0 && (
                    <div className="mt-8">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 text-center">
                        <h2 className="text-2xl font-bold text-green-800">سجل الدفعات ({selectedMethodSummary.receipts.length})</h2>
                      </div>
                      <table className="w-full border-collapse mb-8">
                        <thead>
                          <tr className="bg-green-600 text-white">
                            <th className="border border-gray-300 px-4 py-3 text-right">التاريخ</th>
                            <th className="border border-gray-300 px-4 py-3 text-right">المبلغ</th>
                            <th className="border border-gray-300 px-4 py-3 text-right">رقم الإيصال</th>
                            <th className="border border-gray-300 px-4 py-3 text-right">المستخدم</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedMethodSummary.receipts.map((receipt, index) => (
                            <tr key={receipt.id} className={index % 2 === 0 ? 'bg-green-50' : 'bg-white'}>
                              <td className="border border-gray-300 px-4 py-3">{formatDate(receipt.receipt_date)}</td>
                              <td className="border border-gray-300 px-4 py-3 text-right font-bold text-green-700">
                                {formatCurrency(parseFloat(receipt.amount_received.toString()))}
                              </td>
                              <td className="border border-gray-300 px-4 py-3">{receipt.receipt_number || `#${receipt.id.slice(-6)}`}</td>
                              <td className="border border-gray-300 px-4 py-3">{getUserName(receipt.created_by)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {selectedMethodSummary.orders.length > 0 && (
                    <div className="mt-8">
                      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-4 text-center">
                        <h2 className="text-2xl font-bold text-indigo-800">الطلبات المقفولة ({selectedMethodSummary.orders.length})</h2>
                      </div>
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-indigo-600 text-white">
                            <th className="border border-gray-300 px-4 py-3 text-right">رقم الطلب</th>
                            <th className="border border-gray-300 px-4 py-3 text-right">العميل</th>
                            <th className="border border-gray-300 px-4 py-3 text-right">المبلغ</th>
                            <th className="border border-gray-300 px-4 py-3 text-right">الرسوم</th>
                            <th className="border border-gray-300 px-4 py-3 text-right">الصافي</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedMethodSummary.orders.map((order, index) => {
                            const feeMethod = paymentMethods.find(m => m.code === order.payment_method) || paymentMethods[0];
                            const totalFee = order.total_price * (feeMethod.percentage_fee / 100) + feeMethod.fixed_fee;
                            const net = order.total_price - totalFee;
                            return (
                              <tr key={order.id} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                <td className="border border-gray-300 px-4 py-3">{order.order_number}</td>
                                <td className="border border-gray-300 px-4 py-3">{order.customer_name}</td>
                                <td className="border border-gray-300 px-4 py-3 text-right font-medium">
                                  {formatCurrency(order.total_price)}
                                </td>
                                <td className="border border-gray-300 px-4 py-3 text-right font-medium text-red-600">
                                  {formatCurrency(totalFee)}
                                </td>
                                <td className="border border-gray-300 px-4 py-3 text-right font-bold text-emerald-600">
                                  {formatCurrency(net)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
  // ======================== MAIN VIEW ========================
  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-center" reverseOrder={false} />
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <h1 className="text-3xl font-extrabold text-gray-900">المستحقات المالية</h1>
          <p className="text-lg text-gray-600 mt-2">
          للطلبات المقفله فقط
          </p>
        </div>
      </div>
      <div className="p-6 max-w-7xl mx-auto">
        {methodSummaries.length === 0 ? (
          <div className="text-center py-20">
            <Wallet className="h-16 w-16 text-gray-400 mx-auto mb-6" />
            <p className="text-xl text-gray-600">لا توجد بيانات (أو لا توجد طلبات مقفولة)</p>
          </div>
        ) : (
          <>
            <div className="bg-gradient-to-r from-indigo-600 to-blue-500 rounded-2xl shadow-xl p-8 mb-8 text-white">
              <h2 className="text-2xl font-bold mb-6 text-center">الإجمالي الكلي لجميع طرق الدفع</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white/20 backdrop-blur-sm rounded-xl p-6 text-center">
                  <p className="text-lg mb-2 opacity-90">إجمالي المستحق</p>
                  <p className="text-4xl font-extrabold">
                    {formatCurrency(methodSummaries.reduce((sum, s) => sum + s.netDue, 0))}
                  </p>
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-xl p-6 text-center">
                  <p className="text-lg mb-2 opacity-90">إجمالي المستلم</p>
                  <p className="text-4xl font-extrabold">
                    {formatCurrency(methodSummaries.reduce((sum, s) => sum + s.totalPaid, 0))}
                  </p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {methodSummaries.map(s => (
              <div
                key={s.code}
                onClick={() => setSelectedMethodSummary(s)}
                className="bg-white rounded-2xl shadow-lg p-6 cursor-pointer hover:shadow-2xl transition-all hover:-translate-y-2 border-2 border-transparent hover:border-indigo-200"
              >
                <div className="flex items-center mb-5">
                  {s.logo_url ? (
                    <img src={s.logo_url} alt={s.name} className="h-14 w-14 object-contain rounded-xl shadow ml-4" />
                  ) : (
                    <div className="h-14 w-14 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl shadow ml-4 flex items-center justify-center">
                      <Wallet className="h-8 w-8 text-white" />
                    </div>
                  )}
                  <div>
                    <h3 className="text-xl font-extrabold">{s.name}</h3>
                    {s.code === 'salla_basket' && <p className="text-xs text-indigo-600">مدى + بطاقات ائتمانية</p>}
                  </div>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-gray-600">الطلبات المقفولة:</span> <strong>{formatCurrency(s.totalOriginal)}</strong></div>
                  <div className="flex justify-between"><span className="text-gray-600">المستلم:</span> <strong className="text-green-600">−{formatCurrency(s.totalPaid)}</strong></div>
                  <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-200">
                    <span className="text-blue-700">إجمالي المستحق:</span>
                    <span className="text-blue-700">{formatCurrency(s.totalRemaining)}</span>
                  </div>
                  <div className="flex justify-between"><span className="text-gray-600">الرسوم المتوقعة:</span> <strong className="text-red-600">−{formatCurrency(s.expectedFees)}</strong></div>
                  <div className="flex justify-between text-lg font-extrabold pt-4 border-t-2 border-indigo-100">
                    <span>الصافي المستحق:</span>
                    <span className="text-emerald-600">{formatCurrency(s.netDue)}</span>
                  </div>
                </div>
              </div>
            ))}
            </div>
          </>
        )}
      </div>
      {/* تأكيد الحذف */}
      {showDeleteConfirmModal && receiptToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center mb-4 text-red-600">
              <AlertCircle className="h-8 w-8 ml-3" />
              <h3 className="text-xl font-bold">تأكيد الحذف</h3>
            </div>
            <p className="text-gray-700 mb-6">
              هل أنت متأكد من حذف الإيصال بقيمة <strong>{formatCurrency(receiptToDelete.amount_received)}</strong>؟
            </p>
            <div className="flex gap-3">
              <button onClick={confirmDelete} className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700">
                نعم، احذف
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirmModal(false);
                  setReceiptToDelete(null);
                }}
                className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-300"
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