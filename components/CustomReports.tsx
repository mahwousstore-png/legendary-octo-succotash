import React, { useState, useEffect } from 'react';
import {
  FileText, Download, Eye, X, ChevronDown, Calendar, Filter, FileSpreadsheet, Loader2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  exportInventoryToExcel, exportInventoryToPDF,
  exportPaymentMethodsToExcel, exportPaymentMethodsToPDF,
  exportShippingCompaniesToExcel, exportShippingCompaniesToPDF,
  exportSuppliersToExcel, exportSuppliersToPDF,
  exportOrdersToExcel, exportOrdersToPDF,
  exportEmployeeBalancesToExcel, exportEmployeeBalancesToPDF
} from '../lib/allExports';
import { exportToExcel, exportToPDF, formatCurrency, formatDate } from '../lib/exportUtils';
import toast, { Toaster } from 'react-hot-toast';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface ReportType {
  id: string;
  name: string;
  description: string;
  icon: string;
}

const reportTypes: ReportType[] = [
  { id: 'expenses', name: 'المصروفات', description: 'تقرير شامل لجميع المصروفات', icon: '💰' },
  { id: 'inventory', name: 'المخزون', description: 'تقرير المنتجات والمخزون', icon: '📦' },
  { id: 'employee_balances', name: 'أرصدة الموظفين', description: 'تقرير عهد وأرصدة الموظفين', icon: '👥' },
  { id: 'payment_methods', name: 'طرق الدفع', description: 'تقرير إحصائيات طرق الدفع', icon: '💳' },
  { id: 'shipping_companies', name: 'شركات الشحن', description: 'تقرير إحصائيات شركات الشحن', icon: '🚚' },
  { id: 'suppliers', name: 'إدارة الموردين', description: 'تقرير الموردين والمستحقات', icon: '🏢' },
  { id: 'cancelled_orders', name: 'الطلبات الملغية', description: 'تقرير الطلبات الملغية', icon: '❌' },
  { id: 'new_orders', name: 'الطلبات الجديدة', description: 'تقرير الطلبات الجديدة', icon: '🆕' },
  { id: 'locked_orders', name: 'الطلبات المقفلة', description: 'تقرير الطلبات المقفلة', icon: '🔒' }
];

const CustomReports: React.FC = () => {
  const [selectedReport, setSelectedReport] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchReportData = async (reportType: string) => {
    setLoading(true);
    try {
      let data: any = null;

      switch (reportType) {
        case 'expenses':
          const { data: expensesData } = await supabase
            .from('expenses')
            .select('*')
            .order('date', { ascending: false });

          let filteredExpenses = expensesData || [];
          if (dateFrom) {
            filteredExpenses = filteredExpenses.filter((e: any) => e.date >= dateFrom);
          }
          if (dateTo) {
            filteredExpenses = filteredExpenses.filter((e: any) => e.date <= dateTo);
          }

          data = {
            title: 'تقرير المصروفات',
            items: filteredExpenses,
            columns: ['الوصف', 'الفئة', 'المبلغ', 'التاريخ'],
            dataMapping: (item: any) => [
              item.description,
              item.category,
              formatCurrency(item.amount),
              formatDate(item.date)
            ],
            summary: {
              total: filteredExpenses.reduce((sum: number, e: any) => sum + e.amount, 0),
              count: filteredExpenses.length
            }
          };
          break;

        case 'inventory':
          const { data: inventoryData } = await supabase
            .from('inventory')
            .select('*')
            .order('name');

          data = {
            title: 'تقرير المخزون',
            items: inventoryData || [],
            columns: ['اسم المنتج', 'SKU', 'الكمية', 'سعر الوحدة', 'القيمة الإجمالية'],
            dataMapping: (item: any) => [
              item.name,
              item.sku || '-',
              item.quantity.toString(),
              formatCurrency(item.unit_cost),
              formatCurrency(item.quantity * item.unit_cost)
            ],
            summary: {
              totalValue: (inventoryData || []).reduce((sum: number, i: any) => sum + (i.quantity * i.unit_cost), 0),
              totalItems: (inventoryData || []).reduce((sum: number, i: any) => sum + i.quantity, 0),
              count: (inventoryData || []).length
            }
          };
          break;

        case 'employee_balances':
          const { data: usersData } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('role', 'user')
            .eq('is_active', true);

          const { data: transactionsData } = await supabase
            .from('employee_balance_transactions')
            .select('*');

          const employeeMap = new Map();
          (usersData || []).forEach((user: any) => {
            employeeMap.set(user.id, {
              user,
              current_balance: 0,
              transactions: []
            });
          });

          (transactionsData || []).forEach((t: any) => {
            const emp = employeeMap.get(t.user_id);
            if (emp) {
              emp.transactions.push(t);
              emp.current_balance += parseFloat(t.amount.toString());
            }
          });

          const employees = Array.from(employeeMap.values());

          data = {
            title: 'تقرير أرصدة الموظفين',
            items: employees,
            columns: ['اسم الموظف', 'البريد الإلكتروني', 'الرصيد الحالي', 'عدد العمليات'],
            dataMapping: (item: any) => [
              item.user.full_name,
              item.user.email,
              formatCurrency(item.current_balance),
              item.transactions.length.toString()
            ],
            summary: {
              totalBalance: employees.reduce((sum: number, e: any) => sum + e.current_balance, 0),
              count: employees.length
            }
          };
          break;

        case 'payment_methods':
        case 'shipping_companies':
          const tableName = reportType === 'payment_methods' ? 'payment_method' : 'shipping_company';
          const { data: ordersData } = await supabase
            .from('orders')
            .select('*')
            .eq('is_locked', true);

          let filteredOrders = ordersData || [];
          if (dateFrom) {
            filteredOrders = filteredOrders.filter((o: any) => o.order_date >= dateFrom);
          }
          if (dateTo) {
            filteredOrders = filteredOrders.filter((o: any) => o.order_date <= dateTo);
          }

          const groupedData: any = {};
          filteredOrders.forEach((order: any) => {
            const key = reportType === 'payment_methods' ? order.payment_method : order.shipping_company;
            if (!groupedData[key]) {
              groupedData[key] = { name: key, count: 0, total: 0 };
            }
            groupedData[key].count++;
            groupedData[key].total += reportType === 'payment_methods' ? order.total_price : (order.shipping_cost || 0);
          });

          const items = Object.values(groupedData);
          const totalAmount = items.reduce((sum: any, i: any) => sum + i.total, 0);

          data = {
            title: reportType === 'payment_methods' ? 'تقرير طرق الدفع' : 'تقرير شركات الشحن',
            items: items.map((item: any) => ({
              ...item,
              percentage: totalAmount > 0 ? (item.total / totalAmount) * 100 : 0
            })),
            columns: [
              reportType === 'payment_methods' ? 'طريقة الدفع' : 'شركة الشحن',
              reportType === 'payment_methods' ? 'عدد المعاملات' : 'عدد الشحنات',
              reportType === 'payment_methods' ? 'المبلغ الإجمالي' : 'التكلفة الإجمالية',
              'النسبة'
            ],
            dataMapping: (item: any) => [
              item.name,
              item.count.toString(),
              formatCurrency(item.total),
              `${item.percentage.toFixed(1)}%`
            ],
            summary: {
              total: totalAmount,
              count: items.reduce((sum: any, i: any) => sum + i.count, 0)
            }
          };
          break;

        case 'suppliers':
          const { data: entitiesData } = await supabase
            .from('entities')
            .select('*')
            .eq('type', 'مورد');

          const { data: receivablesData } = await supabase
            .from('receivables')
            .select('*');

          data = {
            title: 'تقرير الموردين والمستحقات',
            items: entitiesData || [],
            columns: ['اسم المورد', 'الهاتف', 'البريد الإلكتروني', 'المستحقات'],
            dataMapping: (item: any) => {
              const supplierReceivables = (receivablesData || [])
                .filter((r: any) => r.entity_id === item.id)
                .reduce((sum: number, r: any) => sum + r.remaining_amount, 0);

              return [
                item.name,
                item.contact_info?.phone || '-',
                item.contact_info?.email || '-',
                formatCurrency(supplierReceivables)
              ];
            },
            summary: {
              totalReceivables: (receivablesData || [])
                .filter((r: any) => (entitiesData || []).some((e: any) => e.id === r.entity_id))
                .reduce((sum: number, r: any) => sum + r.remaining_amount, 0),
              count: (entitiesData || []).length
            },
            receivables: receivablesData
          };
          break;

        case 'cancelled_orders':
        case 'new_orders':
        case 'locked_orders':
          let query = supabase.from('orders').select('*');

          if (reportType === 'cancelled_orders') {
            query = query.eq('status', 'ملغي');
          } else if (reportType === 'new_orders') {
            query = query.eq('is_locked', false);
          } else if (reportType === 'locked_orders') {
            query = query.eq('is_locked', true);
          }

          const { data: ordersResult } = await query.order('order_date', { ascending: false });

          let filteredOrdersData = ordersResult || [];
          if (dateFrom) {
            filteredOrdersData = filteredOrdersData.filter((o: any) => o.order_date >= dateFrom);
          }
          if (dateTo) {
            filteredOrdersData = filteredOrdersData.filter((o: any) => o.order_date <= dateTo);
          }

          const totalSales = filteredOrdersData.reduce((sum: number, o: any) => sum + o.total_price, 0);
          const totalCost = filteredOrdersData.reduce((sum: number, o: any) => {
            const productCost = (o.products || []).reduce((s: number, p: any) => s + (p.cost || 0) * p.quantity, 0);
            return sum + productCost;
          }, 0);

          let reportTitle = '';
          if (reportType === 'cancelled_orders') reportTitle = 'تقرير الطلبات الملغية';
          else if (reportType === 'new_orders') reportTitle = 'تقرير الطلبات الجديدة';
          else if (reportType === 'locked_orders') reportTitle = 'تقرير الطلبات المقفلة';

          data = {
            title: reportTitle,
            items: filteredOrdersData,
            columns: ['رقم الطلب', 'العميل', 'الهاتف', 'المبلغ', 'طريقة الدفع', 'شركة الشحن', 'الحالة', 'التاريخ'],
            dataMapping: (item: any) => [
              item.id?.slice(-8) || '-',
              item.customer_name,
              item.phone_number || '-',
              formatCurrency(item.total_price),
              item.payment_method || '-',
              item.shipping_company || '-',
              item.status,
              formatDate(item.order_date)
            ],
            summary: {
              totalSales,
              totalCost,
              profit: totalSales - totalCost,
              count: filteredOrdersData.length
            }
          };
          break;

        default:
          toast.error('نوع التقرير غير مدعوم');
          return;
      }

      setPreviewData(data);
      setShowPreview(true);
    } catch (error) {
      console.error('Error fetching report data:', error);
      toast.error('فشل في جلب بيانات التقرير');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!selectedReport) {
      toast.error('الرجاء اختيار نوع التقرير');
      return;
    }

    await fetchReportData(selectedReport);
  };

  const handleExportExcel = async () => {
    if (!previewData) return;

    try {
      const data = previewData.items.map(previewData.dataMapping);

      let summary: any[] = [];
      if (selectedReport === 'expenses') {
        summary = [
          { label: 'إجمالي المصروفات', value: formatCurrency(previewData.summary.total) },
          { label: 'عدد المصروفات', value: previewData.summary.count.toString() }
        ];
      } else if (selectedReport === 'inventory') {
        summary = [
          { label: 'عدد المنتجات', value: previewData.summary.count.toString() },
          { label: 'إجمالي القطع', value: previewData.summary.totalItems.toString() },
          { label: 'القيمة الإجمالية', value: formatCurrency(previewData.summary.totalValue) }
        ];
      } else if (selectedReport === 'employee_balances') {
        summary = [
          { label: 'عدد الموظفين', value: previewData.summary.count.toString() },
          { label: 'إجمالي الأرصدة', value: formatCurrency(previewData.summary.totalBalance) }
        ];
      } else if (selectedReport === 'payment_methods' || selectedReport === 'shipping_companies') {
        summary = [
          { label: selectedReport === 'payment_methods' ? 'إجمالي المعاملات' : 'إجمالي الشحنات', value: previewData.summary.count.toString() },
          { label: selectedReport === 'payment_methods' ? 'إجمالي المبلغ' : 'إجمالي التكلفة', value: formatCurrency(previewData.summary.total) }
        ];
      } else if (selectedReport === 'suppliers') {
        summary = [
          { label: 'عدد الموردين', value: previewData.summary.count.toString() },
          { label: 'إجمالي المستحقات', value: formatCurrency(previewData.summary.totalReceivables) }
        ];
      } else if (selectedReport.includes('orders')) {
        summary = [
          { label: 'عدد الطلبات', value: previewData.summary.count.toString() },
          { label: 'إجمالي المبيعات', value: formatCurrency(previewData.summary.totalSales) },
          { label: 'إجمالي التكاليف', value: formatCurrency(previewData.summary.totalCost) },
          { label: 'صافي الربح', value: formatCurrency(previewData.summary.profit) }
        ];
      }

      await exportToExcel({
        fileName: previewData.title.replace(/\s/g, '_'),
        sheetName: previewData.title,
        title: previewData.title,
        headers: previewData.columns,
        data,
        summary
      });

      toast.success('تم تصدير Excel بنجاح');
    } catch (error) {
      toast.error('فشل تصدير Excel');
      console.error(error);
    }
  };

  const handleExportPDF = async () => {
    const previewElement = document.getElementById('report-preview-content');
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

      pdf.save(`${previewData.title.replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('تم تصدير PDF بنجاح');
    } catch (error) {
      toast.error('فشل تصدير PDF');
      console.error(error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-3 md:p-6">
      <Toaster position="top-center" reverseOrder={false} />

      <div className="max-w-7xl mx-auto">
        {/* العنوان */}
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2">
            <FileText className="h-7 w-7 md:h-8 md:w-8 text-blue-600" />
            التقارير المخصصة
          </h1>
          <p className="text-sm md:text-base text-gray-600">اختر نوع التقرير وقم بتصديره بصيغة Excel أو PDF</p>
        </div>

        {/* بطاقة اختيار التقرير */}
        <div className="bg-white rounded-xl md:rounded-2xl shadow-md border border-gray-200 p-4 md:p-6 mb-6">
          <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Filter className="h-5 w-5 md:h-6 md:w-6 text-blue-600" />
            اختيار التقرير
          </h2>

          {/* شبكة أنواع التقارير */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 mb-6">
            {reportTypes.map((report) => (
              <button
                key={report.id}
                onClick={() => setSelectedReport(report.id)}
                className={`p-4 md:p-5 rounded-xl border-2 transition-all duration-200 text-right ${
                  selectedReport === report.id
                    ? 'border-blue-500 bg-blue-50 shadow-md'
                    : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl md:text-3xl">{report.icon}</span>
                  <div className="flex-1">
                    <h3 className="font-bold text-sm md:text-base text-gray-900 mb-1">{report.name}</h3>
                    <p className="text-xs md:text-sm text-gray-600">{report.description}</p>
                  </div>
                  {selectedReport === report.id && (
                    <div className="h-5 w-5 md:h-6 md:w-6 bg-blue-500 rounded-full flex items-center justify-center">
                      <svg className="h-3 w-3 md:h-4 md:w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* فلتر التواريخ */}
          {selectedReport && !['inventory', 'employee_balances', 'suppliers'].includes(selectedReport) && (
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <h3 className="font-semibold text-sm md:text-base text-gray-900 mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4 md:h-5 md:w-5 text-gray-600" />
                فلتر حسب التاريخ (اختياري)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs md:text-sm text-gray-700 mb-1">من تاريخ</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm md:text-base"
                  />
                </div>
                <div>
                  <label className="block text-xs md:text-sm text-gray-700 mb-1">إلى تاريخ</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm md:text-base"
                  />
                </div>
              </div>
            </div>
          )}

          {/* زر التوليد */}
          <button
            onClick={handleGenerateReport}
            disabled={!selectedReport || loading}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 md:py-4 rounded-xl font-bold text-sm md:text-base hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                جاري التحميل...
              </>
            ) : (
              <>
                <Eye className="h-5 w-5" />
                معاينة التقرير
              </>
            )}
          </button>
        </div>
      </div>

      {/* نافذة المعاينة */}
      {showPreview && previewData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            {/* رأس النافذة */}
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 md:p-6 flex justify-between items-center z-10">
              <h2 className="text-xl md:text-2xl font-bold text-gray-900">معاينة التقرير</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportExcel}
                  className="bg-green-600 text-white px-3 md:px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 text-sm md:text-base"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  <span className="hidden sm:inline">تصدير</span> Excel
                </button>
                <button
                  onClick={handleExportPDF}
                  className="bg-red-600 text-white px-3 md:px-4 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 text-sm md:text-base"
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">تصدير</span> PDF
                </button>
                <button
                  onClick={() => setShowPreview(false)}
                  className="bg-gray-200 text-gray-700 p-2 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* محتوى المعاينة */}
            <div id="report-preview-content" className="p-6 md:p-8 bg-white">
              {/* العنوان */}
              <div className="text-center mb-6 md:mb-8">
                <h1 className="text-2xl md:text-3xl font-bold text-blue-800 mb-2">{previewData.title}</h1>
                <p className="text-sm md:text-base text-gray-600">تاريخ التقرير: {formatDate(new Date().toISOString())}</p>
                {dateFrom && dateTo && (
                  <p className="text-sm text-gray-600 mt-1">
                    الفترة: من {formatDate(dateFrom)} إلى {formatDate(dateTo)}
                  </p>
                )}
              </div>

              {/* الملخص */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 md:p-6 mb-6 md:mb-8">
                <h3 className="text-lg md:text-xl font-bold text-gray-800 mb-4">الملخص</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                  {selectedReport === 'expenses' && (
                    <>
                      <div className="bg-white rounded-lg p-3 md:p-4">
                        <p className="text-xs md:text-sm text-gray-600 mb-1">إجمالي المصروفات</p>
                        <p className="text-lg md:text-2xl font-bold text-blue-600">{formatCurrency(previewData.summary.total)}</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 md:p-4">
                        <p className="text-xs md:text-sm text-gray-600 mb-1">عدد المصروفات</p>
                        <p className="text-lg md:text-2xl font-bold text-gray-900">{previewData.summary.count}</p>
                      </div>
                    </>
                  )}

                  {selectedReport === 'inventory' && (
                    <>
                      <div className="bg-white rounded-lg p-3 md:p-4">
                        <p className="text-xs md:text-sm text-gray-600 mb-1">عدد المنتجات</p>
                        <p className="text-lg md:text-2xl font-bold text-gray-900">{previewData.summary.count}</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 md:p-4">
                        <p className="text-xs md:text-sm text-gray-600 mb-1">إجمالي القطع</p>
                        <p className="text-lg md:text-2xl font-bold text-blue-600">{previewData.summary.totalItems}</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 md:p-4">
                        <p className="text-xs md:text-sm text-gray-600 mb-1">القيمة الإجمالية</p>
                        <p className="text-lg md:text-2xl font-bold text-green-600">{formatCurrency(previewData.summary.totalValue)}</p>
                      </div>
                    </>
                  )}

                  {selectedReport === 'employee_balances' && (
                    <>
                      <div className="bg-white rounded-lg p-3 md:p-4">
                        <p className="text-xs md:text-sm text-gray-600 mb-1">عدد الموظفين</p>
                        <p className="text-lg md:text-2xl font-bold text-gray-900">{previewData.summary.count}</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 md:p-4">
                        <p className="text-xs md:text-sm text-gray-600 mb-1">إجمالي الأرصدة</p>
                        <p className="text-lg md:text-2xl font-bold text-amber-600">{formatCurrency(previewData.summary.totalBalance)}</p>
                      </div>
                    </>
                  )}

                  {(selectedReport === 'payment_methods' || selectedReport === 'shipping_companies') && (
                    <>
                      <div className="bg-white rounded-lg p-3 md:p-4">
                        <p className="text-xs md:text-sm text-gray-600 mb-1">{selectedReport === 'payment_methods' ? 'إجمالي المعاملات' : 'إجمالي الشحنات'}</p>
                        <p className="text-lg md:text-2xl font-bold text-gray-900">{previewData.summary.count}</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 md:p-4">
                        <p className="text-xs md:text-sm text-gray-600 mb-1">{selectedReport === 'payment_methods' ? 'إجمالي المبلغ' : 'إجمالي التكلفة'}</p>
                        <p className="text-lg md:text-2xl font-bold text-blue-600">{formatCurrency(previewData.summary.total)}</p>
                      </div>
                    </>
                  )}

                  {selectedReport === 'suppliers' && (
                    <>
                      <div className="bg-white rounded-lg p-3 md:p-4">
                        <p className="text-xs md:text-sm text-gray-600 mb-1">عدد الموردين</p>
                        <p className="text-lg md:text-2xl font-bold text-gray-900">{previewData.summary.count}</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 md:p-4">
                        <p className="text-xs md:text-sm text-gray-600 mb-1">إجمالي المستحقات</p>
                        <p className="text-lg md:text-2xl font-bold text-red-600">{formatCurrency(previewData.summary.totalReceivables)}</p>
                      </div>
                    </>
                  )}

                  {selectedReport.includes('orders') && (
                    <>
                      <div className="bg-white rounded-lg p-3 md:p-4">
                        <p className="text-xs md:text-sm text-gray-600 mb-1">عدد الطلبات</p>
                        <p className="text-lg md:text-2xl font-bold text-gray-900">{previewData.summary.count}</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 md:p-4">
                        <p className="text-xs md:text-sm text-gray-600 mb-1">إجمالي المبيعات</p>
                        <p className="text-lg md:text-2xl font-bold text-blue-600">{formatCurrency(previewData.summary.totalSales)}</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 md:p-4">
                        <p className="text-xs md:text-sm text-gray-600 mb-1">صافي الربح</p>
                        <p className="text-lg md:text-2xl font-bold text-green-600">{formatCurrency(previewData.summary.profit)}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* الجدول */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-blue-600 text-white">
                      {previewData.columns.map((col: string, idx: number) => (
                        <th key={idx} className="border border-gray-300 px-3 md:px-4 py-2 md:py-3 text-right text-xs md:text-sm font-bold">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.items.map((item: any, idx: number) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                        {previewData.dataMapping(item).map((cell: string, cellIdx: number) => (
                          <td key={cellIdx} className="border border-gray-300 px-3 md:px-4 py-2 md:py-3 text-xs md:text-sm text-gray-900">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomReports;
