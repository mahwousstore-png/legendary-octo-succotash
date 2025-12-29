import React, { useState, useEffect, useMemo } from 'react';
import { Truck, TrendingUp, Search, Download, FileText, Eye, DollarSign, Plus, X as CloseIcon, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface ShippingCompanyStats {
  company: string;
  shipmentCount: number;
  totalOwed: number;
  totalPaid: number;
  remaining: number;
  company_id?: string; // إضافة هذا الحقل
}

interface ShippingCompanyPayment {
  id: string;
  company_name: string;
  amount: number;
  payment_date: string;
  notes: string;
  created_at: string;
}

const TAX_RATE = 0.15;

const ShippingCompanies: React.FC = () => {
  const [companies, setCompanies] = useState<{ id: string; company_name: string }[]>([]);
  const [stats, setStats] = useState<ShippingCompanyStats[]>([]);
  const [payments, setPayments] = useState<ShippingCompanyPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<ShippingCompanyStats | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewMode, setPreviewMode] = useState<'single' | 'all'>('all');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showAddCompanyModal, setShowAddCompanyModal] = useState(false); // إضافة state لـ modal الشركة الجديدة
  const [newCompanyName, setNewCompanyName] = useState(''); // state لاسم الشركة الجديدة
  const [paymentFormData, setPaymentFormData] = useState({
    company_name: '',
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const formatCurrency = (value: number) =>
    `${value.toLocaleString('EN-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س`;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ar-SA', {
      calendar: 'gregory',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date);
  };

  const fetchShippingData = async () => {
    try {
      // جلب الشركات أولاً للحصول على IDs
      const { data: companiesData, error: companiesError } = await supabase
        .from('shipping_companies')
        .select('id, company_name')
        .eq('is_active', true)
        .order('company_name');
     
      if (companiesError) {
        console.error('Error fetching companies:', companiesError);
        // يمكنك إضافة toast.error هنا إذا أردت
      }
     
      setCompanies(companiesData || []);

      // جلب الطلبات
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('shipping_company, shipping_cost, shipping_bearer, is_locked')
        .eq('is_locked', true)
        .not('shipping_company', 'is', null);
     
      if (ordersError) throw ordersError;

      // جلب الدفعات
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('shipping_company_payments')
        .select('*')
        .order('payment_date', { ascending: false });
     
      if (paymentsError && paymentsError.code !== 'PGRST116') {
        console.error('Error fetching payments:', paymentsError);
      }
     
      setPayments(paymentsData || []);

      // حساب الإحصائيات الأساسية
      const companyMap = new Map<string, ShippingCompanyStats>();
      orders?.forEach((order: any) => {
        const company = order.shipping_company || 'غير محدد';
        const shippingCost = parseFloat(order.shipping_cost || '0');
        const costWithTax = shippingCost * (1 + TAX_RATE);
        const bearer = order.shipping_bearer;
        const owed = bearer === 'customer' ? 0 : costWithTax;
       
        if (!companyMap.has(company)) {
          companyMap.set(company, {
            company,
            shipmentCount: 0,
            totalOwed: 0,
            totalPaid: 0,
            remaining: 0,
            company_id: null // إضافة حقل company_id
          });
        }
       
        const stat = companyMap.get(company)!;
        stat.shipmentCount += 1;
        stat.totalOwed += owed;
      });

      // إضافة الدفعات إلى الإحصائيات
      paymentsData?.forEach((payment: ShippingCompanyPayment) => {
        const company = payment.company_name;
        if (companyMap.has(company)) {
          const stat = companyMap.get(company)!;
          stat.totalPaid += parseFloat(payment.amount.toString());
        }
      });

      // تحويل إلى مصفوفة وإضافة company_id من قائمة الشركات
      const statsArray = Array.from(companyMap.values()).map(stat => ({
        ...stat,
        remaining: stat.totalOwed - stat.totalPaid,
        company_id: companiesData?.find(c => c.company_name === stat.company)?.id || null
      }));

      setStats(statsArray.sort((a, b) => b.totalOwed - a.totalOwed));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ في جلب البيانات');
      console.error('Error in fetchShippingData:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShippingData();
  }, []);

  const filteredStats = useMemo(() => {
    return stats.filter(stat =>
      stat.company.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [stats, searchTerm]);

  const totalShipments = stats.reduce((sum, s) => sum + s.shipmentCount, 0);
  const totalOwed = stats.reduce((sum, s) => sum + s.totalOwed, 0);
  const totalPaid = stats.reduce((sum, s) => sum + s.totalPaid, 0);
  const totalRemaining = stats.reduce((sum, s) => sum + s.remaining, 0);

  // دالة إضافة شركة جديدة
  const handleAddNewCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) {
      toast.error('يرجى إدخال اسم الشركة');
      return;
    }
    try {
      const { error } = await supabase
        .from('shipping_companies')
        .insert([{
          company_name: newCompanyName.trim(),
          is_active: true
        }])
        .select('id, company_name');
      if (error) throw error;
      toast.success('تم إضافة الشركة بنجاح');
      setShowAddCompanyModal(false);
      setNewCompanyName('');
      await fetchShippingData(); // إعادة تحميل البيانات
    } catch (err) {
      console.error('Error adding company:', err);
      toast.error('فشل في إضافة الشركة: ' + (err instanceof Error ? err.message : 'خطأ غير معروف'));
    }
  };

  const handleExportExcel = async (company?: string) => {
    const workbook = new ExcelJS.Workbook();
    const dataToExport = company
      ? filteredStats.filter(s => s.company === company)
      : filteredStats;
    const headers = ['شركة الشحن', 'عدد الشحنات', 'المستحق', 'المدفوع', 'المتبقي'];
    const worksheet = workbook.addWorksheet(company || 'جميع شركات الشحن', {
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true },
      properties: { defaultColWidth: 20 },
      views: [{ rightToLeft: true }]
    });
    worksheet.mergeCells('A1:E1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = company ? `تقرير شركة ${company}` : 'تقرير شركات الشحن';
    titleCell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    const now = new Date();
    worksheet.mergeCells('A2:E2');
    const dateCell = worksheet.getCell('A2');
    dateCell.value = `تاريخ التصدير: ${formatDate(now.toISOString())}`;
    dateCell.font = { size: 12, italic: true };
    dateCell.alignment = { horizontal: 'center' };
    const headerRow = worksheet.addRow(headers);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    headerRow.eachCell((cell) => {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
    let totalCount = 0;
    let sumOwed = 0;
    let sumPaid = 0;
    let sumRemaining = 0;
    dataToExport.forEach((stat, index) => {
      const row = worksheet.addRow([
        stat.company,
        stat.shipmentCount,
        stat.totalOwed.toFixed(2),
        stat.totalPaid.toFixed(2),
        stat.remaining.toFixed(2)
      ]);
      totalCount += stat.shipmentCount;
      sumOwed += stat.totalOwed;
      sumPaid += stat.totalPaid;
      sumRemaining += stat.remaining;
      row.eachCell((cell, colNumber) => {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        if (colNumber >= 3) cell.numFmt = '#,##0.00';
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
      if (index % 2 === 0) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
      }
    });
    worksheet.addRow([]);
    const totalRow = worksheet.addRow([
      'الإجمالي',
      totalCount,
      sumOwed.toFixed(2),
      sumPaid.toFixed(2),
      sumRemaining.toFixed(2)
    ]);
    totalRow.font = { bold: true };
    totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
    totalRow.eachCell((cell, colNumber) => {
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      if (colNumber >= 3) {
        cell.numFmt = '#,##0.00';
        cell.font = { bold: true, color: { argb: 'FF166534' } };
      }
    });
    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = company
      ? `شركة_${company}_${new Date().toISOString().split('T')[0]}.xlsx`
      : `شركات_الشحن_${new Date().toISOString().split('T')[0]}.xlsx`;
    saveAs(new Blob([buffer]), fileName);
  };

  const handleExportPDF = async () => {
    const previewElement = document.getElementById('pdf-preview-content');
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
      const fileName =
        previewMode === 'single' && selectedCompany
          ? `شركة_${selectedCompany.company}_${new Date().toISOString().split('T')[0]}.pdf`
          : `شركات_الشحن_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('حدث خطأ أثناء إنشاء ملف PDF');
    }
  };

  const handlePreview = (company?: ShippingCompanyStats) => {
    if (company) {
      setSelectedCompany(company);
      setPreviewMode('single');
    } else {
      setSelectedCompany(null);
      setPreviewMode('all');
    }
    setShowPreview(true);
  };

  const handleAddPayment = (company?: ShippingCompanyStats) => {
    if (company) {
      setPaymentFormData({
        company_name: company.company,
        amount: company.remaining.toString(),
        payment_date: new Date().toISOString().split('T')[0],
        notes: ''
      });
    } else {
      setPaymentFormData({
        company_name: '',
        amount: '',
        payment_date: new Date().toISOString().split('T')[0],
        notes: ''
      });
    }
    setShowPaymentModal(true);
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedCompany = companies.find(c => c.company_name === paymentFormData.company_name);
    if (!selectedCompany?.id) {
      toast.error('يرجى اختيار شركة شحن صالحة');
      return;
    }
    try {
      const { error } = await supabase
        .from('shipping_company_payments')
        .insert([{
          company_id: selectedCompany.id, // ← الإضافة الرئيسية
          company_name: paymentFormData.company_name,
          amount: parseFloat(paymentFormData.amount),
          payment_date: paymentFormData.payment_date,
          notes: paymentFormData.notes
        }]);
      if (error) throw error;
      toast.success('تم تسجيل الدفعة بنجاح');
      setShowPaymentModal(false);
      setPaymentFormData({
        company_name: '',
        amount: '',
        payment_date: new Date().toISOString().split('T')[0],
        notes: ''
      });
      await fetchShippingData(); // إعادة تحميل لتحديث الـ stats
    } catch (err) {
      console.error('Error adding payment:', err);
      toast.error('فشل تسجيل الدفعة: ' + (err instanceof Error ? err.message : 'خطأ غير معروف'));
    }
  };

  if (loading) {
    return (
      <div className="p-6 min-h-screen bg-gray-50">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl p-6">
                <div className="h-12 bg-gray-200 rounded mb-4"></div>
                <div className="h-6 bg-gray-200 rounded mb-2"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 min-h-screen bg-gray-50">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-800">خطأ: {error}</p>
        </div>
      </div>
    );
  }

  const PreviewContent = () => {
    const dataToPreview =
      previewMode === 'single' && selectedCompany ? [selectedCompany] : filteredStats;
    const previewTotalShipments = dataToPreview.reduce((sum, s) => sum + s.shipmentCount, 0);
    const previewTotalOwed = dataToPreview.reduce((sum, s) => sum + s.totalOwed, 0);
    const previewTotalPaid = dataToPreview.reduce((sum, s) => sum + s.totalPaid, 0);
    const previewTotalRemaining = dataToPreview.reduce((sum, s) => sum + s.remaining, 0);
    return (
      <div id="pdf-preview-content" className="bg-white p-8" dir="rtl">
        <div className="text-center mb-8 border-b pb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {previewMode === 'single' && selectedCompany
              ? `تقرير شركة ${selectedCompany.company}`
              : 'تقرير شركات الشحن'}
          </h1>
          <p className="text-gray-600">تاريخ التقرير: {formatDate(new Date().toISOString())}</p>
        </div>
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
            <p className="text-sm text-blue-600 mb-1">عدد الشحنات</p>
            <p className="text-2xl font-bold text-blue-900">{previewTotalShipments}</p>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
            <p className="text-sm text-orange-600 mb-1">المستحق</p>
            <p className="text-xl font-bold text-orange-900">{formatCurrency(previewTotalOwed)}</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
            <p className="text-sm text-green-600 mb-1">المدفوع</p>
            <p className="text-xl font-bold text-green-900">{formatCurrency(previewTotalPaid)}</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
            <p className="text-sm text-red-600 mb-1">المتبقي</p>
            <p className="text-xl font-bold text-red-900">{formatCurrency(previewTotalRemaining)}</p>
          </div>
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-blue-600 text-white">
              <th className="border border-gray-300 px-4 py-3 text-right">شركة الشحن</th>
              <th className="border border-gray-300 px-4 py-3 text-right">عدد الشحنات</th>
              <th className="border border-gray-300 px-4 py-3 text-right">المستحق</th>
              <th className="border border-gray-300 px-4 py-3 text-right">المدفوع</th>
              <th className="border border-gray-300 px-4 py-3 text-right">المتبقي</th>
            </tr>
          </thead>
          <tbody>
            {dataToPreview.map((stat, index) => (
              <tr key={stat.company} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                <td className="border border-gray-300 px-4 py-3 font-medium">{stat.company}</td>
                <td className="border border-gray-300 px-4 py-3 text-center">{stat.shipmentCount}</td>
                <td className="border border-gray-300 px-4 py-3 text-right">
                  {formatCurrency(stat.totalOwed)}
                </td>
                <td className="border border-gray-300 px-4 py-3 text-right text-green-700">
                  {formatCurrency(stat.totalPaid)}
                </td>
                <td className="border border-gray-300 px-4 py-3 text-right text-red-700 font-medium">
                  {formatCurrency(stat.remaining)}
                </td>
              </tr>
            ))}
            <tr className="bg-green-50 font-bold">
              <td className="border border-gray-300 px-4 py-3">الإجمالي</td>
              <td className="border border-gray-300 px-4 py-3 text-center">{previewTotalShipments}</td>
              <td className="border border-gray-300 px-4 py-3 text-right">
                {formatCurrency(previewTotalOwed)}
              </td>
              <td className="border border-gray-300 px-4 py-3 text-right text-green-700">
                {formatCurrency(previewTotalPaid)}
              </td>
              <td className="border border-gray-300 px-4 py-3 text-right text-red-700">
                {formatCurrency(previewTotalRemaining)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="p-6 min-h-screen bg-gray-50">
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">شركات الشحن</h2>
            <p className="text-gray-600">إدارة ومتابعة المستحقات مع شركات الشحن</p>
          </div>
          <div className="flex gap-2">
            {/* زر إضافة شركة جديدة */}
            <button
              onClick={() => setShowAddCompanyModal(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors duration-200 flex items-center space-x-2 space-x-reverse"
            >
              <Plus className="h-4 w-4" />
              <span>إضافة شركة شحن</span>
            </button>
            <button
              onClick={() => handleAddPayment()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center space-x-2 space-x-reverse"
            >
              <Plus className="h-4 w-4" />
              <span>تسجيل دفعة</span>
            </button>
            <button
              onClick={() => handlePreview()}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors duration-200 flex items-center space-x-2 space-x-reverse"
            >
              <Eye className="h-4 w-4" />
              <span>معاينة الكل</span>
            </button>
            <button
              onClick={() => handleExportExcel()}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center space-x-2 space-x-reverse"
            >
              <Download className="h-4 w-4" />
              <span>تصدير Excel</span>
            </button>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-blue-100 text-blue-600 p-3 rounded-lg">
              <Truck className="h-6 w-6" />
            </div>
            <TrendingUp className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-gray-900 mb-1">{totalShipments}</h3>
            <p className="text-gray-600 text-sm">إجمالي الشحنات</p>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-orange-100 text-orange-600 p-3 rounded-lg">
              <DollarSign className="h-6 w-6" />
            </div>
            <TrendingUp className="h-5 w-5 text-orange-500" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-gray-900 mb-1">{formatCurrency(totalOwed)}</h3>
            <p className="text-gray-600 text-sm">إجمالي المستحق</p>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-green-100 text-green-600 p-3 rounded-lg">
              <DollarSign className="h-6 w-6" />
            </div>
            <TrendingUp className="h-5 w-5 text-green-500" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-gray-900 mb-1">{formatCurrency(totalPaid)}</h3>
            <p className="text-gray-600 text-sm">إجمالي المدفوع</p>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-red-100 text-red-600 p-3 rounded-lg">
              <DollarSign className="h-6 w-6" />
            </div>
            <TrendingUp className="h-5 w-5 text-red-500" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-gray-900 mb-1">{formatCurrency(totalRemaining)}</h3>
            <p className="text-gray-600 text-sm">المتبقي</p>
          </div>
        </div>
      </div>
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="البحث عن شركة شحن..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-4 pr-12 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">قائمة شركات الشحن</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  شركة الشحن
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  عدد الشحنات
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  المستحق
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  المدفوع
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  المتبقي
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  الإجراءات
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredStats.map((stat) => (
                <tr key={stat.company} className="hover:bg-gray-50 transition-colors duration-150">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Truck className="h-4 w-4 text-gray-400 ml-3" />
                      <span className="text-sm font-medium text-gray-900">{stat.company}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                    {stat.shipmentCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-orange-700">
                    {formatCurrency(stat.totalOwed)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-700">
                    {formatCurrency(stat.totalPaid)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-700">
                    {formatCurrency(stat.remaining)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <button
                        onClick={() => handlePreview(stat)}
                        className="text-blue-600 hover:text-blue-900 p-1 rounded transition-colors duration-150"
                        title="معاينة"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleExportExcel(stat.company)}
                        className="text-green-600 hover:text-green-900 p-1 rounded transition-colors duration-150"
                        title="تصدير Excel"
                      >
                        <FileText className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {filteredStats.length === 0 && (
        <div className="text-center py-12">
          <Truck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">لا توجد شركات شحن</h3>
          <p className="text-gray-600">لم يتم تسجيل أي شحنات بعد</p>
        </div>
      )}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-6xl w-full max-h-[95vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b px-8 py-5 flex justify-between items-center z-10 rounded-t-2xl">
              <h3 className="text-2xl font-bold flex items-center gap-3">
                <FileText className="h-7 w-7 text-blue-600" />
                معاينة التقرير
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={handleExportPDF}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200 flex items-center space-x-2 space-x-reverse"
                >
                  <Download className="h-4 w-4" />
                  <span>تصدير PDF</span>
                </button>
                <button
                  onClick={() =>
                    handleExportExcel(
                      previewMode === 'single' && selectedCompany ? selectedCompany.company : undefined
                    )
                  }
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center space-x-2 space-x-reverse"
                >
                  <Download className="h-4 w-4" />
                  <span>تصدير Excel</span>
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
              <PreviewContent />
            </div>
          </div>
        </div>
      )}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl">
            <div className="bg-blue-600 text-white px-8 py-5 rounded-t-2xl flex justify-between items-center">
              <h3 className="text-2xl font-bold flex items-center gap-3">
                <DollarSign className="h-7 w-7" />
                تسجيل دفعة جديدة
              </h3>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="p-2 hover:bg-blue-700 rounded-lg transition-colors duration-200"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmitPayment} className="p-8 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  شركة الشحن
                </label>
                <select
                  value={paymentFormData.company_name}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, company_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">اختر شركة الشحن</option>
                  {companies.map((company) => {
                    const stat = stats.find(s => s.company === company.company_name);
                    const remaining = stat ? stat.remaining : 0;
                    return (
                      <option key={company.id} value={company.company_name}>
                        {company.company_name} - متبقي: {formatCurrency(remaining)}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  المبلغ المدفوع (ر.س)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={paymentFormData.amount}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, amount: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  تاريخ الدفع
                </label>
                <input
                  type="date"
                  value={paymentFormData.payment_date}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, payment_date: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ملاحظات (اختياري)
                </label>
                <textarea
                  value={paymentFormData.notes}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, notes: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows={3}
                  placeholder="أضف ملاحظات إضافية..."
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center justify-center space-x-2 space-x-reverse font-medium"
                >
                  <Save className="h-5 w-5" />
                  <span>حفظ الدفعة</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors duration-200 font-medium"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal إضافة شركة جديدة */}
      {showAddCompanyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl">
            <div className="bg-indigo-600 text-white px-6 py-5 rounded-t-2xl flex justify-between items-center">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Truck className="h-6 w-6" />
                إضافة شركة شحن جديدة
              </h3>
              <button
                onClick={() => {
                  setShowAddCompanyModal(false);
                  setNewCompanyName('');
                }}
                className="p-1 hover:bg-indigo-700 rounded-lg transition-colors duration-200"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleAddNewCompany} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  اسم الشركة
                </label>
                <input
                  type="text"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="أدخل اسم الشركة..."
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors duration-200 flex items-center justify-center space-x-2 space-x-reverse font-medium"
                >
                  <Save className="h-4 w-4" />
                  <span>حفظ الشركة</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddCompanyModal(false);
                    setNewCompanyName('');
                  }}
                  className="flex-1 bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 transition-colors duration-200 font-medium"
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
};

export default ShippingCompanies;