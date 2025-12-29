import React, { useState, useEffect, useMemo } from 'react';
import { Plus, CreditCard as Edit, Trash2, Calendar, DollarSign, Package, TrendingUp, Search, Download, ShoppingBag, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { authService } from '../lib/auth';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface InventoryItem {
  id: string;
  product_name: string;
  cost_price: number;
  purchase_date: string;
  quantity: number;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

const Inventory: React.FC = () => {
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [showPreview, setShowPreview] = useState(false);
  const [formData, setFormData] = useState({
    product_name: '',
    cost_price: '',
    purchase_date: '',
    quantity: ''
  });

  const formatNumericDate = (dateString: string) => {
    const date = new Date(dateString);
    const formatter = new Intl.DateTimeFormat('ar-SA', {
      calendar: 'gregory',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    return formatter.format(date);
  };

  const formatDateTime = (date: Date) => {
    const formatter = new Intl.DateTimeFormat('ar-SA', {
      calendar: 'gregory',
      timeZone: 'Asia/Riyadh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    return formatter.format(date);
  };

  const fetchInventory = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .order('purchase_date', { ascending: false });
      if (error) throw error;
      setInventoryItems(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ في جلب البيانات');
    }
  };

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      await fetchInventory();
      setLoading(false);
    };
    fetchAll();
  }, []);

  const handleExportInventory = async () => {
    if (filteredInventory.length === 0) return;
    const workbook = new ExcelJS.Workbook();
    const headers = ['اسم المنتج', 'سعر التكلفة', 'الكمية', 'تاريخ الشراء'];
    const inventoryWorksheet = workbook.addWorksheet('المخزون', {
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true },
      properties: { defaultColWidth: 20 },
      views: [{ rightToLeft: true }]
    });

    inventoryWorksheet.mergeCells('A1:D1');
    const titleCell = inventoryWorksheet.getCell('A1');
    titleCell.value = 'تقرير المخزون';
    titleCell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    const now = new Date();
    inventoryWorksheet.mergeCells('A2:D2');
    const dateCell = inventoryWorksheet.getCell('A2');
    dateCell.value = `تاريخ التصدير: ${formatDateTime(now)}`;
    dateCell.font = { size: 12, italic: true };
    dateCell.alignment = { horizontal: 'center' };

    const headerRow = inventoryWorksheet.addRow(headers);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    headerRow.eachCell((cell) => {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });

    let totalCost = 0;
    let totalQuantity = 0;
    filteredInventory.forEach((item, index) => {
      const row = inventoryWorksheet.addRow([
        item.product_name,
        `${item.cost_price.toLocaleString('EN-US')} ر.س`,
        item.quantity,
        formatNumericDate(item.purchase_date)
      ]);
      totalCost += item.cost_price * item.quantity;
      totalQuantity += item.quantity;
      row.eachCell((cell, colNumber) => {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        if (colNumber === 2) cell.numFmt = '#,##0.00';
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });
      if (index % 2 === 0) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
      }
    });

    inventoryWorksheet.addRow([]);
    const totalRow = inventoryWorksheet.addRow(['', '', `الإجمالي: ${totalQuantity} وحدة - ${totalCost.toLocaleString('EN-US')} ر.س`, '']);
    totalRow.font = { bold: true };
    totalRow.getCell(3).font = { bold: true, color: { argb: 'FF166534' } };
    totalRow.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
    totalRow.eachCell(cell => {
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `المخزون_${new Date().toISOString().split('T')[0]}.xlsx`;
    saveAs(new Blob([buffer]), fileName);
  };

  const handleExportPDF = async () => {
    const previewElement = document.getElementById('inventory-preview-content');
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

      const fileName = `المخزون_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
    } catch (err) {
      console.error('Error generating PDF:', err);
    }
  };

  const filteredInventory = useMemo(() => {
    let filtered = inventoryItems.filter(item => {
      const matchesSearch = item.product_name.toLowerCase().includes(searchTerm.toLowerCase());

      const itemDate = new Date(item.purchase_date);
      let matchesDate = true;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const lastWeek = new Date(today);
      lastWeek.setDate(lastWeek.getDate() - 7);

      switch (dateFilter) {
        case 'today':
          matchesDate = itemDate.toDateString() === today.toDateString();
          break;
        case 'yesterday':
          matchesDate = itemDate.toDateString() === yesterday.toDateString();
          break;
        case 'last_week':
          matchesDate = itemDate >= lastWeek && itemDate <= today;
          break;
        case 'custom':
          const from = fromDate ? new Date(fromDate) : null;
          const to = toDate ? new Date(toDate) : null;
          if (from && to) {
            matchesDate = itemDate >= from && itemDate <= to;
          }
          break;
        default:
          matchesDate = true;
      }
      return matchesSearch && matchesDate;
    });
    return filtered;
  }, [inventoryItems, searchTerm, dateFilter, fromDate, toDate]);

  const totalPages = Math.ceil(filteredInventory.length / itemsPerPage);
  const paginatedInventory = filteredInventory.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalValue = inventoryItems.reduce((sum, item) => sum + (item.cost_price * item.quantity), 0);
  const totalQuantity = inventoryItems.reduce((sum, item) => sum + item.quantity, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const itemData = {
        product_name: formData.product_name,
        cost_price: parseFloat(formData.cost_price),
        purchase_date: formData.purchase_date,
        quantity: parseInt(formData.quantity)
      };
      if (editingItem) {
        const { error } = await supabase
          .from('inventory')
          .update(itemData)
          .eq('id', editingItem.id);
        if (error) throw error;
      } else {
        // Get current user from authService
        const currentUser = authService.getCurrentUser();

        let createdBy = 'غير معروف';

        if (currentUser) {
          createdBy = currentUser.full_name || currentUser.email || 'غير معروف';
        }

        const { error } = await supabase
          .from('inventory')
          .insert([{
            ...itemData,
            created_by: createdBy
          }]);
        if (error) throw error;
      }
      await fetchInventory();
      setFormData({
        product_name: '',
        cost_price: '',
        purchase_date: '',
        quantity: ''
      });
      setShowAddForm(false);
      setEditingItem(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ في حفظ البيانات');
    }
  };

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setFormData({
      product_name: item.product_name,
      cost_price: item.cost_price.toString(),
      purchase_date: item.purchase_date,
      quantity: item.quantity.toString()
    });
    setShowAddForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا العنصر من المخزون؟')) return;
    try {
      const { error } = await supabase
        .from('inventory')
        .delete()
        .eq('id', id);
      if (error) throw error;
      await fetchInventory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ في حذف البيانات');
    }
  };

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
      <div className="p-6 min-h-screen bg-gray-50">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl p-6">
                <div className="h-12 bg-gray-200 rounded mb-4"></div>
                <div className="h-6 bg-gray-200 rounded mb-2"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  if (error) {
    return (
      <div className="p-6 min-h-screen bg-gray-50">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-800">خطأ: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 min-h-screen bg-gray-50">
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">إدارة المخزون</h2>
            <p className="text-gray-600">تسجيل وتتبع عناصر المخزون</p>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center space-x-2 space-x-reverse"
          >
            <Plus className="h-4 w-4" />
            <span>إضافة عنصر</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-blue-100 text-blue-600 p-3 rounded-lg">
              <Package className="h-6 w-6" />
            </div>
            <TrendingUp className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-gray-900 mb-1">{totalQuantity.toLocaleString('EN-US')}</h3>
            <p className="text-gray-600 text-sm">إجمالي الكمية</p>
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
            <h3 className="text-2xl font-bold text-gray-900 mb-1">{totalValue.toLocaleString('EN-US')} ر.س</h3>
            <p className="text-gray-600 text-sm">إجمالي قيمة المخزون</p>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="البحث في المنتجات..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-4 pr-12 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="all">جميع التواريخ</option>
              <option value="today">اليوم</option>
              <option value="yesterday">أمس</option>
              <option value="last_week">آخر أسبوع</option>
              <option value="custom">تاريخ مخصص</option>
            </select>
            {dateFilter === 'custom' && (
              <div className="flex gap-2">
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                <span className="text-gray-500 self-center">-</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            )}
            {dateFilter === 'last_week' && (
              <span className="text-sm text-gray-500 self-center px-2">
                من {formatNumericDate(getLastWeekDates().from)} إلى {formatNumericDate(getLastWeekDates().to)}
              </span>
            )}
            <button
              onClick={() => setShowPreview(true)}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200 flex items-center space-x-2 space-x-reverse"
            >
              <FileText className="h-4 w-4" />
              <span>معاينة وتصدير</span>
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">سجلات المخزون</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">اسم المنتج</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">سعر التكلفة</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الكمية</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">تاريخ الشراء</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">أنشأ بواسطة</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedInventory.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors duration-150">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Package className="h-4 w-4 text-gray-400 ml-3" />
                      <span className="text-sm font-medium text-gray-900">{item.product_name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {item.cost_price.toLocaleString('EN-US')} ر.س
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.quantity}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {formatNumericDate(item.purchase_date)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {item.created_by || 'غير محدد'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <button
                        onClick={() => handleEdit(item)}
                        className="text-blue-600 hover:text-blue-900 p-1 rounded transition-colors duration-150"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-red-600 hover:text-red-900 p-1 rounded transition-colors duration-150"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="bg-gray-50 px-6 py-3 flex items-center justify-between border-t border-gray-200">
            <div className="text-sm text-gray-700">
              عرض {(currentPage - 1) * itemsPerPage + 1} إلى {Math.min(currentPage * itemsPerPage, filteredInventory.length)} من {filteredInventory.length} عنصر
            </div>
            <div className="flex items-center space-x-2 space-x-reverse">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                السابق
              </button>
              {[...Array(Math.min(5, totalPages))].map((_, i) => {
                const pageNum = i + 1;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-3 py-1 text-sm border border-gray-300 rounded-md ${currentPage === pageNum
                      ? 'bg-green-600 text-white border-green-600'
                      : 'hover:bg-gray-50'
                      }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                التالي
              </button>
            </div>
          </div>
        )}
      </div>

      {filteredInventory.length === 0 && (
        <div className="text-center py-12">
          <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">لا توجد عناصر في المخزون</h3>
          <p className="text-gray-600">أضف عنصرًا جديدًا للبدء</p>
        </div>
      )}

      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center mb-8 border-b border-gray-200 pb-4">
              <div className="flex items-center space-x-2 space-x-reverse">
                <Package className="h-6 w-6 text-green-600" />
                <h3 className="text-2xl font-bold text-gray-900">
                  {editingItem ? 'تعديل العنصر' : 'إضافة عنصر مخزون جديد'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setEditingItem(null);
                  setFormData({
                    product_name: '',
                    cost_price: '',
                    purchase_date: '',
                    quantity: ''
                  });
                }}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center space-x-2 space-x-reverse">
                    <ShoppingBag className="h-4 w-4 text-gray-500" />
                    <span>اسم المنتج</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.product_name}
                    onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200"
                    placeholder="أدخل اسم المنتج"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center space-x-2 space-x-reverse">
                    <DollarSign className="h-4 w-4 text-gray-500" />
                    <span>سعر التكلفة</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.cost_price}
                    onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 text-right"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center space-x-2 space-x-reverse">
                    <Package className="h-4 w-4 text-gray-500" />
                    <span>الكمية</span>
                  </label>
                  <input
                    type="number"
                    required
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 text-right"
                    placeholder="0"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center space-x-2 space-x-reverse">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <span>تاريخ الشراء</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.purchase_date}
                    onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200"
                  />
                </div>
              </div>
              <div className="flex gap-4 pt-6">
                <button
                  type="submit"
                  className="flex-1 bg-green-600 text-white py-3 px-6 rounded-xl hover:bg-green-700 transition-all duration-200 font-semibold flex items-center justify-center space-x-2 space-x-reverse"
                >
                  <Plus className="h-5 w-5" />
                  <span>{editingItem ? 'تحديث العنصر' : 'إضافة العنصر'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingItem(null);
                    setFormData({
                      product_name: '',
                      cost_price: '',
                      purchase_date: '',
                      quantity: ''
                    });
                  }}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 px-6 rounded-xl hover:bg-gray-300 transition-all duration-200 font-semibold"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* مودال معاينة التقرير */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[95vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b px-8 py-5 flex justify-between items-center z-10 rounded-t-2xl">
              <h3 className="text-2xl font-bold flex items-center gap-3">
                <FileText className="h-7 w-7 text-green-600" />
                معاينة تقرير المخزون
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
                  onClick={handleExportInventory}
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
              <div id="inventory-preview-content" className="bg-white" dir="rtl">
                <div className="text-center mb-8 border-b pb-6">
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">تقرير المخزون</h1>
                  <p className="text-gray-600">تاريخ التقرير: {formatDateTime(new Date())}</p>
                </div>

                <div className="grid grid-cols-3 gap-6 mb-8">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                    <p className="text-lg text-gray-700 mb-2">عدد المنتجات</p>
                    <p className="text-4xl font-bold text-green-600">{filteredInventory.length}</p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
                    <p className="text-lg text-gray-700 mb-2">إجمالي الكميات</p>
                    <p className="text-4xl font-bold text-blue-600">
                      {filteredInventory.reduce((sum, item) => sum + item.quantity, 0)} وحدة
                    </p>
                  </div>
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-6 text-center">
                    <p className="text-lg text-gray-700 mb-2">إجمالي التكلفة</p>
                    <p className="text-3xl font-bold text-orange-600">
                      {filteredInventory.reduce((sum, item) => sum + (item.cost_price * item.quantity), 0).toLocaleString('EN-US')} ر.س
                    </p>
                  </div>
                </div>

                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-green-600 text-white">
                      <th className="border border-gray-300 px-4 py-3 text-right">اسم المنتج</th>
                      <th className="border border-gray-300 px-4 py-3 text-right">سعر التكلفة</th>
                      <th className="border border-gray-300 px-4 py-3 text-right">الكمية</th>
                      <th className="border border-gray-300 px-4 py-3 text-right">الإجمالي</th>
                      <th className="border border-gray-300 px-4 py-3 text-right">تاريخ الشراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInventory.map((item, index) => (
                      <tr key={item.id} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                        <td className="border border-gray-300 px-4 py-3 font-medium">{item.product_name}</td>
                        <td className="border border-gray-300 px-4 py-3 text-right text-blue-700">
                          {item.cost_price.toLocaleString('EN-US')} ر.س
                        </td>
                        <td className="border border-gray-300 px-4 py-3 text-right font-bold text-green-700">
                          {item.quantity} وحدة
                        </td>
                        <td className="border border-gray-300 px-4 py-3 text-right font-bold text-orange-700">
                          {(item.cost_price * item.quantity).toLocaleString('EN-US')} ر.س
                        </td>
                        <td className="border border-gray-300 px-4 py-3">{formatNumericDate(item.purchase_date)}</td>
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

export default Inventory;
