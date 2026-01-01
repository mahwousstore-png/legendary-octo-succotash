import React, { useState, useEffect, useMemo } from 'react';
import { Plus, CreditCard as Edit, Trash2, Calendar, DollarSign, Tag, FileText, TrendingUp, Search, Download, List, AlertCircle, CheckCircle, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { authService } from '../lib/auth';
import toast, { Toaster } from 'react-hot-toast';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { formatDateTime } from '../lib/dateFormatter'; // استيراد دالة formatDateTime المركزية
import GlobalPeriodFilter from './GlobalPeriodFilter';
import { usePeriodFilter } from '../lib/usePeriodFilter';

interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  user_id?: string;
  balance_transaction_id?: string;
  deducted_from_custody?: boolean;
  status?: 'pending' | 'approved' | 'rejected';
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
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
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [employeeBalance, setEmployeeBalance] = useState<number>(0);
  const [deductFromCustody, setDeductFromCustody] = useState<boolean>(false);

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

  const truncateText = (text: string, maxLength: number = 50) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
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

  const fetchEmployeeBalance = async () => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) return;

    try {
      const { data, error } = await supabase
        .from('employee_balance_transactions')
        .select('amount, status')
        .eq('user_id', currentUser.id)
        .eq('status', 'confirmed');

      if (error) throw error;

      const balance = (data || []).reduce((sum, transaction) => sum + transaction.amount, 0);
      setEmployeeBalance(balance);
    } catch (err) {
      console.error('Error fetching employee balance:', err);
      setEmployeeBalance(0);
    }
  };

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      await Promise.all([fetchExpenses(), fetchCategories(), fetchEmployeeBalance()]);
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
        formatDateTime(expense.date)
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
          formatDateTime(expense.date)
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

  const totalPages = Math.ceil(filteredExpenses.length / itemsPerPage);
  const paginatedExpenses = filteredExpenses.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      toast.error('يجب تسجيل الدخول لإضافة مصروف');
      return;
    }

    try {
      const amount = parseFloat(formData.amount);
      
      // Check if deducting from custody and validate balance
      if (deductFromCustody && !editingExpense) {
        if (amount > employeeBalance) {
          toast.error(
            `رصيد العهدة غير كافٍ. الرصيد المتاح: ${employeeBalance.toLocaleString('EN-US')} ر.س والمطلوب: ${amount.toLocaleString('EN-US')} ر.س`
          );
          return;
        }

        // Confirm deduction from custody
        const confirmed = window.confirm(
          `هل أنت متأكد من خصم ${amount.toLocaleString('EN-US')} ر.س من عهدتك؟`
        );
        
        if (!confirmed) return;
      }

      const expenseData = {
        description: formData.description,
        amount: amount,
        category: formData.category,
        date: formData.date
      };

      if (editingExpense) {
        const { error } = await supabase
          .from('expenses')
          .update(expenseData)
          .eq('id', editingExpense.id);
        if (error) throw error;
        toast.success('تم تحديث المصروف بنجاح');
      } else {
        const createdBy = currentUser.full_name || currentUser.email || 'غير معروف';
        
        // تحديد الحالة حسب دور المستخدم
        const isAdmin = currentUser.role === 'admin';
        const expenseStatus = isAdmin ? 'approved' : 'pending';
        
        let balanceTransactionId = null;

        // If deducting from custody and user is admin, create debit transaction immediately
        // For regular employees, the transaction will be created upon approval
        if (deductFromCustody && isAdmin) {
          const { data: transaction, error: transactionError } = await supabase
            .from('employee_balance_transactions')
            .insert({
              user_id: currentUser.id,
              amount: -amount, // Negative for debit
              type: 'debit',
              reason: `مصروف: ${formData.description}`,
              transaction_date: formData.date,
              created_by: currentUser.id,
              status: 'confirmed',
              confirmed_at: new Date().toISOString(),
              confirmed_by: currentUser.id
            })
            .select()
            .single();

          if (transactionError) throw transactionError;
          balanceTransactionId = transaction.id;
        }
        
        const expenseToInsert = {
          ...expenseData,
          created_by: createdBy,
          user_id: currentUser.id,
          balance_transaction_id: balanceTransactionId,
          deducted_from_custody: deductFromCustody,
          status: expenseStatus,
          approved_by: isAdmin ? currentUser.id : null,
          approved_at: isAdmin ? new Date().toISOString() : null
        };

        const { error } = await supabase
          .from('expenses')
          .insert([expenseToInsert]);
        if (error) throw error;

        if (deductFromCustody && isAdmin) {
          const newBalance = employeeBalance - amount;
          toast.success(
            `تم خصم المصروف من عهدتك بنجاح. الرصيد المتبقي: ${newBalance.toLocaleString('EN-US')} ر.س`
          );
          await fetchEmployeeBalance();
        } else {
          const message = isAdmin 
            ? 'تم إضافة المصروف بنجاح' 
            : deductFromCustody
              ? 'تم إرسال المصروف للمراجعة. سيتم خصمه من عهدتك عند الموافقة'
              : 'تم إرسال المصروف للمراجعة من المدير';
          toast.success(message);
        }
      }

      await fetchExpenses();
      setFormData({
        description: '',
        amount: '',
        category: '',
        date: ''
      });
      setDeductFromCustody(false);
      setShowAddForm(false);
      setEditingExpense(null);
    } catch (err) {
      console.error('Error saving expense:', err);
      toast.error(err instanceof Error ? err.message : 'حدث خطأ في حفظ البيانات');
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
      toast.success('تم حذف المصروف بنجاح');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ في حذف البيانات');
      toast.error('فشل حذف المصروف');
    }
  };

  const handleApproveExpense = async (expense: Expense) => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser || currentUser.role !== 'admin') {
      toast.error('هذه العملية متاحة للمدير فقط');
      return;
    }

    try {
      let balanceTransactionId = expense.balance_transaction_id;

      // إذا كان المصروف مطلوب خصمه من العهدة ولم يتم خصمه بعد
      if (expense.deducted_from_custody && !expense.balance_transaction_id && expense.user_id) {
        // إنشاء معاملة خصم من العهدة
        const { data: transaction, error: transactionError } = await supabase
          .from('employee_balance_transactions')
          .insert({
            user_id: expense.user_id,
            amount: -expense.amount, // Negative for debit
            type: 'debit',
            reason: `مصروف معتمد: ${expense.description}`,
            transaction_date: expense.date,
            created_by: currentUser.id,
            status: 'confirmed',
            confirmed_at: new Date().toISOString(),
            confirmed_by: currentUser.id
          })
          .select()
          .single();

        if (transactionError) {
          console.error('Error creating custody transaction:', transactionError);
          toast.error('فشل خصم المبلغ من عهدة الموظف');
          return;
        }

        balanceTransactionId = transaction.id;
      }

      const { error } = await supabase
        .from('expenses')
        .update({
          status: 'approved',
          approved_by: currentUser.id,
          approved_at: new Date().toISOString(),
          balance_transaction_id: balanceTransactionId
        })
        .eq('id', expense.id);
      
      if (error) throw error;
      await fetchExpenses();
      
      const message = expense.deducted_from_custody 
        ? 'تم الموافقة على المصروف وخصمه من عهدة الموظف'
        : 'تم الموافقة على المصروف';
      toast.success(message);
    } catch (err) {
      console.error('Error approving expense:', err);
      toast.error('فشلت عملية الموافقة');
    }
  };

  const handleRejectExpense = async (expense: Expense) => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser || currentUser.role !== 'admin') {
      toast.error('هذه العملية متاحة للمدير فقط');
      return;
    }

    const reason = prompt('الرجاء إدخال سبب الرفض:');
    if (!reason || reason.trim() === '') {
      toast.error('يجب إدخال سبب الرفض');
      return;
    }

    try {
      const { error } = await supabase
        .from('expenses')
        .update({
          status: 'rejected',
          approved_by: currentUser.id,
          approved_at: new Date().toISOString(),
          rejection_reason: reason
        })
        .eq('id', expense.id);
      
      if (error) throw error;
      await fetchExpenses();
      toast.success('تم رفض المصروف');
    } catch (err) {
      console.error('Error rejecting expense:', err);
      toast.error('فشلت عملية الرفض');
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

  // تطبيق الفلتر الزمني الشامل أولاً
  const periodFilteredExpenses = usePeriodFilter(expenses, 'date');

  const filteredExpenses = useMemo(() => {
    let filtered = periodFilteredExpenses.filter(expense => {
      const matchesSearch = expense.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        expense.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = filterCategory === 'all' || expense.category === filterCategory;
      return matchesSearch && matchesCategory;
    });
    return filtered;
  }, [periodFilteredExpenses, searchTerm, filterCategory]);

  // فلتر المصروفات حسب الحالة
  const approvedExpenses = filteredExpenses.filter(exp => exp.status === 'approved');
  const pendingExpenses = filteredExpenses.filter(exp => exp.status === 'pending');
  const rejectedExpenses = filteredExpenses.filter(exp => exp.status === 'rejected');
  
  const currentUser = authService.getCurrentUser();
  const isAdmin = currentUser?.role === 'admin';

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
      <Toaster position="top-center" reverseOrder={false} />
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">إدارة المصروفات</h2>
            <p className="text-gray-600">تتبع وإدارة مصروفات عملك</p>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <button
              onClick={() => setShowCategoriesModal(true)}
              className="flex-1 sm:flex-none bg-gray-600 text-white px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors duration-200 flex items-center justify-center space-x-2 space-x-reverse text-sm"
            >
              <List className="h-4 w-4" />
              <span>الفئات</span>
            </button>
            <button
              onClick={handleExportExpenses}
              disabled={filteredExpenses.length === 0}
              className="flex-1 sm:flex-none border-2 border-blue-600 text-blue-600 bg-white px-3 py-2 rounded-lg hover:bg-blue-50 transition-colors duration-200 flex items-center justify-center space-x-2 space-x-reverse disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              <Download className="h-4 w-4" />
              <span>تصدير</span>
            </button>
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full sm:w-auto bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center justify-center space-x-2 space-x-reverse text-sm"
            >
              <Plus className="h-4 w-4" />
              <span>إضافة مصروف</span>
            </button>
          </div>
        </div>
      </div>

      {/* الفلتر الزمني الشامل */}
      <GlobalPeriodFilter />

      <div className="grid grid-cols-1 gap-4 md:gap-6 mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-blue-100 text-blue-600 p-2 md:p-3 rounded-lg">
              <DollarSign className="h-5 w-5 md:h-6 md:w-6" />
            </div>
            <TrendingUp className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-1">{totalExpenses.toLocaleString('EN-US')} ر.س</h3>
            <p className="text-gray-600 text-sm">إجمالي المصروفات</p>
          </div>
        </div>
      </div>

      {/* قسم المصروفات المعلقة - للمدير فقط */}
      {isAdmin && pendingExpenses.length > 0 && (
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-6 mb-6">
          <div className="flex items-center mb-4">
            <AlertCircle className="h-6 w-6 text-yellow-600 ml-2" />
            <h3 className="text-xl font-bold text-yellow-800">
              مصروفات بانتظار الموافقة ({pendingExpenses.length})
            </h3>
          </div>
          <div className="space-y-3">
            {pendingExpenses.map(expense => (
              <div key={expense.id} className="bg-white border border-yellow-200 rounded-lg p-4 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Tag className="h-4 w-4 text-gray-500" />
                      <span className="font-bold text-gray-900">{expense.description}</span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                        {expense.category}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                      <span>المبلغ: <strong className="text-blue-600">{expense.amount.toLocaleString('EN-US')} ر.س</strong></span>
                      <span>التاريخ: {formatNumericDate(expense.date)}</span>
                      <span>بواسطة: {expense.created_by || 'غير معروف'}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApproveExpense(expense)}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center space-x-2 space-x-reverse"
                    >
                      <CheckCircle className="h-4 w-4" />
                      <span>موافقة</span>
                    </button>
                    <button
                      onClick={() => handleRejectExpense(expense)}
                      className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors duration-200 flex items-center space-x-2 space-x-reverse"
                    >
                      <X className="h-4 w-4" />
                      <span>رفض</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
          <h3 className="text-lg font-semibold text-gray-900">سجلات المصروفات المعتمدة</h3>
        </div>
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full min-w-[800px] md:min-w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 md:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الوصف</th>
                <th className="px-4 md:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الفئة</th>
                <th className="px-4 md:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">المبلغ</th>
                <th className="hidden md:table-cell px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">التاريخ</th>
                <th className="hidden lg:table-cell px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">أنشأ بواسطة</th>
                <th className="px-4 md:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الحالة</th>
                <th className="px-4 md:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {approvedExpenses.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((expense) => (
                <tr key={expense.id} className="hover:bg-gray-50 transition-colors duration-150">
                  <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <FileText className="h-4 w-4 text-gray-400 ml-2 md:ml-3" />
                      <span
                        className="text-sm font-medium text-gray-900"
                        title={expense.description}
                      >
                        {truncateText(expense.description, window.innerWidth < 768 ? 20 : 50)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {expense.category}
                    </span>
                  </td>
                  <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {expense.amount.toLocaleString('EN-US')} ر.س
                  </td>
                  <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {formatDateTime(expense.date)}
                  </td>
                  <td className="hidden lg:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {expense.created_by || 'غير محدد'}
                  </td>
                  <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] md:text-xs font-medium bg-green-100 text-green-800 w-fit">
                        معتمد
                      </span>
                      {expense.deducted_from_custody && (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] md:text-xs font-medium bg-purple-100 text-purple-800 w-fit">
                          من العهدة
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm font-medium">
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

        {Math.ceil(approvedExpenses.length / itemsPerPage) > 1 && (
          <div className="bg-gray-50 px-6 py-3 flex items-center justify-between border-t border-gray-200">
            <div className="text-sm text-gray-700">
              عرض {(currentPage - 1) * itemsPerPage + 1} إلى {Math.min(currentPage * itemsPerPage, approvedExpenses.length)} من {approvedExpenses.length} مصروف
            </div>
            <div className="flex items-center space-x-2 space-x-reverse">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                السابق
              </button>
              {[...Array(Math.min(5, Math.ceil(approvedExpenses.length / itemsPerPage)))].map((_, i) => {
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
                onClick={() => setCurrentPage(prev => Math.min(Math.ceil(approvedExpenses.length / itemsPerPage), prev + 1))}
                disabled={currentPage === Math.ceil(approvedExpenses.length / itemsPerPage)}
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
                  setDeductFromCustody(false);
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

                {/* Custody deduction option - only show for new expenses */}
                {!editingExpense && authService.getCurrentUser()?.role !== 'admin' && (
                  <div>
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="flex items-center space-x-2 space-x-reverse cursor-pointer">
                          <input
                            type="checkbox"
                            checked={deductFromCustody}
                            onChange={(e) => setDeductFromCustody(e.target.checked)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-sm font-semibold text-gray-700">خصم من العهدة</span>
                        </label>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">رصيد العهدة المتاح:</span>
                        <span className={`font-bold ${employeeBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {employeeBalance.toLocaleString('EN-US')} ر.س
                        </span>
                      </div>

                      {deductFromCustody && formData.amount && (
                        <div className="pt-2 border-t border-amber-200">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">الرصيد بعد الخصم:</span>
                            <span className={`font-bold ${(employeeBalance - parseFloat(formData.amount)) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {(employeeBalance - parseFloat(formData.amount || '0')).toLocaleString('EN-US')} ر.س
                            </span>
                          </div>
                          {parseFloat(formData.amount || '0') > employeeBalance && (
                            <div className="flex items-start space-x-2 space-x-reverse mt-2 text-xs text-red-600">
                              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                              <span>تحذير: المبلغ المطلوب أكبر من رصيد العهدة المتاح</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Admin option to deduct from custody */}
                {!editingExpense && authService.getCurrentUser()?.role === 'admin' && (
                  <div>
                    <label className="flex items-center space-x-2 space-x-reverse cursor-pointer">
                      <input
                        type="checkbox"
                        checked={deductFromCustody}
                        onChange={(e) => setDeductFromCustody(e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="text-sm font-semibold text-gray-700">خصم من العهدة (اختياري)</span>
                    </label>
                    <p className="text-xs text-gray-500 mr-6 mt-1">يمكن للمدير إضافة مصروف بدون خصم من العهدة</p>
                  </div>
                )}
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
                    setDeductFromCustody(false);
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
                              <td className="border border-gray-300 px-4 py-3">{formatDateTime(expense.date)}</td>
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
