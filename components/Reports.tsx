import React, { useState, useMemo, useEffect, useRef } from 'react';
import { FileText, Download, Calendar, DollarSign, TrendingUp, TrendingDown, Eye, Package, Truck, CreditCard, Tag, Clock, AlertTriangle, XCircle, BarChart3, Loader2 } from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import html2canvas from 'html2canvas'; // Import html2canvas
import { jsPDF } from 'jspdf'; // Import jsPDF
import { supabase } from '../lib/supabase';
import { useOrders } from '../hooks/useOrders';
import { useExpenses } from '../hooks/useExpenses';
import { Order, Product } from '../types/order';
import { Expense } from '../types/expense';
import ReactECharts from 'echarts-for-react';
interface PaymentMethod {
  id: string;
  name: string;
  code: string;
  percentage_fee: number;
  fixed_fee: number;
  is_active: boolean;
}
interface PaymentReceipt {
  id: string;
  payment_method_code: string;
  amount_received: number;
}
interface Receivable {
  id: string;
  entity_id: string;
  remaining_amount: number;
}
interface ShippingCompany {
  id: string;
  company_name: string;
}
interface ShippingPayment {
  id: string;
  company_id: string;
  amount: number;
}
const TAX_RATE = 0.15; // 15% ضريبة القيمة المضافة
// Helper to normalize dates to UTC start of day for consistent comparison
const getUTCCardinalDate = (date: string | Date) => {
  const d = new Date(date);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
};
const Reports: React.FC = () => {
  const { orders, loading: ordersLoading, error: ordersError } = useOrders();
  const { expenses, loading: expensesLoading, error: expensesError } = useExpenses();
  const [dateRange, setDateRange] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [paymentReceipts, setPaymentReceipts] = useState<PaymentReceipt[]>([]);
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [shippingCompanies, setShippingCompanies] = useState<ShippingCompany[]>([]);
  const [shippingPayments, setShippingPayments] = useState<ShippingPayment[]>([]);
  // Ref for the content to be exported to PDF
  const reportRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const lockedOrders = useMemo(() => orders.filter(order => order.is_locked === true), [orders]);
  const unlockedOrders = useMemo(() => orders.filter(order => !order.is_locked && order.status !== 'ملغي'), [orders]);
  const cancelledOrders = useMemo(() => orders.filter(order => order.status === 'ملغي'), [orders]);
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [methodsRes, receiptsRes, receivablesRes, shippingCompRes, shippingPayRes] = await Promise.all([
          supabase.from('payment_methods').select('*').eq('is_active', true).order('name', { ascending: true }),
          supabase.from('payment_receipts').select('id, payment_method_code, amount_received'),
          supabase.from('receivables').select('id, entity_id, remaining_amount'),
          supabase.from('shipping_companies').select('id, company_name'),
          supabase.from('shipping_company_payments').select('id, company_id, amount')
        ]);
        if (methodsRes.error) throw methodsRes.error;
        if (receiptsRes.error) throw receiptsRes.error;
        if (receivablesRes.error) throw receivablesRes.error;
        if (shippingCompRes.error) throw shippingCompRes.error;
        if (shippingPayRes.error) throw shippingPayRes.error;
        setPaymentMethods(methodsRes.data || []);
        setPaymentReceipts(receiptsRes.data || []);
        setReceivables(receivablesRes.data || []);
        setShippingCompanies(shippingCompRes.data || []);
        setShippingPayments(shippingPayRes.data || []);
      } catch (err) {
        console.error('Error fetching data:', err);
      }
    };
    fetchData();
  }, []);
  // فلترة حسب المدة + عدد الأيام
  const { filteredOrders, filteredExpenses, filteredCancelledOrders, daysCount } = useMemo(() => {
    const now = new Date();
    const today = getUTCCardinalDate(now);
    const yesterday = getUTCCardinalDate(now);
    yesterday.setDate(today.getDate() - 1); // Adjust after normalization
    let start: Date = new Date(0); // Epoch for 'all'
    let end: Date = new Date(8640000000000000); // Max possible date for 'all'
    let days = 0;
    if (dateRange === 'today') {
      start = today;
      end = getUTCCardinalDate(today); // Today's date (UTC)
      end.setDate(end.getDate() + 1); // Exclude the next day (end of today)
      days = 1;
    } else if (dateRange === 'yesterday') {
      start = yesterday;
      end = getUTCCardinalDate(today); // Today's date (UTC), acts as end for yesterday
      days = 1;
    } else if (dateRange === 'week') {
      start = getUTCCardinalDate(new Date(now.getTime() - 6 * 86400000)); // 7 days ago including today
      end = getUTCCardinalDate(today); // Today's date (UTC)
      end.setDate(end.getDate() + 1); // Exclude the next day (end of today)
      days = 7;
    } else if (dateRange === 'month') {
      start = getUTCCardinalDate(new Date(now.getFullYear(), now.getMonth(), 1)); // Start of current month (UTC)
      end = getUTCCardinalDate(new Date(now.getFullYear(), now.getMonth() + 1, 1)); // Start of next month (UTC)
      days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(); // Days in current month
    } else if (dateRange === 'custom' && startDate && endDate) {
      start = getUTCCardinalDate(new Date(startDate));
      end = getUTCCardinalDate(new Date(endDate));
      end.setDate(end.getDate() + 1); // Include the end date fully by making end of next day
      days = Math.ceil((end.getTime() - start.getTime()) / 86400000);
    } else { // 'all' range
      days = 9999;
    }
    const filterByDate = (date: string | Date) => {
      const d = getUTCCardinalDate(date);
      return d >= start && d < end;
    };
    return {
      filteredOrders: lockedOrders.filter(o => filterByDate(o.order_date)),
      filteredExpenses: expenses.filter(e => filterByDate(e.date)),
      filteredCancelledOrders: cancelledOrders.filter(o => filterByDate(o.order_date)),
      daysCount: days,
    };
  }, [lockedOrders, expenses, cancelledOrders, dateRange, startDate, endDate]);
  // دالة للحصول على رسوم الدفع
  const getPaymentFee = (paymentMethodCode: string | undefined, totalPrice: number): { fee: number; percentage: number; fixed: number } => {
    if (!paymentMethodCode) return { fee: 0, percentage: 0, fixed: 0 };
    const method = paymentMethods.find(m => m.code === paymentMethodCode);
    if (!method) return { fee: 0, percentage: 0, fixed: 0 };
    const percentageFee = totalPrice * (method.percentage_fee / 100);
    const totalFee = percentageFee + method.fixed_fee;

    return { fee: totalFee, percentage: method.percentage_fee, fixed: method.fixed_fee };
  };
  // دالة لحساب صافي الربح للطلب
  const calculateNetProfit = useMemo(() => (order: Order) => {
    const revenue = order.total_price || 0;
    const productCostInclTax = order.products?.reduce((sum, p) => sum + (p.cost_subtotal || 0), 0) || 0;

    const shipping = order.shipping_cost || 0;
    const shippingWithTax = shipping * (1 + TAX_RATE);
    const shippingDeduction = shippingWithTax;
    const { fee: paymentFee } = getPaymentFee(order.payment_method, revenue);
    const netProfit = revenue - paymentFee - shippingDeduction - productCostInclTax;
    const margin = (order.total_price || 0) > 0 ? (netProfit / (order.total_price || 0)) * 100 : 0;

    const shippingBearer = (order as any).shipping_bearer || 'customer';
    return { netProfit, margin, shippingBearer, productCostInclTax, shippingDeduction, shippingWithTax, paymentFee };
  }, [paymentMethods]); // Dependency on paymentMethods is crucial for getPaymentFee
  // حسابات إجمالية
  const totalNetProfit = useMemo(() => filteredOrders.reduce((sum, order) => sum + calculateNetProfit(order).netProfit, 0), [filteredOrders, calculateNetProfit]);
  const totalMargin = useMemo(() => {
    const totalSales = filteredOrders.reduce((sum, o) => sum + (o.total_price || 0), 0);
    return totalSales > 0 ? (totalNetProfit / totalSales) * 100 : 0;
  }, [filteredOrders, totalNetProfit]);
  const totalPaymentFees = useMemo(() => filteredOrders.reduce((sum, order) => sum + calculateNetProfit(order).paymentFee, 0), [filteredOrders, calculateNetProfit]);
  const totalProductCostsInclTax = useMemo(() => filteredOrders.reduce((sum, order) => sum + calculateNetProfit(order).productCostInclTax, 0), [filteredOrders, calculateNetProfit]);
  const totalShippingDeductions = useMemo(() => filteredOrders.reduce((sum, order) => sum + calculateNetProfit(order).shippingDeduction, 0), [filteredOrders, calculateNetProfit]);
  const totalSalesWithTax = useMemo(() => filteredOrders.reduce((sum, o) => sum + (o.total_price || 0), 0), [filteredOrders]);
  const totalOperationalExpenses = useMemo(() => filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0), [filteredExpenses]);
  const totalAllCosts = useMemo(() => totalProductCostsInclTax + totalShippingDeductions + totalPaymentFees + totalOperationalExpenses, [
    totalProductCostsInclTax, totalShippingDeductions, totalPaymentFees, totalOperationalExpenses
  ]);
  const grossProfit = useMemo(() => {
    return totalSalesWithTax - totalProductCostsInclTax - totalShippingDeductions - totalPaymentFees;
  }, [totalSalesWithTax, totalProductCostsInclTax, totalShippingDeductions, totalPaymentFees]);
  const netProfit = useMemo(() => grossProfit - totalOperationalExpenses, [grossProfit, totalOperationalExpenses]);
  const totalProducts = useMemo(() => filteredOrders.reduce((sum, o) => sum + (o.products?.reduce((s, p) => s + (p.quantity || 0), 0) || 0), 0), [filteredOrders]);
  // إحصائيات الملغيات
  const totalCancelled = filteredCancelledOrders.length;
  const totalCancellationFees = useMemo(() => filteredCancelledOrders.reduce((sum, o) => sum + ((o as any).cancellation_fee || 0), 0), [filteredCancelledOrders]);
  const cancelledByStoreCount = useMemo(() => filteredCancelledOrders.filter((o: any) => o.fee_bearer === 'store').length, [filteredCancelledOrders]);
  const cancelledByCustomerCount = useMemo(() => filteredCancelledOrders.filter((o: any) => o.fee_bearer === 'customer').length, [filteredCancelledOrders]);
  const storeCancellationFees = useMemo(() => filteredCancelledOrders.reduce((sum, o: any) => o.fee_bearer === 'store' ? sum + (o.cancellation_fee || 0) : sum, 0), [filteredCancelledOrders]);
  const customerCancellationFees = useMemo(() => filteredCancelledOrders.reduce((sum, o: any) => o.fee_bearer === 'customer' ? sum + (o.cancellation_fee || 0) : sum, 0), [filteredCancelledOrders]);
  // حسابات جديدة
  const totalSuppliersDue = useMemo(() => receivables.reduce((sum, r) => sum + (r.remaining_amount || 0), 0), [receivables]);
  const totalPaymentMethodsDue = useMemo(() => {
    let basketTotal = 0;
    const basketMethod = paymentMethods.find(m => m.code === 'salla_basket');
    const madaMethod = paymentMethods.find(m => m.code === 'mada');
    const creditMethod = paymentMethods.find(m => m.code === 'credit_card');
    if (basketMethod && (madaMethod || creditMethod)) {
      const madaOrders = lockedOrders.filter(o => o.payment_method === 'mada');
      const creditOrders = lockedOrders.filter(o => o.payment_method === 'credit_card');
      const allBasketOrders = [...madaOrders, ...creditOrders];
      const totalOriginal = allBasketOrders.reduce((s, o) => s + o.total_price, 0);
      const basketReceipts = paymentReceipts.filter(r => r.payment_method_code === 'salla_basket');
      const totalPaid = basketReceipts.reduce((s, r) => s + r.amount_received, 0);
      const totalRemaining = Math.max(0, totalOriginal - totalPaid);
      let expectedFees = 0;
      if (madaMethod && madaOrders.length > 0) {
        const madaTotal = madaOrders.reduce((s, o) => s + o.total_price, 0);
        expectedFees += madaOrders.length * madaMethod.fixed_fee + (madaTotal * madaMethod.percentage_fee) / 100;
      }
      if (creditMethod && creditOrders.length > 0) {
        const creditTotal = creditOrders.reduce((s, o) => s + o.total_price, 0);
        expectedFees += creditOrders.length * creditMethod.fixed_fee + (creditTotal * creditMethod.percentage_fee) / 100;
      }
      basketTotal = Math.max(0, totalRemaining - expectedFees);
    }
    const othersTotal = paymentMethods
      .filter(m => !['mada', 'credit_card', 'salla_basket'].includes(m.code))
      .reduce((sum, method) => {
        const methodOrders = lockedOrders.filter(o => o.payment_method === method.code);
        const totalOriginal = methodOrders.reduce((s, o) => s + o.total_price, 0);
        const methodReceipts = paymentReceipts.filter(r => r.payment_method_code === method.code);
        const totalPaid = methodReceipts.reduce((s, r) => s + r.amount_received, 0);
        const totalRemaining = Math.max(0, totalOriginal - totalPaid);
        const orderCount = methodOrders.length;
        const totalFixed = orderCount * method.fixed_fee;
        const totalPerc = (totalOriginal * method.percentage_fee) / 100;
        const expectedFees = totalFixed + totalPerc;
        const netDue = Math.max(0, totalRemaining - expectedFees);
        return sum + netDue;
      }, 0);
    return basketTotal + othersTotal;
  }, [lockedOrders, paymentMethods, paymentReceipts]);
  const totalShippingCompaniesDue = useMemo(() => {
    return shippingCompanies.reduce((sum, company) => {
      const companyOrders = lockedOrders.filter(o => o.shipping_company === company.company_name);
      const totalShippingCost = companyOrders.reduce((s, o) => s + ((o.shipping_cost || 0) * (1 + TAX_RATE)), 0);
      const companyPayments = shippingPayments.filter(p => p.company_id === company.id);
      const totalPaid = companyPayments.reduce((s, p) => s + (p.amount || 0), 0);
      const due = Math.max(0, totalShippingCost - totalPaid);
      return sum + due;
    }, 0);
  }, [lockedOrders, shippingCompanies, shippingPayments]);
  const isLoading = ordersLoading || expensesLoading;
  const error = ordersError || expensesError;
  // === رسوم بيانية (فقط إذا أكثر من يوم) ===
  const dailyData = useMemo(() => {
    // Determine the actual start and end dates used by the overarching date range filter.
    const now = new Date();
    const today = getUTCCardinalDate(now);
    const yesterday = getUTCCardinalDate(now);
    yesterday.setDate(today.getDate() - 1);

    let chartRenderStart: Date = new Date(0);
    let chartRenderEnd: Date = new Date(8640000000000000);
    if (dateRange === 'today') {
      chartRenderStart = today; chartRenderEnd = getUTCCardinalDate(today); chartRenderEnd.setDate(chartRenderEnd.getDate() + 1);
    } else if (dateRange === 'yesterday') {
      chartRenderStart = yesterday; chartRenderEnd = getUTCCardinalDate(today);
    } else if (dateRange === 'week') {
      chartRenderStart = getUTCCardinalDate(new Date(now.getTime() - 6 * 86400000)); chartRenderEnd = getUTCCardinalDate(today); chartRenderEnd.setDate(chartRenderEnd.getDate() + 1);
    } else if (dateRange === 'month') {
      chartRenderStart = getUTCCardinalDate(new Date(now.getFullYear(), now.getMonth(), 1)); chartRenderEnd = getUTCCardinalDate(new Date(now.getFullYear(), now.getMonth() + 1, 1));
    } else if (dateRange === 'custom' && startDate && endDate) {
      chartRenderStart = getUTCCardinalDate(new Date(startDate)); chartRenderEnd = getUTCCardinalDate(new Date(endDate)); chartRenderEnd.setDate(chartRenderEnd.getDate() + 1);
    } else { // 'all' dateRange
      const allDates = [...orders.map(o => getUTCCardinalDate(o.order_date)), ...expenses.map(e => getUTCCardinalDate(e.date))];

      if (allDates.length > 0) {
        const minTimestamp = Math.min(...allDates.map(d => d.getTime()));
        const maxTimestamp = Math.max(...allDates.map(d => d.getTime()));
        chartRenderStart = new Date(minTimestamp);
        chartRenderEnd = new Date(maxTimestamp);
        chartRenderEnd.setDate(chartRenderEnd.getDate() + 1); // Ensure full day
      } else {
        return []; // No data at all
      }
    }
    // Only proceed to generate chart data if daysCount is more than 1
    // (single-point charts usually don't make sense as line charts).
    // Or if there is data at all if for instance a custom single day range is picked.
    if (daysCount <= 1 && dateRange !== 'custom') { // Allow custom 1-day range to potentially show 1 point, but for preset only if > 1 day.
      // If it's a single custom day, let the logic below process it if data exists.
    }
    const map = new Map<string, any>();
    const addToMap = (dateKey: string, key: string, value: number) => {
      if (!map.has(dateKey)) {
        map.set(dateKey, { date: dateKey, locked: 0, unlocked: 0, sales: 0, costs: 0, profit: 0, orders: 0 });
      }
      const entry = map.get(dateKey)!;
      entry[key] += value;
      if (key === 'locked' || key === 'unlocked') entry.orders += 1;
    };
    const filterForChartRendering = (orderDate: string | Date) => {
      const d = getUTCCardinalDate(orderDate);
      return d >= getUTCCardinalDate(chartRenderStart) && d < getUTCCardinalDate(chartRenderEnd);
    };
    orders.forEach(o => { // Process ALL orders that fall into the `chartRenderStart` and `chartRenderEnd` range.
      if (filterForChartRendering(o.order_date)) {
        const date = new Date(o.order_date).toLocaleDateString('en-GB');
        if (o.is_locked === true) {
          const { netProfit: orderProfit, paymentFee, productCostInclTax, shippingDeduction } = calculateNetProfit(o);
          const totalSales = o.total_price || 0;
          const orderCosts = productCostInclTax + shippingDeduction + paymentFee;
          addToMap(date, 'locked', 1);
          addToMap(date, 'sales', totalSales);
          addToMap(date, 'costs', orderCosts);
          addToMap(date, 'profit', orderProfit);
        } else if (o.status !== 'ملغي') { // unlocked orders
          addToMap(date, 'unlocked', 1);
        }
      }
    });
    // Populate all days between chartRenderStart and chartRenderEnd to ensure continuous chart line.
    let iterDate = getUTCCardinalDate(chartRenderStart);
    const finalChartRenderEnd = getUTCCardinalDate(chartRenderEnd); // Normalize end date once
    while (iterDate < finalChartRenderEnd) {
      const dateStr = iterDate.toLocaleDateString('en-GB');
      if (!map.has(dateStr)) {
        map.set(dateStr, { date: dateStr, locked: 0, unlocked: 0, sales: 0, costs: 0, profit: 0, orders: 0 });
      }
      iterDate.setDate(iterDate.getDate() + 1);
    }

    // Convert map values to array and sort by date
    const finalDailyData = Array.from(map.values()).sort((a, b) => {
      const [d1, m1, y1] = a.date.split('/').map(Number);
      const [d2, m2, y2] = b.date.split('/').map(Number);
      return new Date(y1, m1 - 1, d1).getTime() - new Date(y2, m2 - 1, d2).getTime();
    });
    // If after all processing, there's no data or only a single day for line charts, return empty
    if (finalDailyData.length <= 1 && daysCount !== 9999) { // Don't filter "all" just because it might be sparse.
      return [];
    }
    return finalDailyData;
  }, [
    orders, // All orders for raw data and for 'all' date range detection
    expenses, // All expenses for 'all' date range detection (if any)
    dateRange,
    startDate,
    endDate,
    daysCount, // Affects when charts are rendered
    calculateNetProfit // Function dependency
  ]);
  const chartOptions = (title: string, dataKey: string, color: string) => ({
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: dailyData.map(d => d.date) },
    yAxis: { type: 'value' },
    series: [{ name: title, type: 'line', smooth: true, itemStyle: { color }, data: dailyData.map(d => d[dataKey]) }],
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
  });
  const exportComprehensiveData = async () => {
    setIsExporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      const now = new Date();
      const reportDate = now.toLocaleString('en-US', {
        timeZone: 'Asia/Riyadh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
      const today = now.toISOString().split('T')[0];

      // === 1. التقرير العام الشامل ===
      const summarySheet = workbook.addWorksheet('التقرير العام', { views: [{ rightToLeft: true }] });

      // عنوان التقرير
      summarySheet.mergeCells('A1:B1');
      const titleCell = summarySheet.getCell('A1');
      titleCell.value = 'التقرير المالي الشامل';
      titleCell.font = { size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
      summarySheet.getRow(1).height = 30;

      // تاريخ إنشاء التقرير
      summarySheet.mergeCells('A2:B2');
      const dateCell = summarySheet.getCell('A2');
      dateCell.value = `تاريخ إنشاء التقرير: ${reportDate}`;
      dateCell.font = { size: 12, bold: true };
      dateCell.alignment = { horizontal: 'center' };
      dateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7E7E7' } };

      summarySheet.addRow([]);

      // قسم المبيعات
      summarySheet.addRow(['📊 المبيعات والطلبات', '']).font = { bold: true, size: 14, color: { argb: 'FF1E40AF' } };
      summarySheet.addRow(['عدد الطلبات المقفلة', lockedOrders.length]);
      summarySheet.addRow(['عدد الطلبات المفتوحة', unlockedOrders.length]);
      summarySheet.addRow(['عدد الطلبات الملغاة', cancelledOrders.length]);
      summarySheet.addRow(['إجمالي المبيعات (شامل الضريبة)', `${totalSalesWithTax.toFixed(2)} ر.س`]);
      summarySheet.addRow(['إجمالي المنتجات المباعة', totalProducts]);

      summarySheet.addRow([]);

      // قسم الأرباح والتكاليف
      summarySheet.addRow(['💰 الأرباح والتكاليف', '']).font = { bold: true, size: 14, color: { argb: 'FF2E7D32' } };
      summarySheet.addRow(['الربح الإجمالي', `${grossProfit.toFixed(2)} ر.س`]);
      summarySheet.addRow(['صافي الربح', `${netProfit.toFixed(2)} ر.س`]);
      summarySheet.addRow(['هامش الربح', `${totalMargin.toFixed(2)}%`]);
      summarySheet.addRow(['إجمالي تكاليف المنتجات', `${totalProductCostsInclTax.toFixed(2)} ر.س`]);
      summarySheet.addRow(['إجمالي تكاليف الشحن', `${totalShippingDeductions.toFixed(2)} ر.س`]);
      summarySheet.addRow(['إجمالي رسوم الدفع', `${totalPaymentFees.toFixed(2)} ر.س`]);
      summarySheet.addRow(['إجمالي المصروفات التشغيلية', `${totalOperationalExpenses.toFixed(2)} ر.س`]);

      summarySheet.addRow([]);

      // قسم المستحقات
      summarySheet.addRow(['📋 المستحقات', '']).font = { bold: true, size: 14, color: { argb: 'FFFF9800' } };
      summarySheet.addRow(['المستحق للموردين', `${totalSuppliersDue.toFixed(2)} ر.س`]);
      summarySheet.addRow(['المستحق لطرق الدفع', `${totalPaymentMethodsDue.toFixed(2)} ر.س`]);
      summarySheet.addRow(['المستحق لشركات الشحن', `${totalShippingCompaniesDue.toFixed(2)} ر.س`]);

      summarySheet.addRow([]);

      // قسم الإلغاءات
      summarySheet.addRow(['❌ الطلبات الملغاة', '']).font = { bold: true, size: 14, color: { argb: 'FFE74C3C' } };
      summarySheet.addRow(['إجمالي رسوم الإلغاء', `${totalCancellationFees.toFixed(2)} ر.س`]);
      summarySheet.addRow(['رسوم الإلغاء على المتجر', `${storeCancellationFees.toFixed(2)} ر.س`]);
      summarySheet.addRow(['رسوم الإلغاء على العميل', `${customerCancellationFees.toFixed(2)} ر.س`]);
      summarySheet.addRow(['الملغيات على المتجر', cancelledByStoreCount]);
      summarySheet.addRow(['الملغيات على العميل', cancelledByCustomerCount]);

      summarySheet.addRow([]);

      // قسم أرصدة الموظفين (سيتم حسابه لاحقاً)
      summarySheet.addRow(['👥 أرصدة الموظفين', '']).font = { bold: true, size: 14, color: { argb: 'FF9966FF' } };
      const employeeBalancePlaceholder = summarySheet.addRow(['إجمالي أرصدة الموظفين', 'سيتم الحساب...']);

      summarySheet.columns = [{ width: 35 }, { width: 25 }];
      summarySheet.eachRow((row, rowNumber) => {
        if (rowNumber > 2) {
          row.getCell(1).font = { bold: true };
          row.getCell(2).alignment = { horizontal: 'left' };
        }
      });

      // === 2. الطلبات المقفلة ===
      const lockedSheet = workbook.addWorksheet('الطلبات المقفلة', { views: [{ rightToLeft: true }] });
      lockedSheet.columns = [
        { header: 'رقم الطلب', key: 'order_number', width: 15 },
        { header: 'العميل', key: 'customer_name', width: 25 },
        { header: 'الهاتف', key: 'phone_number', width: 15 },
        { header: 'الإجمالي', key: 'total_price', width: 12 },
        { header: 'طريقة الدفع', key: 'payment_method', width: 20 },
        { header: 'شركة الشحن', key: 'shipping_company', width: 15 },
        { header: 'تكلفة الشحن', key: 'shipping_cost', width: 12 },
        { header: 'التاريخ', key: 'order_date', width: 15 },
        { header: 'صافي الربح', key: 'net_profit', width: 12 }
      ];
      lockedSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      lockedSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
      lockedOrders.forEach(order => {
        const { netProfit } = calculateNetProfit(order);
        lockedSheet.addRow({
          order_number: order.order_number,
          customer_name: order.customer_name,
          phone_number: order.phone_number,
          total_price: order.total_price,
          payment_method: order.payment_method,
          shipping_company: order.shipping_company,
          shipping_cost: order.shipping_cost,
          order_date: new Date(order.order_date).toLocaleDateString('en-US'),
          net_profit: netProfit.toFixed(2)
        });
      });

      // === 3. الطلبات المفتوحة ===
      const unlockedSheet = workbook.addWorksheet('الطلبات المفتوحة', { views: [{ rightToLeft: true }] });
      unlockedSheet.columns = [
        { header: 'رقم الطلب', key: 'order_number', width: 15 },
        { header: 'العميل', key: 'customer_name', width: 25 },
        { header: 'الهاتف', key: 'phone_number', width: 15 },
        { header: 'الإجمالي', key: 'total_price', width: 12 },
        { header: 'الحالة', key: 'status', width: 15 },
        { header: 'التاريخ', key: 'order_date', width: 15 }
      ];
      unlockedSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      unlockedSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC000' } };
      unlockedOrders.forEach(order => {
        unlockedSheet.addRow({
          order_number: order.order_number,
          customer_name: order.customer_name,
          phone_number: order.phone_number,
          total_price: order.total_price,
          status: order.status,
          order_date: new Date(order.order_date).toLocaleDateString('en-US')
        });
      });

      // === 4. المصروفات ===
      const expensesSheet = workbook.addWorksheet('المصروفات', { views: [{ rightToLeft: true }] });
      expensesSheet.columns = [
        { header: 'الوصف', key: 'description', width: 30 },
        { header: 'المبلغ', key: 'amount', width: 12 },
        { header: 'الفئة', key: 'category', width: 20 },
        { header: 'التاريخ', key: 'date', width: 15 },
        { header: 'ملاحظات', key: 'notes', width: 30 }
      ];
      expensesSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      expensesSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFED7D31' } };
      expenses.forEach(expense => {
        expensesSheet.addRow({
          description: expense.description,
          amount: expense.amount,
          category: expense.category,
          date: new Date(expense.date).toLocaleDateString('en-US'),
          notes: expense.notes || ''
        });
      });

      // === 5. المخزون ===
      const { data: inventory } = await supabase.from('inventory').select('*');
      const inventorySheet = workbook.addWorksheet('المخزون', { views: [{ rightToLeft: true }] });
      inventorySheet.columns = [
        { header: 'اسم المنتج', key: 'product_name', width: 30 },
        { header: 'سعر التكلفة', key: 'cost_price', width: 12 },
        { header: 'الكمية', key: 'quantity', width: 10 },
        { header: 'القيمة الإجمالية', key: 'total_value', width: 15 },
        { header: 'تاريخ الشراء', key: 'purchase_date', width: 15 },
        { header: 'ملاحظات', key: 'notes', width: 30 }
      ];
      inventorySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      inventorySheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF70AD47' } };
      let totalInventoryValue = 0;
      inventory?.forEach(item => {
        const totalValue = (item.cost_price || 0) * (item.quantity || 0);
        totalInventoryValue += totalValue;
        inventorySheet.addRow({
          product_name: item.product_name,
          cost_price: item.cost_price,
          quantity: item.quantity,
          total_value: totalValue.toFixed(2),
          purchase_date: item.purchase_date ? new Date(item.purchase_date).toLocaleDateString('en-US') : '',
          notes: item.notes || ''
        });
      });
      // إضافة صف الإجمالي
      const invTotalRow = inventorySheet.addRow({
        product_name: 'الإجمالي',
        cost_price: '',
        quantity: inventory?.reduce((sum, i) => sum + (i.quantity || 0), 0) || 0,
        total_value: totalInventoryValue.toFixed(2),
        purchase_date: '',
        notes: ''
      });
      invTotalRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      invTotalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF70AD47' } };

      // === 6. الطلبات الملغاة ===
      const cancelledSheet = workbook.addWorksheet('الطلبات الملغاة', { views: [{ rightToLeft: true }] });
      cancelledSheet.columns = [
        { header: 'رقم الطلب', key: 'order_number', width: 15 },
        { header: 'العميل', key: 'customer_name', width: 25 },
        { header: 'الإجمالي', key: 'total_price', width: 12 },
        { header: 'سبب الإلغاء', key: 'cancellation_reason', width: 30 },
        { header: 'رسوم الإلغاء', key: 'cancellation_fee', width: 12 },
        { header: 'من يتحمل', key: 'fee_bearer', width: 12 },
        { header: 'ملغي بواسطة', key: 'cancelled_by', width: 20 },
        { header: 'التاريخ', key: 'order_date', width: 15 }
      ];
      cancelledSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cancelledSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
      cancelledOrders.forEach(order => {
        cancelledSheet.addRow({
          order_number: order.order_number,
          customer_name: order.customer_name,
          total_price: order.total_price,
          cancellation_reason: order.cancellation_reason || '',
          cancellation_fee: order.cancellation_fee || 0,
          fee_bearer: order.fee_bearer === 'store' ? 'المتجر' : 'العميل',
          cancelled_by: order.cancelled_by || '',
          order_date: new Date(order.order_date).toLocaleDateString('en-US')
        });
      });

      // === 7. طرق الدفع والمستحقات ===
      const paymentMethodsSheet = workbook.addWorksheet('طرق الدفع', { views: [{ rightToLeft: true }] });
      paymentMethodsSheet.columns = [
        { header: 'الطريقة', key: 'name', width: 25 },
        { header: 'الكود', key: 'code', width: 20 },
        { header: 'نسبة الرسوم %', key: 'percentage_fee', width: 15 },
        { header: 'رسوم ثابتة', key: 'fixed_fee', width: 12 },
        { header: 'عدد الطلبات', key: 'order_count', width: 12 },
        { header: 'إجمالي المبالغ', key: 'total_amount', width: 15 },
        { header: 'إجمالي المدفوع', key: 'total_paid', width: 15 },
        { header: 'المتبقي', key: 'remaining', width: 15 }
      ];
      paymentMethodsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      paymentMethodsSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5B9BD5' } };
      paymentMethods.forEach(method => {
        const methodOrders = lockedOrders.filter(o => o.payment_method === method.code);
        const totalAmount = methodOrders.reduce((sum, o) => sum + o.total_price, 0);
        const methodReceipts = paymentReceipts.filter(r => r.payment_method_code === method.code);
        const totalPaid = methodReceipts.reduce((sum, r) => sum + r.amount_received, 0);
        const remaining = totalAmount - totalPaid;

        paymentMethodsSheet.addRow({
          name: method.name,
          code: method.code,
          percentage_fee: method.percentage_fee,
          fixed_fee: method.fixed_fee,
          order_count: methodOrders.length,
          total_amount: totalAmount.toFixed(2),
          total_paid: totalPaid.toFixed(2),
          remaining: remaining.toFixed(2)
        });
      });

      // === 8. الموردين والمستحقات ===
      const { data: entities } = await supabase.from('entities').select('*').eq('type', 'مورد');
      const { data: allReceivables } = await supabase.from('receivables').select('*');
      const { data: allPayments } = await supabase.from('payments').select('*');

      const suppliersSheet = workbook.addWorksheet('الموردين', { views: [{ rightToLeft: true }] });
      suppliersSheet.columns = [
        { header: 'اسم المورد', key: 'name', width: 30 },
        { header: 'الهاتف', key: 'phone', width: 15 },
        { header: 'البريد الإلكتروني', key: 'email', width: 25 },
        { header: 'العنوان', key: 'address', width: 30 },
        { header: 'إجمالي المستحقات', key: 'total_receivables', width: 18 },
        { header: 'إجمالي المدفوعات', key: 'total_payments', width: 18 },
        { header: 'المتبقي', key: 'remaining', width: 15 }
      ];
      suppliersSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      suppliersSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA5A5A5' } };
      entities?.forEach(entity => {
        const entityReceivables = allReceivables?.filter(r => r.entity_id === entity.id) || [];
        const totalReceivables = entityReceivables.reduce((sum, r) => sum + (r.total_amount || 0), 0);
        const totalRemaining = entityReceivables.reduce((sum, r) => sum + (r.remaining_amount || 0), 0);
        const totalPaid = totalReceivables - totalRemaining;

        suppliersSheet.addRow({
          name: entity.name,
          phone: entity.contact_info?.phone || '',
          email: entity.contact_info?.email || '',
          address: entity.contact_info?.address || '',
          total_receivables: totalReceivables.toFixed(2),
          total_payments: totalPaid.toFixed(2),
          remaining: totalRemaining.toFixed(2)
        });
      });

      // === 9. مستحقات الموردين المفصلة ===
      const receivablesDetailSheet = workbook.addWorksheet('مستحقات الموردين المفصلة', { views: [{ rightToLeft: true }] });
      receivablesDetailSheet.columns = [
        { header: 'المورد', key: 'supplier_name', width: 30 },
        { header: 'الوصف', key: 'description', width: 35 },
        { header: 'المبلغ الإجمالي', key: 'total_amount', width: 15 },
        { header: 'المبلغ المتبقي', key: 'remaining_amount', width: 15 },
        { header: 'تاريخ الإنشاء', key: 'created_at', width: 15 },
        { header: 'تاريخ الاستحقاق', key: 'due_date', width: 15 },
        { header: 'ملاحظات', key: 'notes', width: 30 }
      ];
      receivablesDetailSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      receivablesDetailSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF9800' } };
      for (const receivable of allReceivables || []) {
        const entity = entities?.find(e => e.id === receivable.entity_id);
        receivablesDetailSheet.addRow({
          supplier_name: entity?.name || 'غير معروف',
          description: receivable.description,
          total_amount: receivable.total_amount,
          remaining_amount: receivable.remaining_amount,
          created_at: receivable.created_at ? new Date(receivable.created_at).toLocaleDateString('en-US') : '',
          due_date: receivable.due_date ? new Date(receivable.due_date).toLocaleDateString('en-US') : '',
          notes: receivable.notes || ''
        });
      }

      // === 10. مدفوعات الموردين ===
      const paymentsSheet = workbook.addWorksheet('مدفوعات الموردين', { views: [{ rightToLeft: true }] });
      paymentsSheet.columns = [
        { header: 'المورد', key: 'supplier_name', width: 30 },
        { header: 'المبلغ', key: 'amount', width: 12 },
        { header: 'تاريخ الدفع', key: 'payment_date', width: 15 },
        { header: 'رقم الإيصال', key: 'receipt_number', width: 15 },
        { header: 'ملاحظات', key: 'notes', width: 30 }
      ];
      paymentsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      paymentsSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF92D050' } };
      for (const payment of allPayments || []) {
        const receivable = allReceivables?.find(r => r.id === payment.receivable_id);
        const entity = entities?.find(e => e.id === receivable?.entity_id);
        paymentsSheet.addRow({
          supplier_name: entity?.name || 'غير معروف',
          amount: payment.amount,
          payment_date: payment.payment_date ? new Date(payment.payment_date).toLocaleDateString('en-US') : '',
          receipt_number: payment.receipt_number || '',
          notes: payment.notes || ''
        });
      }

      // === 11. شركات الشحن ===
      const shippingSheet = workbook.addWorksheet('شركات الشحن', { views: [{ rightToLeft: true }] });
      shippingSheet.columns = [
        { header: 'اسم الشركة', key: 'company_name', width: 25 },
        { header: 'الشخص المسؤول', key: 'contact_person', width: 25 },
        { header: 'الهاتف', key: 'phone_number', width: 15 },
        { header: 'البريد الإلكتروني', key: 'email', width: 25 },
        { header: 'العنوان', key: 'address', width: 30 },
        { header: 'عدد الطلبات', key: 'order_count', width: 12 },
        { header: 'إجمالي التكاليف', key: 'total_cost', width: 15 },
        { header: 'إجمالي المدفوع', key: 'total_paid', width: 15 },
        { header: 'المتبقي', key: 'remaining', width: 15 }
      ];
      shippingSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      shippingSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC000' } };
      const { data: allShippingCompanies } = await supabase.from('shipping_companies').select('*');
      allShippingCompanies?.forEach((company: any) => {
        const companyOrders = lockedOrders.filter(o => o.shipping_company === company.company_name);
        const totalCost = companyOrders.reduce((sum, o) => sum + ((o.shipping_cost || 0) * (1 + TAX_RATE)), 0);
        const companyPayments = shippingPayments.filter(p => p.company_id === company.id);
        const totalPaid = companyPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
        const remaining = totalCost - totalPaid;

        shippingSheet.addRow({
          company_name: company.company_name,
          contact_person: company.contact_person || '',
          phone_number: company.phone_number || '',
          email: company.email || '',
          address: company.address || '',
          order_count: companyOrders.length,
          total_cost: totalCost.toFixed(2),
          total_paid: totalPaid.toFixed(2),
          remaining: remaining.toFixed(2)
        });
      });



      // === 12. أرصدة الموظفين ===
      // جلب جميع الموظفين النشطين
      const { data: allUsers, error: usersError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('role', 'user')
        .eq('is_active', true)
        .order('full_name');

      if (usersError) {
        console.error('Error fetching users:', usersError);
      }

      // جلب جميع معاملات العهد
      const { data: employeeBalances, error: employeeError } = await supabase
        .from('employee_balance_transactions')
        .select(`
          *,
          user:user_profiles!employee_balance_transactions_user_id_fkey(full_name),
          created_by_user:user_profiles!employee_balance_transactions_created_by_fkey(full_name)
        `)
        .order('transaction_date', { ascending: false });

      if (employeeError) {
        console.error('Error fetching employee balances:', employeeError);
      }
      console.log('Employee balances fetched:', employeeBalances?.length || 0, 'records');

      // حساب الرصيد الحالي لكل موظف
      const employeeBalanceMap = new Map<string, { name: string; balance: number; transactionCount: number }>();

      allUsers?.forEach((user: any) => {
        employeeBalanceMap.set(user.id, {
          name: user.full_name,
          balance: 0,
          transactionCount: 0
        });
      });

      employeeBalances?.forEach((transaction: any) => {
        const emp = employeeBalanceMap.get(transaction.user_id);
        if (emp) {
          emp.balance += parseFloat(transaction.amount.toString());
          emp.transactionCount += 1;
        }
      });

      // صفحة ملخص أرصدة الموظفين
      const employeeSummarySheet = workbook.addWorksheet('ملخص أرصدة الموظفين', { views: [{ rightToLeft: true }] });
      employeeSummarySheet.columns = [
        { header: 'الموظف', key: 'employee_name', width: 30 },
        { header: 'الرصيد الحالي', key: 'current_balance', width: 15 },
        { header: 'عدد العمليات', key: 'transaction_count', width: 15 }
      ];
      employeeSummarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      employeeSummarySheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF9966FF' } };

      let totalEmployeeBalance = 0;
      employeeBalanceMap.forEach((emp) => {
        totalEmployeeBalance += emp.balance;
        employeeSummarySheet.addRow({
          employee_name: emp.name,
          current_balance: emp.balance.toFixed(2),
          transaction_count: emp.transactionCount
        });
      });

      // إضافة صف الإجمالي
      const empTotalRow = employeeSummarySheet.addRow({
        employee_name: 'الإجمالي',
        current_balance: totalEmployeeBalance.toFixed(2),
        transaction_count: employeeBalances?.length || 0
      });
      empTotalRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      empTotalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF9966FF' } };

      // تحديث القيمة في التقرير العام
      employeeBalancePlaceholder.getCell(2).value = `${totalEmployeeBalance.toFixed(2)} ر.س`;

      // صفحة سجل معاملات العهد
      const employeeSheet = workbook.addWorksheet('سجل معاملات العهد', { views: [{ rightToLeft: true }] });
      employeeSheet.columns = [
        { header: 'الموظف', key: 'employee_name', width: 25 },
        { header: 'المبلغ', key: 'amount', width: 12 },
        { header: 'النوع', key: 'type', width: 15 },
        { header: 'السبب', key: 'reason', width: 30 },
        { header: 'التاريخ', key: 'transaction_date', width: 15 },
        { header: 'تم الإنشاء بواسطة', key: 'created_by', width: 20 }
      ];
      employeeSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      employeeSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF9966FF' } };

      if (employeeBalances && employeeBalances.length > 0) {
        employeeBalances.forEach((transaction: any) => {
          employeeSheet.addRow({
            employee_name: transaction.user?.full_name || 'غير معروف',
            amount: transaction.amount,
            type: transaction.type === 'credit' ? 'صرف عهده' : 'تسوية عهده',
            reason: transaction.reason || '',
            transaction_date: new Date(transaction.transaction_date).toLocaleDateString('en-US'),
            created_by: transaction.created_by_user?.full_name || 'النظام'
          });
        });
      } else {
        // إضافة صف يوضح عدم وجود بيانات
        employeeSheet.addRow({
          employee_name: 'لا توجد بيانات',
          amount: '',
          type: '',
          reason: '',
          transaction_date: '',
          created_by: ''
        });
      }


      // === 13. إيصالات الدفع ===
      const receiptsSheet = workbook.addWorksheet('إيصالات الدفع', { views: [{ rightToLeft: true }] });
      receiptsSheet.columns = [
        { header: 'رقم الإيصال', key: 'receipt_number', width: 15 },
        { header: 'طريقة الدفع', key: 'payment_method', width: 20 },
        { header: 'المبلغ المستلم', key: 'amount_received', width: 15 },
        { header: 'تاريخ الاستلام', key: 'received_date', width: 15 },
        { header: 'ملاحظات', key: 'notes', width: 30 }
      ];
      receiptsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      receiptsSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00BCD4' } };

      const { data: allReceipts, error: receiptsError } = await supabase.from('payment_receipts').select('*');

      if (receiptsError) {
        console.error('Error fetching payment receipts:', receiptsError);
      }
      console.log('Payment receipts fetched:', allReceipts?.length || 0, 'records');

      if (allReceipts && allReceipts.length > 0) {
        allReceipts.forEach((receipt: any) => {
          const method = paymentMethods.find(m => m.code === receipt.payment_method_code);
          receiptsSheet.addRow({
            receipt_number: receipt.receipt_number || '',
            payment_method: method?.name || receipt.payment_method_code,
            amount_received: receipt.amount_received,
            received_date: receipt.received_date ? new Date(receipt.received_date).toLocaleDateString('en-US') : '',
            notes: receipt.notes || ''
          });
        });
      } else {
        // إضافة صف يوضح عدم وجود بيانات
        receiptsSheet.addRow({
          receipt_number: 'لا توجد بيانات',
          payment_method: '',
          amount_received: '',
          received_date: '',
          notes: ''
        });
      }

      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `تقرير_شامل_${today}.xlsx`);
      alert('تم تصدير التقرير الشامل بنجاح!');
    } catch (error) {
      console.error('Error exporting comprehensive data:', error);
      alert('حدث خطأ أثناء التصدير');
    } finally {
      setIsExporting(false);
    }
  };
  // === تصدير Excel ===
  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'تقرير المبيعات';
    workbook.lastModifiedBy = 'Report System';
    workbook.created = new Date();
    workbook.modified = new Date();
    // Worksheets are RTL by default due to `views` setting
    const worksheet = workbook.addWorksheet('تقرير المبيعات', {
      properties: { defaultColWidth: 22 },
      views: [{ rightToLeft: true }],
    });
    // Main Title
    worksheet.mergeCells('A1:J1'); // Adjusted for removed columns
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'تقرير المبيعات والتكاليف';
    titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 35;
    worksheet.addRow([]); // Empty row for spacing
    // General Statistics Section
    worksheet.mergeCells('A3:B3');
    worksheet.getCell('A3').value = 'الإحصائيات العامة';
    worksheet.getCell('A3').font = { name: 'Arial', bold: true, size: 14 };
    worksheet.getCell('A3').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDDDDD' } };
    const stats = [
      ['عدد الطلبات المقفلة', filteredOrders.length],
      ['عدد الطلبات الملغاة', totalCancelled],
      ['إجمالي المبيعات شامل الضريبة', `${totalSalesWithTax.toFixed(2)} ر.س`],
      ['إجمالي رسوم الدفع (شاملة الضريبة)', `${totalPaymentFees.toFixed(2)} ر.س`],
      ['إجمالي تكاليف المنتجات (شاملة الضريبة)', `${totalProductCostsInclTax.toFixed(2)} ر.س`],
      ['إجمالي خصم الشحن مع الضريبة 15%', `${totalShippingDeductions.toFixed(2)} ر.س`],
      ['إجمالي المصروفات التشغيلية', `${totalOperationalExpenses.toFixed(2)} ر.س`],
      ['إجمالي التكاليف الكلي', `${totalAllCosts.toFixed(2)} ر.س`],
      ['الربح الإجمالي', `${grossProfit.toFixed(2)} ر.س`],
      ['صافي الربح', `${totalNetProfit.toFixed(2)} ر.س`],
      ['هامش الربح (%)', `${totalMargin.toFixed(2)}%`],
      ['إجمالي المنتجات', totalProducts],
      ['رسوم الإلغاء الإجمالية', `${totalCancellationFees.toFixed(2)} ر.س`],
      ['رسوم الإلغاء على المتجر', `${storeCancellationFees.toFixed(2)} ر.س`],
      ['رسوم الإلغاء على العميل', `${customerCancellationFees.toFixed(2)} ر.س`],
      ['الملغيات على المتجر', cancelledByStoreCount],
      ['الملغيات على العميل', cancelledByCustomerCount],
    ];
    stats.forEach(([label, value]) => {
      const row = worksheet.addRow([label, value]);
      row.getCell(1).font = { bold: true };
      row.getCell(2).alignment = { horizontal: 'left' };
      row.getCell(2).numFmt = typeof value === 'number' ? '#,##0.00_);[Red](#,##0.00)' : '@'; // Number format
    });
    worksheet.addRow([]); // Empty row for spacing
    worksheet.addRow([]); // Empty row for spacing
    // Orders Table Headers
    const headers = ['رقم الطلب', 'العميل', 'التاريخ', 'عدد المنتجات', 'التكلفة (شاملة الضريبة)', 'رسوم الدفع (شاملة الضريبة)', 'خصم الشحن مع الضريبة', 'المبيعات شامل الضريبة', 'صافي الربح'];
    const headerRow = worksheet.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' },
      };
    });
    // Orders Data
    filteredOrders.forEach((order, index) => {
      const { netProfit: orderProfit, paymentFee, productCostInclTax, shippingDeduction } = calculateNetProfit(order);
      const totalSales = order.total_price || 0;
      const row = worksheet.addRow([
        order.order_number,
        order.customer_name,
        new Date(order.order_date).toLocaleDateString('en-GB'),
        order.products?.length || 0,
        productCostInclTax.toFixed(2),
        paymentFee.toFixed(2),
        shippingDeduction.toFixed(2),
        totalSales.toFixed(2),
        orderProfit.toFixed(2),
      ]);
      row.eachCell((cell, colNumber) => {
        if (colNumber >= 5 && colNumber <= 9) { // Adjusted for monetary values
          cell.numFmt = '#,##0.00_);[Red](#,##0.00)'; // Financial number format
        } else if (colNumber === 4) { // Products count
          cell.numFmt = '0';
        }
        cell.alignment = { horizontal: 'center' };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        if (index % 2 === 1) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
        }
      });
    });
    // Orders Totals Row
    const totalRow = worksheet.addRow([
      'الإجمالي', '', '', totalProducts,
      totalProductCostsInclTax.toFixed(2), totalPaymentFees.toFixed(2), totalShippingDeductions.toFixed(2),
      totalSalesWithTax.toFixed(2), totalNetProfit.toFixed(2),
    ]);
    totalRow.eachCell((cell, colNumber) => {
      cell.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E7D32' } };
      cell.alignment = { horizontal: 'center' };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      if (colNumber >= 5 && colNumber <= 9) { // Adjusted for monetary values
        cell.numFmt = '#,##0.00_);[Red](#,##0.00)';
      } else if (colNumber === 4) { // Products count
        cell.numFmt = '0';
      }
    });
    // --- Cancelled Orders Sheet ---
    const cancelledSheet = workbook.addWorksheet('الطلبات الملغاة', { views: [{ rightToLeft: true }] });
    cancelledSheet.mergeCells('A1:G1');
    const cancelledTitle = cancelledSheet.getCell('A1');
    cancelledTitle.value = 'تقرير الطلبات الملغاة';
    cancelledTitle.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    cancelledTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE74C3C' } };
    cancelledTitle.alignment = { horizontal: 'center', vertical: 'middle' };
    cancelledSheet.getRow(1).height = 35;
    cancelledSheet.addRow([]); // Empty row
    // Cancelled Stats
    cancelledSheet.mergeCells('A3:B3');
    cancelledSheet.getCell('A3').value = 'إحصائيات الرسوم';
    cancelledSheet.getCell('A3').font = { name: 'Arial', bold: true, size: 14 };
    cancelledSheet.getCell('A3').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDDDDD' } };
    const cancelledStats = [
      ['رسوم الإلغاء على المتجر', `${storeCancellationFees.toFixed(2)} ر.س`],
      ['رسوم الإلغاء على العميل', `${customerCancellationFees.toFixed(2)} ر.س`],
      ['عدد الملغيات على المتجر', cancelledByStoreCount],
      ['عدد الملغيات على العميل', cancelledByCustomerCount],
    ];
    cancelledStats.forEach(([label, value]) => {
      const row = cancelledSheet.addRow([label, value]);
      row.getCell(1).font = { bold: true };
      row.getCell(2).alignment = { horizontal: 'left' };
    });
    cancelledSheet.addRow([]); // Empty row
    const cancelledHeaders = ['رقم الطلب', 'العميل', 'التاريخ', 'سبب الإلغاء', 'رسوم الإلغاء', 'يحمل الرسوم', 'إجمالي الطلب']; // Added Total Price column
    const cancelledHeaderRow = cancelledSheet.addRow(cancelledHeaders);
    cancelledHeaderRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE74C3C' } };
      cell.alignment = { horizontal: 'center' };
    });
    filteredCancelledOrders.forEach((order: any, index) => {
      const row = cancelledSheet.addRow([
        order.order_number,
        order.customer_name,
        new Date(order.order_date).toLocaleDateString('en-GB'),
        order.cancellation_reason || 'غير محدد',
        `${(order.cancellation_fee || 0).toFixed(2)} ر.س`,
        order.fee_bearer === 'store' ? 'المتجر' : 'العميل',
        `${(order.total_price || 0).toFixed(2)} ر.س`, // Display total price for cancelled order
      ]);
      if (index % 2 === 1) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
        });
      }
    });
    const cancelledTotalRow = cancelledSheet.addRow([
      'الإجمالي', '', '', '', `${totalCancellationFees.toFixed(2)} ر.س`, '',
      `${filteredCancelledOrders.reduce((sum, o: any) => sum + (o.total_price || 0), 0).toFixed(2)} ر.س`, // Total price for cancelled
    ]);
    cancelledTotalRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE74C3C' } };
    });
    // Auto-size columns for better readability (ExcelJS automatically tries to find a good width based on content)
    worksheet.columns.forEach(column => {
      let maxWidth = 10; // Minimum width
      column.eachCell({ includeEmpty: true }, cell => {
        const columnText = String(cell.value);
        // Rough estimation for text width based on average character width.
        // Adjust the 0.6 factor based on typical font size/character density.
        const textWidth = columnText.length * 1.0;
        if (textWidth > maxWidth) {
          maxWidth = textWidth;
        }
      });
      column.width = Math.min(Math.max(maxWidth + 2, 10), 50); // Add some padding, min 10, max 50
    });
    cancelledSheet.columns.forEach(column => {
      let maxWidth = 10;
      column.eachCell({ includeEmpty: true }, cell => {
        const columnText = String(cell.value);
        const textWidth = columnText.length * 1.0;
        if (textWidth > maxWidth) {
          maxWidth = textWidth;
        }
      });
      column.width = Math.min(Math.max(maxWidth + 2, 10), 50);
    });
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `تقرير_المبيعات_${new Date().toISOString().split('T')[0]}.xlsx`);
  };
  // === تصدير PDF ===
  const exportToPdf = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('الرجاء السماح بفتح النوافذ المنبثقة');
      return;
    }
    const today = new Date();
    const issueDate = today.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    // صيغة التاريخ المطلوبة: 2025/11/01
    const formatOrderDate = (date) => {
      const d = new Date(date);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}/${month}/${day}`;
    };
    const periodText =
      dateRange === 'all' ? 'كامل السجل التاريخي' :
        dateRange === 'today' ? 'اليوم فقط' :
          dateRange === 'yesterday' ? 'أمس فقط' :
            dateRange === 'week' ? 'آخر 7 أيام' :
              dateRange === 'month' ? 'هذا الشهر' :
                `${formatOrderDate(startDate)} - ${formatOrderDate(endDate)}`;
    // بيانات المبيعات اليومية (آخر 8 أيام)
    const dailyData = {};
    filteredOrders.forEach(order => {
      const dateKey = new Date(order.order_date).toISOString().split('T')[0];
      dailyData[dateKey] = (dailyData[dateKey] || 0) + (order.total_price || 0);
    });
    const dates = Object.keys(dailyData).sort().slice(-8);
    const chartLabels = dates.map(d => formatOrderDate(d));
    const chartValues = dates.map(d => dailyData[d]);
    // تقسيم الصفحات
    const ROWS_PER_PAGE = 38;
    const pages = [];
    for (let i = 0; i < filteredOrders.length; i += ROWS_PER_PAGE) {
      pages.push(filteredOrders.slice(i, i + ROWS_PER_PAGE));
    }
    const totalPages = pages.length + 2;
    const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>تقرير المبيعات - ${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    @page { size: A4; margin: 0; }
    body { margin:0; padding:0; font-family: 'Cairo', sans-serif; color:#2d3436; background:#f9fafb; }
    .container { width: 210mm; margin: 0 auto; background: white; }
    .page { padding: 18mm 14mm 22mm; box-sizing: border-box; page-break-after: always; position: relative; }
    /* الرأس والتذييل */
    .header { position: absolute; top: 0; left: 0; right: 0; height: 75px; border-bottom: 3px solid #1e40af; padding: 10mm 14mm 8px; display: flex; justify-content: space-between; align-items: center; background: white; z-index: 10; }
    .logo { font-size: 22pt; font-weight: 900; color: #1e40af; }
    .report-info { font-size: 10.5pt; color: #555; text-align: left; }
    .footer { position: absolute; bottom: 0; left: 0; right: 0; height: 45px; border-top: 1px solid #e2e8f0; padding: 8px 14mm; font-size: 9pt; color: #636e72; display: flex; justify-content: space-between; background: white; }
    /* صفحة الغلاف */
    .cover { text-align: center; padding-top: 90px; }
    .cover h1 { font-size: 30pt; color: #1e40af; margin: 30px 0 12px; font-weight: 900; }
    .cover .period { background: #1e40af; color: white; padding: 16px 40px; border-radius: 10px; display: inline-block; font-size: 15pt; margin: 25px 0; }
    /* البطاقات */
    .cards { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin: 35px 0; }
    .card { background: #f8fafc; padding: 18px; border-radius: 10px; text-align: center; box-shadow: 0 3px 12px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
    .card h3 { margin: 0 0 8px; color: #555; font-size: 12pt; }
    .card .val { font-size: 22pt; font-weight: 900; color: #1e40af; }
    .card.profit .val { color: ${totalNetProfit >= 0 ? '#16a34a' : '#dc2626'}; }
    /* الرسم البياني المصغر */
    .chart-box { margin: 30px 0; padding: 16px; background: white; border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.07); text-align: center; }
    .chart-title { font-size: 13pt; font-weight: 700; color: #1e40af; margin-bottom: 12px; }
    #salesChart { max-height: 220px; }
    /* جدول التفاصيل */
    table.detail { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 9.4pt; }
    table.detail th { background: #1e40af; color: white; padding: 11px 6px; font-weight: 600; }
    table.detail td { padding: 9px 5px; text-align: center; border-bottom: 1px solid #e2e8f0; }
    table.detail tr:nth-child(even) { background: #f8fafc; }
    .total-row { background: #dbeafe !important; font-weight: 900; font-size: 11.5pt; color: #1e40af; }
    .print-btn { position: fixed; bottom: 25px; left: 50%; transform: translateX(-50%); background: #1e40af; color: white; padding: 14px 55px; border: none; border-radius: 10px; font-size: 17px; font-weight: bold; cursor: pointer; box-shadow: 0 8px 25px rgba(30,64,175,0.35); z-index: 1000; }
    @media print { .print-btn, .header, .footer { display: none; } .page { padding: 12mm !important; } }
  </style>
</head>
<body>
  <!-- صفحة الغلاف -->
  <div class="container">
    <div class="page cover">
      <div class="header">
        <div class="logo">متجرك</div>
        <div class="report-info">تقرير المبيعات والأرباح</div>
      </div>
      <h1>تقرير الأداء المالي</h1>
      <div class="period">
        ${periodText}
        <br><small style="font-size:12pt;opacity:0.9;">تاريخ الإصدار: ${issueDate}</small>
      </div>
    </div>
    <!-- صفحة الملخص + رسم بياني واحد مصغر -->
    <div class="page">
      <div class="header">
        <div class="logo">متجرك</div>
        <div class="report-info">الملخص التنفيذي</div>
      </div>
      <div class="cards">
        <div class="card"><h3>إجمالي المبيعات</h3><div class="val">${totalSalesWithTax.toLocaleString('EN-US')} ر.س</div></div>
        <div class="card"><h3>عدد الطلبات</h3><div class="val">${filteredOrders.length}</div></div>
        <div class="card profit"><h3>صافي الربح</h3><div class="val">${totalNetProfit.toLocaleString('EN-US', { minimumFractionDigits: 0 })} ر.س</div></div>
        <div class="card"><h3>هامش الربح</h3><div class="val">${totalMargin.toFixed(1)}%</div></div>
        <div class="card" style="background:#fff5f5;border-color:#fca5a5;"><h3>الملغاة</h3><div class="val">${totalCancelled}</div></div>
      </div>
      <div class="chart-box">
        <div class="chart-title">المبيعات اليومية (آخر 8 أيام)</div>
        <canvas id="salesChart"></canvas>
      </div>
      <div class="footer">
        <span>نظام إدارة المبيعات الذكي</span>
        <span>الصفحة 2 من ${totalPages}</span>
      </div>
    </div>
    <!-- صفحات التفاصيل -->
    ${pages.map((pageOrders, idx) => {
      const pageNum = idx + 3;
      return `
    <div class="page">
      <div class="header">
        <div class="logo">متجرك</div>
        <div class="report-info">تفاصيل الطلبات</div>
      </div>
      <table class="detail">
        <thead>
          <tr>
            <th>م</th>
            <th>رقم الطلب</th>
            <th>العميل</th>
            <th>التاريخ</th>
            <th>المنتجات</th>
            <th>المبيعات</th>
            <th>تكلفة المنتجات</th>
            <th>شحن + دفع</th>
            <th>الربح</th>
          </tr>
        </thead>
        <tbody>
          ${pageOrders.map((order, i) => {
        const c = calculateNetProfit(order);
        const serial = idx * ROWS_PER_PAGE + i + 1;
        const profitColor = c.netProfit >= 0 ? '#16a34a' : '#dc2626';
        return `
            <tr>
              <td><strong>${serial}</strong></td>
              <td>#${order.order_number}</td>
              <td>${order.customer_name}</td>
              <td>${formatOrderDate(order.order_date)}</td>
              <td>${order.products?.length || 0}</td>
              <td>${(order.total_price || 0).toFixed(0)}</td>
              <td>${c.productCostInclTax.toFixed(0)}</td>
              <td>${(c.shippingWithTax + c.paymentFee).toFixed(0)}</td>
              <td style="color:${profitColor};font-weight:bold;">${c.netProfit.toFixed(0)}</td>
            </tr>`;
      }).join('')}
          ${idx === pages.length - 1 ? `
          <tr class="total-row">
            <td colspan="7" style="text-align:right;padding-right:15px;"><strong>الإجمالي النهائي</strong></td>
<td style="color:${totalNetProfit >= 0 ? '#16a34a' : '#dc2626'};font-weight:bold;font-size:13pt;">
  <strong>${totalNetProfit.toLocaleString('EN-US', { minimumFractionDigits: 0 })} ر.س</strong>
</td>
          </tr>` : ''}
        </tbody>
      </table>
      <div class="footer">
        <span>تقرير صادر تلقائياً • ${issueDate}</span>
        <span>الصفحة ${pageNum} من ${totalPages}</span>
      </div>
    </div>`;
    }).join('')}
  </div>
  <button onclick="window.print()" class="print-btn">حفظ كـ PDF</button>
  <script>
    new Chart(document.getElementById('salesChart'), {
      type: 'line',
      data: {
        labels: ${JSON.stringify(chartLabels)},
        datasets: [{
          label: 'المبيعات اليومية',
          data: ${JSON.stringify(chartValues)},
          borderColor: '#1e40af',
          backgroundColor: 'rgba(30, 64, 175, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 5
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    });
  </script>
</body>
</html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
  };
  if (isLoading) {
    return (
      <div className="p-4">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="h-12 bg-gray-200 rounded mb-4"></div>
                <div className="h-6 bg-gray-200 rounded mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">خطأ: {error}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="p-3 md:p-4 min-h-screen bg-gray-50" dir="rtl">
      {/* العنوان الرئيسي */}
      <div className="mb-4 md:mb-6 border-b border-gray-200 pb-3 md:pb-4">
        <div className="flex items-center gap-2 md:gap-3">
          <BarChart3 className="h-6 w-6 md:h-8 md:w-8 text-blue-600" />
          <h1 className="text-lg md:text-2xl font-bold text-gray-900">تقارير المبيعات والتكاليف</h1>
        </div>
        <p className="text-sm md:text-base text-gray-600 mt-1 md:mt-2">تحليل شامل ومهني للأداء المالي والتشغيلي</p>
      </div>
      {/* الفلاتر والتصدير */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 md:p-4 mb-4 md:mb-6 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-3 md:gap-4 items-start lg:items-center justify-between">
          <div className="flex flex-wrap gap-1.5 md:gap-2 w-full lg:w-auto flex-grow">
            {['all', 'today', 'yesterday', 'week', 'month'].map((val) => (
              <button
                key={val}
                onClick={() => { setDateRange(val as any); if (val !== 'custom') { setStartDate(''); setEndDate(''); } }}
                className={`px-2 md:px-3 py-1.5 md:py-2 rounded text-xs md:text-sm font-semibold transition-colors border ${dateRange === val
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50'}`}
              >
                {val === 'all' ? 'الكل' : val === 'today' ? 'اليوم' : val === 'yesterday' ? 'أمس' : val === 'week' ? 'أسبوع' : 'شهر'}
              </button>
            ))}
            <button
              onClick={() => setDateRange('custom')}
              className={`px-2 md:px-3 py-1.5 md:py-2 rounded text-xs md:text-sm font-semibold transition-colors border flex items-center gap-1 ${dateRange === 'custom'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50'}`}
            >
              مخصص
            </button>
          </div>
          {dateRange === 'custom' && (
            <div className="flex items-center gap-2 w-full lg:w-auto">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-2 py-2 border border-gray-300 rounded text-sm flex-1 focus:ring-2 focus:ring-blue-500" />
              <span className="text-gray-600 font-medium text-sm whitespace-nowrap">إلى</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-2 py-2 border border-gray-300 rounded text-sm flex-1 focus:ring-2 focus:ring-blue-500" />
            </div>
          )}
          {/* Export Buttons */}
          <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
            <button onClick={exportToExcel} className="px-3 md:px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-semibold shadow-sm text-xs md:text-sm">
              <Download className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">تصدير</span> Excel
            </button>
            <button onClick={exportToPdf} className="px-3 md:px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors flex items-center justify-center gap-2 font-semibold shadow-sm text-xs md:text-sm">
              <Download className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">تصدير</span> PDF
            </button>
            <button onClick={exportComprehensiveData} disabled={isExporting} className="px-3 md:px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex items-center justify-center gap-2 font-semibold shadow-sm text-xs md:text-sm disabled:opacity-50 disabled:cursor-not-allowed">
              {isExporting ? (
                <>
                  <Loader2 className="h-3 w-3 md:h-4 md:w-4 animate-spin" />
                  جاري التصدير...
                </>
              ) : (
                <>
                  <Download className="h-3 w-3 md:h-4 md:w-4" />
                  شامل
                </>
              )}
            </button>
          </div>
        </div>
        {dateRange === 'custom' && <p className="text-sm text-gray-500 mt-2">الفترة المحددة: {startDate || 'غير محدد'} إلى {endDate || 'غير محدد'}</p>}
      </div>
      {/* Start of content to be exported to PDF (excluding filter and export controls) */}
      <div ref={reportRef} className="report-pdf-content">
        {/* الإحصائيات الرئيسية */}
        <div className="mb-6">
          <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-3 md:mb-4 flex items-center gap-2">
            <FileText className="h-4 w-4 md:h-5 md:w-5 text-gray-600" />
            الإحصائيات الرئيسية
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            <div className="bg-white border border-blue-100 rounded-lg p-3 md:p-4 shadow-sm">
              <FileText className="h-6 w-6 md:h-8 md:w-8 text-blue-600 mb-2 md:mb-3 mx-auto" />
              <h3 className="text-xl font-bold text-blue-900 text-center">{filteredOrders.length}</h3>
              <p className="text-sm text-blue-700 text-center font-medium">طلبات مقفلة</p>
            </div>
            <div className="bg-white border border-green-100 rounded-lg p-4 shadow-sm">
              <DollarSign className="h-8 w-8 text-green-600 mb-3 mx-auto" />
              <h3 className="text-xl font-bold text-green-900 text-center">{totalSalesWithTax.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
              <p className="text-sm text-green-700 text-center font-medium">إجمالي المبيعات شامل الضريبة (ر.س)</p>
            </div>
            <div className={`bg-white border rounded-lg p-4 shadow-sm ${totalNetProfit >= 0 ? 'border-green-100' : 'border-red-100'}`}>
              <TrendingUp className={`h-8 w-8 mb-3 mx-auto ${totalNetProfit >= 0 ? 'text-green-600' : 'text-red-600'}`} />
              <h3 className={`text-xl font-bold text-center ${totalNetProfit >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                {totalNetProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </h3>
              <p className={`text-sm font-medium text-center ${totalNetProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>صافي الربح (ر.س)</p>
            </div>
            <div className="bg-white border border-red-100 rounded-lg p-4 shadow-sm">
              <XCircle className="h-8 w-8 text-red-600 mb-3 mx-auto" />
              <h3 className="text-xl font-bold text-red-900 text-center">{totalCancelled}</h3>
              <p className="text-sm text-red-700 text-center font-medium">طلبات ملغاة</p>
            </div>
            <div className="bg-white border border-purple-100 rounded-lg p-4 shadow-sm">
              <Package className="h-8 w-8 text-purple-600 mb-3 mx-auto" />
              <h3 className="text-xl font-bold text-purple-900 text-center">{totalSuppliersDue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
              <p className="text-sm text-purple-700 text-center font-medium">إجمالي المستحقات للموردين (ر.س)</p>
            </div>
            <div className="bg-white border border-indigo-100 rounded-lg p-4 shadow-sm">
              <CreditCard className="h-8 w-8 text-indigo-600 mb-3 mx-auto" />
              <h3 className="text-xl font-bold text-indigo-900 text-center">{totalPaymentMethodsDue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
              <p className="text-sm text-indigo-700 text-center font-medium">المستحق من طرق الدفع (ر.س)</p>
            </div>
            <div className="bg-white border border-orange-100 rounded-lg p-4 shadow-sm">
              <Truck className="h-8 w-8 text-orange-600 mb-3 mx-auto" />
              <h3 className="text-xl font-bold text-orange-900 text-center">{totalShippingCompaniesDue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
              <p className="text-sm text-orange-700 text-center font-medium">المستحق لشركات الشحن (ر.س)</p>
            </div>
            <div className="bg-white border border-gray-100 rounded-lg p-4 shadow-sm">
              <TrendingDown className="h-8 w-8 text-gray-600 mb-3 mx-auto" />
              <h3 className="text-xl font-bold text-gray-900 text-center">{totalOperationalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
              <p className="text-sm text-gray-700 text-center font-medium">إجمالي المصروفات (ر.س)</p>
            </div>
            <div className="bg-white border border-red-100 rounded-lg p-4 shadow-sm">
              <Tag className="h-8 w-8 text-red-600 mb-3 mx-auto" />
              <h3 className="text-xl font-bold text-red-900 text-center">{totalProductCostsInclTax.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
              <p className="text-sm text-red-700 text-center font-medium">إجمالي التكاليف (تكاليف المنتجات) (ر.س)</p>
            </div>
          </div>
        </div>
        {/* قسم الملغيات */}
        {totalCancelled > 0 && (
          <div className="bg-white border border-red-100 rounded-lg p-4 mb-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="h-6 w-6 text-red-600" />
              <h3 className="text-lg font-semibold text-red-900">تقرير الطلبات الملغاة</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-center">
              <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                <h4 className="text-xl font-bold text-red-700">{totalCancelled}</h4>
                <p className="text-sm text-red-600 mt-1">إجمالي الملغيات</p>
              </div>
              <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                <h4 className="text-xl font-bold text-red-700">{storeCancellationFees.toLocaleString('en-US', { minimumFractionDigits: 2 })} ر.س</h4>
                <p className="text-sm text-red-600 mt-1">رسوم على المتجر</p>
                <p className="text-xs text-red-500 mt-0">({cancelledByStoreCount} طلب)</p>
              </div>
              <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                <h4 className="text-xl font-bold text-red-700">{customerCancellationFees.toLocaleString('en-US', { minimumFractionDigits: 2 })} ر.س</h4>
                <p className="text-sm text-red-600 mt-1">رسوم على العميل</p>
                <p className="text-xs text-red-500 mt-0">({cancelledByCustomerCount} طلب)</p>
              </div>
              <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                <h4 className="text-xl font-bold text-red-700">{totalCancellationFees.toLocaleString('en-US', { minimumFractionDigits: 2 })} ر.س</h4>
                <p className="text-sm text-red-600 mt-1">إجمالي الرسوم</p>
              </div>
            </div>
          </div>
        )}
        {/* جدول الطلبات */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Package className="h-5 w-5 text-gray-600" />
              تفاصيل الطلبات المقفلة
            </h3>
            <p className="text-sm text-gray-600 mt-1">عرض مفصل للطلبات مع الحسابات المالية</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-3 text-right text-sm font-semibold text-gray-700 uppercase tracking-wider">رقم الطلب</th>
                  <th className="px-3 py-3 text-right text-sm font-semibold text-gray-700 uppercase tracking-wider">العميل</th>
                  <th className="px-3 py-3 text-right text-sm font-semibold text-gray-700 uppercase tracking-wider">التاريخ</th>
                  <th className="px-3 py-3 text-right text-sm font-semibold text-gray-700 uppercase tracking-wider">المنتجات</th>
                  <th className="px-3 py-3 text-right text-sm font-semibold text-gray-700 uppercase tracking-wider">التكلفة (شاملة الضريبة)</th>
                  <th className="px-3 py-3 text-right text-sm font-semibold text-gray-700 uppercase tracking-wider">رسوم الدفع (شاملة الضريبة)</th>
                  <th className="px-3 py-3 text-right text-sm font-semibold text-gray-700 uppercase tracking-wider">خصم الشحن مع الضريبة</th>
                  <th className="px-3 py-3 text-right text-sm font-semibold text-gray-700 uppercase tracking-wider">المبيعات شامل الضريبة</th>
                  <th className="px-3 py-3 text-right text-sm font-semibold text-gray-700 uppercase tracking-wider">صافي الربح</th>
                  <th className="px-3 py-3 text-right text-sm font-semibold text-gray-700 uppercase tracking-wider">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredOrders.map((order, index) => {
                  const { netProfit: orderProfit, paymentFee, productCostInclTax, shippingDeduction } = calculateNetProfit(order);
                  const totalSales = order.total_price || 0;
                  return (
                    <tr key={order.id} className={`transition-colors ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                      <td className="px-3 py-3 whitespace-nowrap text-sm font-semibold text-gray-900">{order.order_number}</td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700">{order.customer_name}</td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600">{new Date(order.order_date).toLocaleDateString('en-GB')}</td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600">{order.products?.length || 0} منتج</td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm font-semibold text-gray-900">{productCostInclTax.toLocaleString('en-US', { minimumFractionDigits: 2 })} ر.س</td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm font-semibold text-red-700">{paymentFee.toLocaleString('en-US', { minimumFractionDigits: 2 })} ر.س</td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm font-semibold text-orange-700">{shippingDeduction.toLocaleString('en-US', { minimumFractionDigits: 2 })} ر.س</td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600">{totalSales.toLocaleString('en-US', { minimumFractionDigits: 2 })} ر.س</td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm font-semibold">
                        <span className={orderProfit >= 0 ? 'text-green-700' : 'text-red-700'}>
                          {orderProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })} ر.س
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm">
                        <button onClick={() => setSelectedOrder(order)} className="text-blue-600 hover:text-blue-800 transition-colors p-2 rounded">
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredOrders.length === 0 && (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">لا توجد طلبات مقفلة</h3>
              <p className="text-gray-600">جرب تغيير نطاق التاريخ لعرض البيانات</p>
            </div>
          )}
        </div>
      </div> {/* End of reportRef content */}
      {/* نافذة تفاصيل الطلب */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-900">تفاصيل الطلب #{selectedOrder.order_number}</h3>
              <button onClick={() => setSelectedOrder(null)} className="text-gray-500 hover:text-gray-700 text-2xl font-bold">×</button>
            </div>
            <div className="p-4 space-y-6">
              {/* بطاقات المعلومات */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-100 p-3 rounded-lg">
                      <Package className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-blue-600 font-semibold">العميل</p>
                      <p className="text-lg font-bold text-blue-900">{selectedOrder.customer_name}</p>
                      <p className="text-sm text-blue-700">{selectedOrder.phone_number}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-green-100 p-3 rounded-lg">
                      <Calendar className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-green-600 font-semibold">تاريخ الطلب</p>
                      <p className="text-lg font-bold text-green-900">
                        {new Date(selectedOrder.order_date).toLocaleDateString('en-GB')}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-orange-100 p-3 rounded-lg">
                      <Clock className="h-6 w-6 text-orange-600" />
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-orange-600 font-semibold">وقت الطلب</p>
                      <p className="text-lg font-bold text-orange-900" dir="ltr">
                        {(() => {
                          const date = new Date(selectedOrder.order_date);
                          const hours = date.getUTCHours();
                          const minutes = date.getUTCMinutes().toString().padStart(2, '0');
                          const seconds = date.getUTCSeconds().toString().padStart(2, '0');
                          const period = hours >= 12 ? 'مساءً' : 'صباحًا';
                          const hours12 = hours % 12 || 12;
                          return `${hours12}:${minutes}:${seconds} ${period}`;
                        })()}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-purple-100 p-3 rounded-lg">
                      <Truck className="h-6 w-6 text-purple-600" />
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-purple-600 font-semibold">الشحن</p>
                      <p className="text-lg font-bold text-purple-900">{selectedOrder.shipping_company || 'غير محدد'}</p>
                      <p className="text-sm text-purple-700">
                        {selectedOrder.shipping_cost ? `${selectedOrder.shipping_cost} ر.س` : 'مجاني'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              {/* طريقة الدفع */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-100 p-3 rounded-lg">
                    <CreditCard className="h-6 w-6 text-indigo-600" />
                  </div>
                  <div className="text-right flex-1">
                    <p className="text-sm text-indigo-600 font-semibold">طريقة الدفع</p>
                    <p className="text-lg font-bold text-indigo-900">{paymentMethods.find(m => m.code === selectedOrder.payment_method)?.name || 'غير معروف'}</p>
                    <p className="text-sm text-indigo-700 mt-1">رسوم الدفع: {calculateNetProfit(selectedOrder).paymentFee.toFixed(2)} ر.س</p>
                  </div>
                </div>
              </div>
              {/* المنتجات */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="text-lg font-semibold mb-3 flex items-center gap-2 text-gray-900">
                  <Package className="h-5 w-5 text-gray-600" />
                  المنتجات ({selectedOrder.products?.length || 0})
                </h4>
                <div className="space-y-3">
                  {selectedOrder.products?.map((product, i) => {
                    const unitPriceExclTax = product.unit_price || 0;
                    // const unitPriceInclTax = unitPriceExclTax * (1 + TAX_RATE); // Not used currently in display but good for info
                    const revenueExclTax = product.subtotal || 0;
                    // const revenueInclTax = revenueExclTax * (1 + TAX_RATE); // Not used currently
                    // تعديل: تكلفة المنتج شاملة الضريبة كما في DB
                    const costSubtotalInclTax = product.cost_subtotal || 0;
                    return (
                      <div key={i} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-center">
                          <div className="md:text-right">
                            <p className="font-bold text-gray-900 text-sm">{product.name}</p>
                            <p className="text-sm text-gray-600">الكمية: {product.quantity}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600">السعر غير شامل الضريبة</p>
                            <p className="font-semibold text-gray-900 text-sm">{unitPriceExclTax.toLocaleString('EN-US')} ر.س</p>
                          </div>
                          <div>
                            <p className="text-xs text-green-600">الإيراد غير شامل الضريبة</p>
                            <p className="font-bold text-green-700 text-sm">{revenueExclTax.toLocaleString('EN-US')} ر.س</p>
                          </div>
                          <div>
                            <p className="text-xs text-red-600">إجمالي التكلفة (شاملة الضريبة)</p>
                            <p className="font-bold text-red-700 text-sm">{costSubtotalInclTax.toLocaleString('EN-US')} ر.س</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* التحليل المالي */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
                <h4 className="text-lg font-bold text-blue-900 mb-4 text-center flex items-center justify-center gap-2">
                  <DollarSign className="h-5 w-5 text-blue-600" />
                  التحليل المالي الشامل
                </h4>
                {(() => {
                  const { netProfit, margin, shippingBearer, productCostInclTax, shippingWithTax, paymentFee } = calculateNetProfit(selectedOrder);
                  const productRevenueBeforeTax = selectedOrder.subtotal_before_tax || 0;
                  const shipping = selectedOrder.shipping_cost || 0;
                  const shippingDeduction = shippingWithTax; // Cost always includes tax and is deducted
                  const totalCosts = productCostInclTax + shippingDeduction + paymentFee;
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
                        <h5 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2 justify-center">
                          <TrendingUp className="h-4 w-4 text-green-600" />
                          الإيرادات
                        </h5>
                        <div className="space-y-3 text-center">
                          <div>
                            <p className="text-xs text-gray-600">إجمالي الإيرادات شامل الضريبة</p>
                            <p className="text-lg font-bold text-blue-900">{(selectedOrder.total_price || 0).toLocaleString('EN-US', { minimumFractionDigits: 2 })} ر.س</p>
                          </div>
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
                        <h5 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2 justify-center">
                          <TrendingDown className="h-4 w-4 text-red-600" />
                          التكاليف والرسوم
                        </h5>
                        <div className="space-y-2 text-center text-sm">
                          <div className="flex justify-between px-2">
                            <span className="text-gray-600">رسوم الدفع:</span>
                            <span className="font-bold text-red-700">{paymentFee.toLocaleString('EN-US', { minimumFractionDigits: 2 })} ر.س</span>
                          </div>
                          <div className="flex justify-between px-2">
                            <span className="text-gray-600">تكلفة الشحن مع الضريبة:</span>
                            <span className="font-bold text-red-700">{shippingWithTax.toLocaleString('EN-US', { minimumFractionDigits: 2 })} ر.س</span>
                          </div>
                          <div className="flex justify-between px-2">
                            <span className="text-gray-600">تكاليف المنتجات:</span>
                            <span className="font-bold text-red-700">{productCostInclTax.toLocaleString('EN-US', { minimumFractionDigits: 2 })} ر.س</span>
                          </div>
                          <div className="flex justify-between px-2 border-t border-gray-200 pt-2 font-bold">
                            <span>إجمالي التكاليف:</span>
                            <span className="text-red-900">{totalCosts.toLocaleString('EN-US', { minimumFractionDigits: 2 })} ر.س</span>
                          </div>
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
                        <h5 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2 justify-center">
                          <TrendingUp className="h-4 w-4 text-green-600" />
                          النتائج
                        </h5>
                        <div className="space-y-3 text-center">
                          <div>
                            <p className="text-xs text-gray-600">صافي الربح</p>
                            <p className={`text-lg font-bold ${netProfit >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                              {netProfit.toLocaleString('EN-US', { minimumFractionDigits: 2 })} ر.س
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600">هامش الربح</p>
                            <p className={`text-lg font-bold ${margin >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                              {margin.toFixed(1)}%
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default Reports;