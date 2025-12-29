import React, { useState, useEffect, useMemo } from 'react';
import { X, DollarSign, TrendingUp, Search, Download, FileText, Trash2, Filter } from 'lucide-react';
import { supabase } from '../lib/supabase';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import toast from 'react-hot-toast';
import { authService } from '../lib/auth';

interface CancelledOrder {
  id: string;
  order_number: string;
  customer_name: string;
  phone_number: string;
  total_price: number;
  order_date: string;
  cancellation_reason: string;
  cancelled_by: string;
  cancellation_fee: number;
  fee_bearer: 'customer' | 'store';
  created_at?: string;
  updated_at?: string;
}

const CancelledOrders: React.FC = () => {
  const [cancelledOrders, setCancelledOrders] = useState<CancelledOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [showPreview, setShowPreview] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null);

  const currentUser = authService.getCurrentUser();
  const isAdmin = currentUser?.role === 'admin';

  const formatNumericDate = (dateString: string) => {
    const date = new Date(dateString);
    const formatter = new Intl.DateTimeFormat('en-US', {
      calendar: 'gregory',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    return formatter.format(date);
  };

  const formatDateTime = (date: Date) => {
    const formatter = new Intl.DateTimeFormat('en-US', {
      calendar: 'gregory',
      timeZone: 'Asia/Riyadh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
    return formatter.format(date);
  };

  const toEnglishDigits = (str: string) => {
    return str.replace(/[٠-٩]/g, d => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)]);
  };

  const fetchCancelledOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, customer_name, phone_number, total_price, order_date, cancellation_reason, cancelled_by, cancellation_fee, fee_bearer, updated_at')
        .eq('status', 'ملغي')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      setCancelledOrders(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ في جلب البيانات');
    }
  };

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      await fetchCancelledOrders();
      setLoading(false);
    };
    fetchAll();
  }, []);

  const handleExportCancelledOrders = async () => {
    if (filteredCancelledOrders.length === 0) return;
    setExporting('excel');
    try {
      const workbook = new ExcelJS.Workbook();
      const headers = ['رقم الطلب', 'اسم العميل', 'الهاتف', 'الإجمالي', 'تاريخ الإلغاء', 'سبب الإلغاء', 'ملغي بواسطة', 'رسوم الإلغاء', 'يحمل الرسوم'];
      const cancelledWorksheet = workbook.addWorksheet('الطلبات الملغية', {
        pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true },
        properties: { defaultColWidth: 20 },
        views: [{ rightToLeft: true }]
      });

      cancelledWorksheet.mergeCells('A1:I1');
      const titleCell = cancelledWorksheet.getCell('A1');
      titleCell.value = 'تقرير الطلبات الملغية';
      titleCell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

      const now = new Date();
      cancelledWorksheet.mergeCells('A2:I2');
      const dateCell = cancelledWorksheet.getCell('A2');
      dateCell.value = `تاريخ التصدير: ${formatDateTime(now)}`;
      dateCell.font = { size: 12, italic: true };
      dateCell.alignment = { horizontal: 'center' };

      const headerRow = cancelledWorksheet.addRow(headers);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
      headerRow.eachCell((cell) => {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });

      let totalFee = 0;
      filteredCancelledOrders.forEach((order, index) => {
        const row = cancelledWorksheet.addRow([
          `#${order.order_number}`,
          order.customer_name,
          order.phone_number,
          `${order.total_price.toLocaleString('EN-US')} ر.س`,
          formatNumericDate(order.updated_at || order.order_date),
          order.cancellation_reason,
          order.cancelled_by,
          `${order.cancellation_fee.toLocaleString('EN-US')} ر.س`,
          order.fee_bearer === 'customer' ? 'العميل' : 'المتجر'
        ]);
        totalFee += order.cancellation_fee;
        row.eachCell((cell, colNumber) => {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          if (colNumber === 4 || colNumber === 8) cell.numFmt = '#,##0.00';
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });
        if (index % 2 === 0) {
          row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
        }
      });

      cancelledWorksheet.addRow([]);
      const totalRow = cancelledWorksheet.addRow(['', '', '', '', '', '', '', `إجمالي الرسوم: ${totalFee.toLocaleString('EN-US')} ر.س`, '']);
      totalRow.font = { bold: true };
      totalRow.getCell(8).font = { bold: true, color: { argb: 'FF166534' } };
      totalRow.getCell(8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
      totalRow.eachCell(cell => {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const fileName = `الطلبات_الملغية_${new Date().toISOString().split('T')[0]}.xlsx`;
      saveAs(new Blob([buffer]), fileName);
      toast.success('تم تصدير الملف بنجاح');
    } catch (err) {
      toast.error('حدث خطأ أثناء التصدير');
    } finally {
      setExporting(null);
    }
  };

  const handleExportPDF = async () => {
    const previewElement = document.getElementById('cancelled-orders-preview-content');
    if (!previewElement) return;
    setExporting('pdf');
    try {
      const canvas = await html2canvas(previewElement, {
        scale: window.innerWidth < 768 ? 1.5 : 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: previewElement.scrollWidth,
        height: previewElement.scrollHeight
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

      const fileName = `الطلبات_الملغية_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
      toast.success('تم تصدير الملف بنجاح');
    } catch (err) {
      console.error('Error generating PDF:', err);
      toast.error('حدث خطأ أثناء التصدير');
    } finally {
      setExporting(null);
    }
  };

  const handleDeleteClick = (orderId: string) => {
    setDeletingOrderId(orderId);
    setShowDeleteModal(true);
  };

  const executeDelete = async () => {
    if (!deletingOrderId) return;

    try {
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', deletingOrderId);

      if (error) throw error;

      toast.success('تم حذف الطلب بنجاح');
      setCancelledOrders(prev => prev.filter(o => o.id !== deletingOrderId));
      setShowDeleteModal(false);
      setDeletingOrderId(null);
    } catch (err) {
      console.error('Error deleting order:', err);
      toast.error('حدث خطأ أثناء حذف الطلب');
    }
  };

  const filteredCancelledOrders = useMemo(() => {
    let filtered = cancelledOrders.filter(order => {
      const matchesSearch = order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.cancellation_reason.toLowerCase().includes(searchTerm.toLowerCase());

      const orderDate = new Date(order.updated_at || order.order_date);
      let matchesDate = true;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const lastWeek = new Date(today);
      lastWeek.setDate(lastWeek.getDate() - 7);

      switch (dateFilter) {
        case 'today':
          matchesDate = orderDate.toDateString() === today.toDateString();
          break;
        case 'yesterday':
          matchesDate = orderDate.toDateString() === yesterday.toDateString();
          break;
        case 'last_week':
          matchesDate = orderDate >= lastWeek && orderDate <= today;
          break;
        case 'custom':
          const from = fromDate ? new Date(fromDate) : null;
          const to = toDate ? new Date(toDate) : null;
          if (from && to) {
            matchesDate = orderDate >= from && orderDate <= to;
          }
          break;
        default:
          matchesDate = true;
      }
      return matchesSearch && matchesDate;
    });
    return filtered;
  }, [cancelledOrders, searchTerm, dateFilter, fromDate, toDate]);

  const totalPages = Math.ceil(filteredCancelledOrders.length / itemsPerPage);
  const paginatedCancelledOrders = filteredCancelledOrders.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalFees = cancelledOrders.reduce((sum, order) => sum + order.cancellation_fee, 0);

  const getLastWeekDates = () => {
    const today = new Date();
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);
    return {
      from: lastWeek.toISOString().split('T')[0],
      to: today.toISOString().split('T')[0]
    };
  };

  useEffect(() => {
    if (dateFilter === 'last_week') {
      const dates = getLastWeekDates();
      setFromDate(dates.from);
      setToDate(dates.to);
    }
  }, [dateFilter]);

  if (loading) {
    return (
      <div className="p-4 sm:p-6 min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center animate-pulse">
          <div className="h-12 bg-gray-200 rounded-xl w-48 mx-auto mb-8"></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl w-full">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6">
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-6 bg-gray-200 rounded w-3/4 mx-auto"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6 min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 sm:p-8 max-w-md w-full text-center">
          <X className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-800 text-lg font-medium mb-2">خطأ في التحميل</p>
          <p className="text-red-600">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 min-h-screen bg-gray-50">
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex-1">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1">الطلبات الملغية</h2>
            <p className="text-gray-600 text-sm sm:text-base">عرض الطلبات الملغية مع تفاصيل الإلغاء والرسوم</p>
          </div>
          <button
            onClick={() => setShowPreview(true)}
            className="w-full lg:w-auto bg-red-600 hover:bg-red-700 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
            aria-label="معاينة وتصدير التقرير"
          >
            <FileText className="h-4 w-4" />
            <span>معاينة وتصدير</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-red-100 text-red-600 p-3 rounded-xl">
              <X className="h-6 w-6" />
            </div>
            <TrendingUp className="h-5 w-5 text-red-500" />
          </div>
          <div>
            <h3 className="text-3xl font-bold text-gray-900 mb-1">{cancelledOrders.length.toLocaleString('EN-US')}</h3>
            <p className="text-gray-600 text-sm">إجمالي الطلبات الملغية</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-orange-100 text-orange-600 p-3 rounded-xl">
              <DollarSign className="h-6 w-6" />
            </div>
            <TrendingUp className="h-5 w-5 text-orange-500" />
          </div>
          <div>
            <h3 className="text-3xl font-bold text-gray-900 mb-1">{totalFees.toLocaleString('EN-US')} <span className="text-lg font-normal text-gray-500">ر.س</span></h3>
            <p className="text-gray-600 text-sm">إجمالي رسوم الإلغاء</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-lg p-6 sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-purple-100 text-purple-600 p-3 rounded-xl">
              <Filter className="h-6 w-6" />
            </div>
            <TrendingUp className="h-5 w-5 text-purple-500" />
          </div>
          <div>
            <h3 className="text-3xl font-bold text-gray-900 mb-1">{filteredCancelledOrders.length.toLocaleString('EN-US')}</h3>
            <p className="text-gray-600 text-sm">الطلبات المفلترة</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="search"
              placeholder="البحث بالعميل أو السبب أو رقم الطلب..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-4 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200"
              aria-label="البحث في الطلبات"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 bg-white"
              aria-label="فلترة حسب التاريخ"
            >
              <option value="all">جميع التواريخ</option>
              <option value="today">اليوم</option>
              <option value="yesterday">أمس</option>
              <option value="last_week">آخر أسبوع</option>
              <option value="custom">تاريخ مخصص</option>
            </select>
            {dateFilter === 'custom' && (
              <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-xl border border-gray-200">
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="px-2 py-2 bg-transparent border-none focus:ring-0 text-sm"
                />
                <span className="text-gray-400">-</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="px-2 py-2 bg-transparent border-none focus:ring-0 text-sm"
                />
              </div>
            )}
            {dateFilter === 'last_week' && (
              <div className="flex items-center px-4 bg-gray-50 rounded-xl border border-gray-200 text-sm text-gray-600">
                من {formatNumericDate(getLastWeekDates().from)} إلى {formatNumericDate(getLastWeekDates().to)}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            قائمة الطلبات الملغية
            <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full">{paginatedCancelledOrders.length} من {filteredCancelledOrders.length}</span>
          </h3>
        </div>

        {/* عرض الجوال - بطاقات */}
        <div className="block sm:hidden space-y-3 sm:space-y-4 p-4 bg-gray-50">
          {paginatedCancelledOrders.map((order) => (
            <article key={order.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-3 transition-shadow duration-200 hover:shadow-md">
              <div className="flex justify-between items-start gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="bg-red-50 p-2 rounded-lg flex-shrink-0">
                    <X className="h-5 w-5 text-red-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-gray-900 text-sm truncate" title={`#${order.order_number}`}>#{toEnglishDigits(order.order_number)}</p>
                    <p className="text-xs text-gray-500">{formatNumericDate(order.updated_at || order.order_date)}</p>
                  </div>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => handleDeleteClick(order.id)}
                    className="p-2 hover:bg-red-50 rounded-lg transition-colors duration-200 flex-shrink-0 text-red-500"
                    aria-label={`حذف الطلب رقم ${order.order_number}`}
                    title="حذف نهائي"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                )}
              </div>

              <div className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-gray-500 text-xs mb-1">العميل</p>
                    <p className="font-medium text-gray-900 truncate" title={order.customer_name}>{order.customer_name}</p>
                    <p className="text-xs text-gray-400 truncate" title={order.phone_number}>{toEnglishDigits(order.phone_number)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs mb-1">الإجمالي</p>
                    <p className="font-medium text-gray-900">{order.total_price.toLocaleString('EN-US')} ر.س</p>
                  </div>
                </div>
                <div>
                  <p className="text-gray-500 text-xs mb-1">سبب الإلغاء</p>
                  <p className="font-medium text-gray-700 bg-gray-50 p-2 rounded-lg text-xs leading-relaxed border border-gray-100 overflow-hidden" title={order.cancellation_reason}>
                    {order.cancellation_reason}
                  </p>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                  <div>
                    <p className="text-gray-500 text-xs mb-1">رسوم الإلغاء</p>
                    <p className="font-bold text-red-600 text-sm">{order.cancellation_fee.toLocaleString('EN-US')} ر.س</p>
                  </div>
                  <span className={`inline-flex px-2 py-1 rounded-md text-xs font-medium ${order.fee_bearer === 'customer' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {order.fee_bearer === 'customer' ? 'العميل' : 'المتجر'}
                  </span>
                </div>
                <div className="pt-1">
                  <p className="text-gray-400 text-[10px]">ملغي بواسطة: {order.cancelled_by}</p>
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* عرض سطح المكتب والتابلت - جدول */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">رقم الطلب</th>
                <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">اسم العميل</th>
                <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الهاتف</th>
                <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الإجمالي</th>
                <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">تاريخ الإلغاء</th>
                <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">سبب الإلغاء</th>
                <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">ملغي بواسطة</th>
                <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">رسوم الإلغاء</th>
                <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">يحمل الرسوم</th>
                <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">إجراءات</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedCancelledOrders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50 transition-colors duration-150">
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <X className="h-4 w-4 text-red-400 ml-2 sm:ml-3" />
                      <span className="text-sm font-medium text-gray-900">#{toEnglishDigits(order.order_number)}</span>
                    </div>
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 max-w-xs truncate" title={order.customer_name}>
                    {order.customer_name}
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {toEnglishDigits(order.phone_number)}
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {order.total_price.toLocaleString('EN-US')} ر.س
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {formatNumericDate(order.updated_at || order.order_date)}
                  </td>
                  <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">
                    <div className="max-w-[200px] overflow-x-auto whitespace-nowrap pb-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent" title={order.cancellation_reason}>
                      {order.cancellation_reason}
                    </div>
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {order.cancelled_by}
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {order.cancellation_fee.toLocaleString('EN-US')} ر.س
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${order.fee_bearer === 'customer'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                      }`}>
                      {order.fee_bearer === 'customer' ? 'العميل' : 'المتجر'}
                    </span>
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-left">
                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteClick(order.id)}
                        className="text-red-600 hover:text-red-900 p-2 hover:bg-red-50 rounded-full transition-all duration-200"
                        aria-label={`حذف الطلب رقم ${order.order_number}`}
                        title="حذف نهائي"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="bg-gray-50 px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row items-center justify-between border-t border-gray-200 gap-3 sm:gap-0">
            <div className="text-xs sm:text-sm text-gray-700 order-2 sm:order-1">
              عرض {(currentPage - 1) * itemsPerPage + 1} إلى {Math.min(currentPage * itemsPerPage, filteredCancelledOrders.length)} من {filteredCancelledOrders.length} طلب
            </div>
            <div className="flex items-center gap-1 sm:gap-2 order-1 sm:order-2 justify-center sm:justify-end w-full sm:w-auto">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 min-w-[80px]"
              >
                السابق
              </button>
              <div className="flex gap-1">
                {[...Array(Math.min(5, totalPages))].map((_, i) => {
                  const pageNum = currentPage - 2 + i;
                  if (pageNum < 1 || pageNum > totalPages) return null;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md transition-all duration-200 min-w-[40px] ${currentPage === pageNum
                        ? 'bg-red-600 text-white border-red-600 shadow-sm'
                        : 'hover:bg-gray-50'
                        }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 min-w-[80px]"
              >
                التالي
              </button>
            </div>
          </div>
        )}
      </div>

      {filteredCancelledOrders.length === 0 && !loading && (
        <div className="text-center py-12 sm:py-16">
          <X className="h-12 w-12 sm:h-16 sm:w-16 text-gray-400 mx-auto mb-4 sm:mb-6" />
          <h3 className="text-lg sm:text-xl font-medium text-gray-900 mb-2">لا توجد طلبات ملغية</h3>
          <p className="text-gray-600 text-sm sm:text-base mb-4">لم يتم إلغاء أي طلبات بعد</p>
          <button
            onClick={() => setSearchTerm('')}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200"
          >
            مسح الفلاتر
          </button>
        </div>
      )}

      {/* مودال تأكيد الحذف */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-title">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <h3 id="delete-title" className="text-lg font-medium text-gray-900 mb-2">تأكيد الحذف النهائي</h3>
              <p className="text-sm text-gray-500 mb-6">
                هل أنت متأكد من رغبتك في حذف هذا الطلب نهائياً؟ لا يمكن التراجع عن هذا الإجراء.
              </p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200 flex-1 sm:flex-none"
                >
                  إلغاء
                </button>
                <button
                  onClick={executeDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200 flex-1 sm:flex-none"
                >
                  حذف نهائي
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* مودال معاينة التقرير */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl max-w-4xl sm:max-w-6xl w-full max-h-[95vh] overflow-y-auto shadow-2xl animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
            <div className="sticky top-0 bg-white border-b px-4 sm:px-6 lg:px-8 py-4 sm:py-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 z-10 rounded-t-2xl">
              <h3 className="text-xl sm:text-2xl font-bold flex items-center gap-2 sm:gap-3">
                <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />
                معاينة تقرير الطلبات الملغية
              </h3>
              <div className="flex flex-wrap gap-2 justify-center sm:justify-end w-full sm:w-auto">
                <button
                  onClick={handleExportPDF}
                  disabled={exporting === 'pdf'}
                  className="px-4 py-2 bg-red-600 disabled:bg-red-400 text-white rounded-lg hover:bg-red-700 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2 disabled:opacity-75"
                >
                  {exporting === 'pdf' && <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />}
                  <Download className="h-4 w-4" />
                  <span>PDF</span>
                </button>
                <button
                  onClick={handleExportCancelledOrders}
                  disabled={exporting === 'excel'}
                  className="px-4 py-2 bg-green-600 disabled:bg-green-400 text-white rounded-lg hover:bg-green-700 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2 disabled:opacity-75"
                >
                  {exporting === 'excel' && <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />}
                  <Download className="h-4 w-4" />
                  <span>Excel</span>
                </button>
                <button
                  onClick={() => setShowPreview(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200 ml-auto sm:ml-0"
                  aria-label="إغلاق المعاينة"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6 lg:p-8">
              <div id="cancelled-orders-preview-content" className="bg-white print:bg-white" dir="rtl">
                <div className="text-center mb-6 sm:mb-8 border-b pb-4 sm:pb-6">
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">تقرير الطلبات الملغية</h1>
                  <p className="text-gray-600 text-sm sm:text-base">تاريخ التقرير: {formatDateTime(new Date())}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 sm:p-6 text-center">
                    <p className="text-base sm:text-lg text-gray-700 mb-2">عدد الطلبات الملغية</p>
                    <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-red-600">{filteredCancelledOrders.length}</p>
                  </div>
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 sm:p-6 text-center">
                    <p className="text-base sm:text-lg text-gray-700 mb-2">إجمالي قيمة الطلبات</p>
                    <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-orange-600">
                      {filteredCancelledOrders.reduce((sum, o) => sum + o.total_price, 0).toLocaleString('EN-US')} ر.س
                    </p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 sm:p-6 text-center">
                    <p className="text-base sm:text-lg text-gray-700 mb-2">إجمالي رسوم الإلغاء</p>
                    <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-blue-600">
                      {filteredCancelledOrders.reduce((sum, o) => sum + o.cancellation_fee, 0).toLocaleString('EN-US')} ر.س
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-300 min-w-[600px]">
                    <thead>
                      <tr className="bg-red-600 text-white">
                        <th className="border border-gray-300 px-3 sm:px-4 py-3 text-right text-sm font-semibold">رقم الطلب</th>
                        <th className="border border-gray-300 px-3 sm:px-4 py-3 text-right text-sm font-semibold">العميل</th>
                        <th className="border border-gray-300 px-3 sm:px-4 py-3 text-right text-sm font-semibold">المبلغ</th>
                        <th className="border border-gray-300 px-3 sm:px-4 py-3 text-right text-sm font-semibold">التاريخ</th>
                        <th className="border border-gray-300 px-3 sm:px-4 py-3 text-right text-sm font-semibold">السبب</th>
                        <th className="border border-gray-300 px-3 sm:px-4 py-3 text-right text-sm font-semibold">الرسوم</th>
                        <th className="border border-gray-300 px-3 sm:px-4 py-3 text-right text-sm font-semibold">يحمل الرسوم</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCancelledOrders.map((order, index) => (
                        <tr key={order.id} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                          <td className="border border-gray-300 px-3 sm:px-4 py-3 font-mono text-right text-sm">#{order.order_number}</td>
                          <td className="border border-gray-300 px-3 sm:px-4 py-3 text-sm max-w-xs truncate" title={order.customer_name}>{order.customer_name}</td>
                          <td className="border border-gray-300 px-3 sm:px-4 py-3 text-right font-bold text-gray-900 text-sm">
                            {order.total_price.toLocaleString('EN-US')} ر.س
                          </td>
                          <td className="border border-gray-300 px-3 sm:px-4 py-3 text-sm">{formatNumericDate(order.updated_at || order.order_date)}</td>
                          <td className="border border-gray-300 px-3 sm:px-4 py-3 text-sm max-w-xs truncate" title={order.cancellation_reason}>{order.cancellation_reason}</td>
                          <td className="border border-gray-300 px-3 sm:px-4 py-3 text-right font-bold text-red-600 text-sm">
                            {order.cancellation_fee.toLocaleString('EN-US')} ر.س
                          </td>
                          <td className="border border-gray-300 px-3 sm:px-4 py-3 text-center">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${order.fee_bearer === 'customer' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                              }`}>
                              {order.fee_bearer === 'customer' ? 'العميل' : 'المتجر'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CancelledOrders;