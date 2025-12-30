import { supabase } from './supabase';
import { authService } from './auth';

export interface AuditLogData {
  action: 'create' | 'update' | 'delete' | 'accept' | 'reject' | 'confirm';
  resource_type: 'expense' | 'custody' | 'order' | 'employee_balance_transaction' | 'asset' | 'supplier_ledger' | 'supplier_payment';
  resource_id?: string;
  details?: Record<string, any>;
}

/**
 * تسجيل إجراء في Audit Log
 */
export const logAction = async (data: AuditLogData): Promise<void> => {
  try {
    const currentUser = authService.getCurrentUser();
    
    if (!currentUser) {
      console.warn('Cannot log action: No authenticated user');
      return;
    }

    // تسجيل في جدول user_activity_logs
    await supabase
      .from('user_activity_logs')
      .insert({
        user_id: currentUser.id,
        action: `${data.resource_type}_${data.action}`,
        details: {
          resource_type: data.resource_type,
          resource_id: data.resource_id,
          ...data.details
        },
        performed_by: currentUser.id
      });
  } catch (error) {
    console.error('Error logging action:', error);
    // لا نرمي خطأ لأن فشل التسجيل لا يجب أن يوقف العملية الأساسية
  }
};

// دوال مساعدة للموردين
export const logSupplierLedgerCreated = (ledgerId: string, supplier: string, amount: number) => {
  return logAction({
    action: 'create',
    resource_type: 'supplier_ledger',
    resource_id: ledgerId,
    details: { supplier, amount }
  });
};

export const logSupplierPayment = (ledgerId: string, supplier: string, amount: number) => {
  return logAction({
    action: 'create',
    resource_type: 'supplier_payment',
    resource_id: ledgerId,
    details: { supplier, amount }
  });
};

export const logSupplierLedgerDeleted = (ledgerId: string) => {
  return logAction({
    action: 'delete',
    resource_type: 'supplier_ledger',
    resource_id: ledgerId
  });
};
