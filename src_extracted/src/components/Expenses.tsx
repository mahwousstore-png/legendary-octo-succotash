import React, { useState, useEffect, useMemo } from 'react';
import { Plus, CreditCard as Edit, Trash2, Calendar, DollarSign, Tag, FileText, TrendingUp, Search, Download, List } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { authService } from '../lib/auth';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

interface Category {
  id: string;
  name: string;
  created_at?: string;
}

const Expenses: React.FC = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: '',
    date: ''
  });

  const [categoryFormData, setCategoryFormData] = useState({
    name: ''
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

  const fetchExpenses = async () => {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('date', { ascending: false });
      if (error) throw error;
      setExpenses(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ في جلب البيانات');
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      setCategories(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ في جلب الفئات');
    }
  };

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      await Promise.all([fetchExpenses(), fetchCategories()]);
      setLoading(false);
    };
    fetchAll();
  }, []);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryFormData.name.trim()) return;
    try {
      const { error } = await supabase
        .from('categories')
        .insert([{ name: categoryFormData.name.trim() }]);
      if (error) throw error;
      setCategoryFormData({ name: '' });
      await fetchCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ في إضافة الفئة');
    }
  };

  const handleEditCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !categoryFormData.name.trim()) return;
    try {
      const { error } = await supabase
        .from('categories')
        .update({ name: categoryFormData.name.trim() })
        .eq('id', editingCategory.id);
      if (error) throw error;
      setEditingCategory(null);
      setCategoryFormData({ name: '' });
      await fetchCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ في تحديث الفئة');
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه الفئة؟ سيتم حذفها من قاعدة البيانات، لكن المصروفات المرتبطة ستحتفظ بالاسم.')) return;
    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', categoryId);
      if (error) throw error;
      await fetchCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ في حذف الفئة');
    }
  };

  const handleExportExpenses = async () => {
    if (filteredExpenses.length === 0) return;
    const workbook = new ExcelJS.Workbook();
    const headers = ['الوصف', 'الفئة', 'المبلغ', 'التاريخ'];
    const generalWorksheet = workbook.addWorksheet('جميع المصروفات', {
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true },
      properties: { defaultColWidth: 20 },
      views: [{ rightToLeft: true }]
    });

    generalWorksheet.mergeCells('A1:D1');
    const titleCell = generalWorksheet.getCell('A1');
    titleCell.value = 'تقرير المصروفات';
    titleCell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    const now = new Date();
    generalWorksheet.mergeCells('A2:D2');
    const dateCell = generalWorksheet.getCell('A2');
    dateCell.value = `تاريخ التصدير: ${formatDateTime(now)}`;
    dateCell.font = { size: 12, italic: true };
    dateCell.alignment = { horizontal: 'center' };

    const headerRow = generalWorksheet.addRow(headers);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    headerRow.eachCell((cell) => {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });

    let totalAmount = 0;
    filteredExpenses.forEach((expense, index) => {
      const row = generalWorksheet.addRow([
        expense.description,
        expense.category,
        `${expense.amount.toLocaleString('EN-US')} ر.س`,
        formatNumericDate(expense.date)
      ]);
      totalAmount += expense.amount;
      row.eachCell((cell, colNumber) => {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        if (colNumber === 3) cell.numFmt = '#,##0.00';
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });
      if (index % 2 === 0) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
      }
    });

    generalWorksheet.addRow([]);
    const totalRow = generalWorksheet.addRow(['', '', `الإجمالي: ${totalAmount.toLocaleString('EN-US')} ر.س`, '']);
    totalRow.font = { bold: true };
    totalRow.getCell(3).font = { bold: true, color: { argb: 'FF166534' } };
    totalRow.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
    totalRow.eachCell(cell => {
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
    });

    const groupedByCategory: Record<string, Expense[]> = {};
    filteredExpenses.forEach(expense => {
      if (!groupedByCategory[expense.category]) {
        groupedByCategory[expense.category] = [];
      }
      groupedByCategory[expense.category].push(expense);
    });

    Object.keys(groupedByCategory).forEach(category => {
      const categoryExpenses = groupedByCategory[category];
      const ws = workbook.addWorksheet(category, {
        pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true },
        properties: { defaultColWidth: 20 },
        views: [{ rightToLeft: true }]
      });

      ws.mergeCells('A1:D1');
      const catTitleCell = ws.getCell('A1');
      catTitleCell.value = `مصروفات: ${category}`;
      catTitleCell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
      catTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
      catTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

      ws.mergeCells('A2:D2');
      const catDateCell = ws.getCell('A2');
      catDateCell.value = `تاريخ التصدير: ${formatDateTime(now)}`;
      catDateCell.font = { size: 12, italic: true };
      catDateCell.alignment = { horizontal: 'center' };

      const catHeaderRow = ws.addRow(headers);
      catHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      catHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
      catHeaderRow.eachCell((cell) => {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });

      let catTotal = 0;
      categoryExpenses.forEach((expense, index) => {
        const row = ws.addRow([
          expense.description,
          expense.category,
          `${expense.amount.toLocaleString('EN-US')} ر.س`,
          formatNumericDate(expense.date)
        ]);
        catTotal += expense.amount;
        row.eachCell((cell, colNumber) => {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          if (colNumber === 3) cell.numFmt = '#,##0.00';
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });
        if (index % 2 === 0) {
          row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
        }
      });

      ws.addRow([]);
      const catTotalRow = ws.addRow(['', '', `الإجمالي: ${catTotal.toLocaleString('EN-US')} ر.س`, '']);
      catTotalRow.font = { bold: true };
      catTotalRow.getCell(3).font = { bold: true, color: { argb: 'FF166534' } };
      catTotalRow.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
      catTotalRow.eachCell(cell => {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `المصروفات_${new Date().toISOString().split('T')[0]}.xlsx`;
    saveAs(new Blob([buffer]), fileName);
  };

  const handleExportPDF = async () => {
    const previewElement = document.getElementById('expenses-preview-content');
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

      const fileName = `المصروفات_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
    } catch (err) {
      console.error('Error generating PDF:', err);
    }
  };

  const filteredExpenses = useMemo(() => {
    let filtered = expenses.filter(expense => {
      const matchesSearch = expense.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        expense.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = filterCategory === 'all' || expense.category === filterCategory;

      const expenseDate = new Date(expense.date);
      let matchesDate = true;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const lastWeek = new Date(today);
      lastWeek.setDate(lastWeek.getDate() - 7);

      switch (dateFilter) {
        case 'today':
          matchesDate = expenseDate.toDateString() === today.toDateString();
          break;
        case 'yesterday':
          matchesDate = expenseDate.toDateString() === yesterday.toDateString();
          break;
        case 'last_week':
          matchesDate = expenseDate >= lastWeek && expenseDate <= today;
          break;
        case 'custom':
          const from = fromDate ? new Date(fromDate) : null;
          const to = toDate ? new Date(toDate) : null;
          if (from && to) {
            matchesDate = expenseDate >= from && expenseDate <= to;
          }
          break;
        default:
          matchesDate = true;
      }
      return matchesSearch && matchesCategory && matchesDate;
    });
    return filtered;
  }, [expenses, searchTerm, filterCategory, dateFilter, fromDate, toDate]);

  const totalPages = Math.ceil(filteredExpenses.length / itemsPerPage);
  const paginatedExpenses = filteredExpenses.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const expenseData = {
        description: formData.description,
        amount: parseFloat(formData.amount),
        category: formData.category,
        date: formData.date
      };
      if (editingExpense) {
        const { error } = await supabase
          .from('expenses')
          .update(expenseData)
          .eq('id', editingExpense.id);
        if (error) throw error;
      } else {
        // Get current user from authService
        const currentUser = authService.getCurrentUser();

        console.log('🔍 Current User:', currentUser);

        let createdBy = 'غير معروف';

        if (currentUser) {
          createdBy = currentUser.full_name || currentUser.email || 'غير معروف';
          console.log('📝 Final created_by value:', createdBy);
        } else {
          console.log('⚠️ No current user found');
        }

        const expenseToInsert = {
          ...expenseData,
          created_by: createdBy
        };

        console.log('💾 Inserting expense:', expenseToInsert);

        const { error } = await supabase
          .from('expenses')
          .insert([expenseToInsert]);
        if (error) throw error;
      }
      await fetchExpenses();
      setFormData({
        description: '',
        amount: '',
        category: '',
        date: ''
      });
      setShowAddForm(false);
      setEditingExpense(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ في حفظ البيانات');
    }
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setFormData({
      description: expense.description,
      amount: expense.amount.toString(),
      category: expense.category,
      date: expense.date
    });
    setShowAddForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا المصروف؟')) return;
    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);
      if (error) throw error;
      await fetchExpenses();
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
          <div className="grid grid-cols-1 md:grid-cols-1 gap-6 mb-8">
            {[...Array(1)].map((_, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl p-6">
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
            <h2 className="text-2xl font-bold text-gray-900 mb-2">إدارة المصروفات</h2>
            <p className="text-gray-600">تتبع وإدارة مصروفات عملك</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCategoriesModal(true)}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors duration-200 flex items-center space-x-2 space-x-reverse"
            >
              <List className="h-4 w-4" />
              <span>الفئات</span>
            </button>
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center space-x-2 space-x-reverse"
            >
              <Plus className="h-4 w-4" />
              <span>إضافة مصروف</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-1 gap-6 mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-blue-100 text-blue-600 p-3 rounded-lg">
              <DollarSign className="h-6 w-6" />
            </div>
            <TrendingUp className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-gray-900 mb-1">{totalExpenses.toLocaleString('EN-US')} ر.س</h3>
            <p className="text-gray-600 text-sm">إجمالي المصروفات</p>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="البحث في المصروفات..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-4 pr-12 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={filterCategory}
              onChange={(e) => {
                setFilterCategory(e.target.value);
                setCurrentPage(1);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">جميع الفئات</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.name}>{cat.name}</option>
              ))}
            </select>
            <select
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  className="px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <span className="text-gray-500 self-center">-</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
          <h3 className="text-lg font-semibold text-gray-900">سجلات المصروفات</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الوصف</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الفئة</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">المبلغ</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">التاريخ</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">أنشأ بواسطة</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedExpenses.map((expense) => (
                <tr key={expense.id} className="hover:bg-gray-50 transition-colors duration-150">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <FileText className="h-4 w-4 text-gray-400 ml-3" />
                      <span className="text-sm font-medium text-gray-900">{expense.description}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {expense.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {expense.amount.toLocaleString('EN-US')} ر.س
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {formatNumericDate(expense.date)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {expense.created_by || 'غير محدد'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <button
                        onClick={() => handleEdit(expense)}
                        className="text-blue-600 hover:text-blue-900 p-1 rounded transition-colors duration-150"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(expense.id)}
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
              عرض {(currentPage - 1) * itemsPerPage + 1} إلى {Math.min(currentPage * itemsPerPage, filteredExpenses.length)} من {filteredExpenses.length} مصروف
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
                      ? 'bg-blue-600 text-white border-blue-600'
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

      {filteredExpenses.length === 0 && (
        <div className="text-center py-12">
          <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">لا توجد مصروفات</h3>
          <p className="text-gray-600">أضف مصروفًا جديدًا للبدء</p>
        </div>
      )}

      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center mb-8 border-b border-gray-200 pb-4">
              <div className="flex items-center space-x-2 space-x-reverse">
                <DollarSign className="h-6 w-6 text-blue-600" />
                <h3 className="text-2xl font-bold text-gray-900">
                  {editingExpense ? 'تعديل المصروف' : 'إضافة مصروف جديد'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setEditingExpense(null);
                  setFormData({
                    description: '',
                    amount: '',
                    category: '',
                    date: ''
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
                    <FileText className="h-4 w-4 text-gray-500" />
                    <span>الوصف</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                    placeholder="أدخل وصف المصروف"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center space-x-2 space-x-reverse">
                    <DollarSign className="h-4 w-4 text-gray-500" />
                    <span>المبلغ</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-right"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center space-x-2 space-x-reverse">
                    <Tag className="h-4 w-4 text-gray-500" />
                    <span>الفئة</span>
                  </label>
                  <select
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                  >
                    <option value="">اختر الفئة</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center space-x-2 space-x-reverse">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <span>التاريخ</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                  />
                </div>
              </div>
              <div className="flex gap-4 pt-6">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-xl hover:bg-blue-700 transition-all duration-200 font-semibold flex items-center justify-center space-x-2 space-x-reverse"
                >
                  <Plus className="h-5 w-5" />
                  <span>{editingExpense ? 'تحديث المصروف' : 'إضافة المصروف'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingExpense(null);
                    setFormData({
                      description: '',
                      amount: '',
                      category: '',
                      date: ''
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

      {showCategoriesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center mb-8 border-b border-gray-200 pb-4">
              <div className="flex items-center space-x-2 space-x-reverse">
                <Tag className="h-6 w-6 text-blue-600" />
                <h3 className="text-2xl font-bold text-gray-900">إدارة الفئات</h3>
              </div>
              <button
                onClick={() => {
                  setShowCategoriesModal(false);
                  setEditingCategory(null);
                  setCategoryFormData({ name: '' });
                }}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
              >
                ✕
              </button>
            </div>
            <div className="space-y-6">
              <div className="grid gap-4">
                {categories.map(cat => (
                  <div key={cat.id} className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center justify-between hover:bg-gray-100 transition-all duration-200">
                    <span className="text-lg font-medium text-gray-900">{cat.name}</span>
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <button
                        onClick={() => {
                          setEditingCategory(cat);
                          setCategoryFormData({ name: cat.name });
                        }}
                        className="text-blue-600 hover:text-blue-900 p-2 rounded transition-colors duration-150"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="text-red-600 hover:text-red-900 p-2 rounded transition-colors duration-150"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-200 pt-6">
                <form onSubmit={editingCategory ? handleEditCategory : handleAddCategory} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {editingCategory ? 'تعديل الفئة' : 'إضافة فئة جديدة'}
                    </label>
                    <input
                      type="text"
                      required
                      value={categoryFormData.name}
                      onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                      placeholder={editingCategory ? "أدخل الاسم الجديد" : "أدخل اسم الفئة"}
                    />
                  </div>
                  <div className="flex gap-4 pt-4">
                    <button
                      type="submit"
                      className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-xl hover:bg-blue-700 transition-all duration-200 font-semibold flex items-center justify-center space-x-2 space-x-reverse"
                    >
                      <Edit className="h-5 w-5" />
                      <span>{editingCategory ? 'تحديث الفئة' : 'إضافة الفئة'}</span>
                    </button>
                    {editingCategory && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCategory(null);
                          setCategoryFormData({ name: '' });
                        }}
                        className="flex-1 bg-gray-200 text-gray-700 py-3 px-6 rounded-xl hover:bg-gray-300 transition-all duration-200 font-semibold"
                      >
                        إلغاء
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* مودال معاينة التقرير */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[95vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b px-8 py-5 flex justify-between items-center z-10 rounded-t-2xl">
              <h3 className="text-2xl font-bold flex items-center gap-3">
                <FileText className="h-7 w-7 text-indigo-600" />
                معاينة تقرير المصروفات
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
                  onClick={handleExportExpenses}
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
              <div id="expenses-preview-content" className="bg-white" dir="rtl">
                <div className="text-center mb-8 border-b pb-6">
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">تقرير المصروفات</h1>
                  <p className="text-gray-600">تاريخ التقرير: {formatDateTime(new Date())}</p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8 text-center">
                  <p className="text-lg text-gray-700 mb-2">إجمالي المصروفات</p>
                  <p className="text-4xl font-bold text-blue-600">
                    {filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0).toLocaleString('EN-US')} ر.س
                  </p>
                  <p className="text-sm text-gray-600 mt-2">عدد المصروفات: {filteredExpenses.length}</p>
                </div>

                {categories.map(category => {
                  const categoryExpenses = filteredExpenses.filter(e => e.category === category.name);
                  if (categoryExpenses.length === 0) return null;
                  const categoryTotal = categoryExpenses.reduce((sum, exp) => sum + exp.amount, 0);

                  return (
                    <div key={category.id} className="mb-8">
                      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-4">
                        <div className="flex justify-between items-center">
                          <h2 className="text-xl font-bold text-indigo-800">{category.name}</h2>
                          <div className="text-right">
                            <p className="text-sm text-gray-600">عدد المصروفات: {categoryExpenses.length}</p>
                            <p className="text-lg font-bold text-indigo-600">{categoryTotal.toLocaleString('EN-US')} ر.س</p>
                          </div>
                        </div>
                      </div>
                      <table className="w-full border-collapse mb-6">
                        <thead>
                          <tr className="bg-indigo-600 text-white">
                            <th className="border border-gray-300 px-4 py-3 text-right">الوصف</th>
                            <th className="border border-gray-300 px-4 py-3 text-right">المبلغ</th>
                            <th className="border border-gray-300 px-4 py-3 text-right">التاريخ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {categoryExpenses.map((expense, index) => (
                            <tr key={expense.id} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                              <td className="border border-gray-300 px-4 py-3">{expense.description}</td>
                              <td className="border border-gray-300 px-4 py-3 text-right font-bold text-blue-700">
                                {expense.amount.toLocaleString('EN-US')} ر.س
                              </td>
                              <td className="border border-gray-300 px-4 py-3">{formatNumericDate(expense.date)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;
