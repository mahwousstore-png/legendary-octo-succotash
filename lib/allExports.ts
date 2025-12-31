// lib/allExports.ts
// ملف تصدير موحد للدوال المستخدمة في التقارير المخصصة
// هذا الملف يوفر دوال تصدير فارغة للحفاظ على التوافقية

import { exportToExcel, exportToPDF, formatCurrency, formatDate } from './exportUtils';

// Inventory exports
export const exportInventoryToExcel = async (data: any[]) => {
  await exportToExcel({
    fileName: 'المخزون',
    sheetName: 'المخزون',
    title: 'تقرير المخزون',
    headers: ['اسم المنتج', 'SKU', 'الكمية', 'سعر الوحدة', 'القيمة الإجمالية'],
    data: data.map(item => [
      item.name || item.product_name || '',
      item.sku || '-',
      (item.quantity || 0).toString(),
      formatCurrency(item.unit_cost || item.cost_price || 0),
      formatCurrency((item.quantity || 0) * (item.unit_cost || item.cost_price || 0))
    ])
  });
};

export const exportInventoryToPDF = (data: any[]) => {
  exportToPDF({
    fileName: 'المخزون',
    title: 'تقرير المخزون',
    headers: ['اسم المنتج', 'SKU', 'الكمية', 'سعر الوحدة', 'القيمة الإجمالية'],
    data: data.map(item => [
      item.name || item.product_name || '',
      item.sku || '-',
      (item.quantity || 0).toString(),
      formatCurrency(item.unit_cost || item.cost_price || 0),
      formatCurrency((item.quantity || 0) * (item.unit_cost || item.cost_price || 0))
    ])
  });
};

// Payment Methods exports
export const exportPaymentMethodsToExcel = async (data: any[]) => {
  await exportToExcel({
    fileName: 'طرق_الدفع',
    sheetName: 'طرق الدفع',
    title: 'تقرير طرق الدفع',
    headers: ['طريقة الدفع', 'عدد المعاملات', 'المبلغ الإجمالي', 'النسبة'],
    data: data.map(item => [
      item.name || '',
      (item.count || 0).toString(),
      formatCurrency(item.total || 0),
      `${(item.percentage || 0).toFixed(1)}%`
    ])
  });
};

export const exportPaymentMethodsToPDF = (data: any[]) => {
  exportToPDF({
    fileName: 'طرق_الدفع',
    title: 'تقرير طرق الدفع',
    headers: ['طريقة الدفع', 'عدد المعاملات', 'المبلغ الإجمالي', 'النسبة'],
    data: data.map(item => [
      item.name || '',
      (item.count || 0).toString(),
      formatCurrency(item.total || 0),
      `${(item.percentage || 0).toFixed(1)}%`
    ])
  });
};

// Shipping Companies exports
export const exportShippingCompaniesToExcel = async (data: any[]) => {
  await exportToExcel({
    fileName: 'شركات_الشحن',
    sheetName: 'شركات الشحن',
    title: 'تقرير شركات الشحن',
    headers: ['شركة الشحن', 'عدد الشحنات', 'التكلفة الإجمالية', 'النسبة'],
    data: data.map(item => [
      item.name || '',
      (item.count || 0).toString(),
      formatCurrency(item.total || 0),
      `${(item.percentage || 0).toFixed(1)}%`
    ])
  });
};

export const exportShippingCompaniesToPDF = (data: any[]) => {
  exportToPDF({
    fileName: 'شركات_الشحن',
    title: 'تقرير شركات الشحن',
    headers: ['شركة الشحن', 'عدد الشحنات', 'التكلفة الإجمالية', 'النسبة'],
    data: data.map(item => [
      item.name || '',
      (item.count || 0).toString(),
      formatCurrency(item.total || 0),
      `${(item.percentage || 0).toFixed(1)}%`
    ])
  });
};

// Suppliers exports
export const exportSuppliersToExcel = async (data: any[]) => {
  await exportToExcel({
    fileName: 'الموردين',
    sheetName: 'الموردين',
    title: 'تقرير الموردين',
    headers: ['اسم المورد', 'الهاتف', 'البريد الإلكتروني', 'المستحقات'],
    data: data.map(item => [
      item.name || '',
      item.contact_info?.phone || item.phone || '-',
      item.contact_info?.email || item.email || '-',
      formatCurrency(item.receivables || 0)
    ])
  });
};

export const exportSuppliersToPDF = (data: any[]) => {
  exportToPDF({
    fileName: 'الموردين',
    title: 'تقرير الموردين',
    headers: ['اسم المورد', 'الهاتف', 'البريد الإلكتروني', 'المستحقات'],
    data: data.map(item => [
      item.name || '',
      item.contact_info?.phone || item.phone || '-',
      item.contact_info?.email || item.email || '-',
      formatCurrency(item.receivables || 0)
    ])
  });
};

// Orders exports
export const exportOrdersToExcel = async (data: any[]) => {
  await exportToExcel({
    fileName: 'الطلبات',
    sheetName: 'الطلبات',
    title: 'تقرير الطلبات',
    headers: ['رقم الطلب', 'العميل', 'الحالة', 'المبلغ', 'التاريخ'],
    data: data.map(item => [
      item.order_number || item.id || '',
      item.customer_name || '',
      item.status || '',
      formatCurrency(item.total_price || item.total || 0),
      formatDate(item.order_date || item.created_at || '')
    ])
  });
};

export const exportOrdersToPDF = (data: any[]) => {
  exportToPDF({
    fileName: 'الطلبات',
    title: 'تقرير الطلبات',
    headers: ['رقم الطلب', 'العميل', 'الحالة', 'المبلغ', 'التاريخ'],
    data: data.map(item => [
      item.order_number || item.id || '',
      item.customer_name || '',
      item.status || '',
      formatCurrency(item.total_price || item.total || 0),
      formatDate(item.order_date || item.created_at || '')
    ])
  });
};

// Employee Balances exports
export const exportEmployeeBalancesToExcel = async (data: any[]) => {
  await exportToExcel({
    fileName: 'أرصدة_الموظفين',
    sheetName: 'أرصدة الموظفين',
    title: 'تقرير أرصدة الموظفين',
    headers: ['اسم الموظف', 'البريد الإلكتروني', 'الرصيد الحالي', 'عدد العمليات'],
    data: data.map(item => [
      item.user?.full_name || item.full_name || '',
      item.user?.email || item.email || '',
      formatCurrency(item.current_balance || 0),
      (item.transactions?.length || item.transaction_count || 0).toString()
    ])
  });
};

export const exportEmployeeBalancesToPDF = (data: any[]) => {
  exportToPDF({
    fileName: 'أرصدة_الموظفين',
    title: 'تقرير أرصدة الموظفين',
    headers: ['اسم الموظف', 'البريد الإلكتروني', 'الرصيد الحالي', 'عدد العمليات'],
    data: data.map(item => [
      item.user?.full_name || item.full_name || '',
      item.user?.email || item.email || '',
      formatCurrency(item.current_balance || 0),
      (item.transactions?.length || item.transaction_count || 0).toString()
    ])
  });
};
