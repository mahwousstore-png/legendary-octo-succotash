import { supabase } from './supabase';
import { authService } from './auth';

export interface AuditLogData {
  action: 'create' | 'update' | 'delete' | 'accept' | 'reject' | 'confirm';
  resource_type: 'expense' | 'custody' | 'order' | 'employee_balance_transaction' | 'asset';
  resource_id?: string;
  details?: Record<string, any>;
}

export const logAction = async (data: AuditLogData): Promise<void> => {
  try {
    const currentUser = authService.getCurrentUser();
    
    if (!currentUser) {
      console.warn('Cannot log action: No user logged in');
      return;
    }

    const logEntry = {
      user_id: currentUser.id,
      user_name: currentUser.full_name || currentUser.email || 'مستخدم غير معروف',
      action: data.action,
      resource_type: data.resource_type,
      resource_id: data.resource_id || null,
      details: data.details || {},
      ip_address: null, // يمكن إضافة IP لاحقاً
      user_agent: navigator.userAgent
    };

    const { error } = await supabase
      .from('system_logs')
      .insert([logEntry]);

    if (error) {
      console.error('Failed to log action:', error);
    }
  } catch (err) {
    console.error('Error in logAction:', err);
  }
};

// دوال مساعدة محددة
export const logExpenseCreated = (expenseId: string, amount: number) => {
  return logAction({
    action: 'create',
    resource_type: 'expense',
    resource_id: expenseId,
    details: { amount }
  });
};

export const logExpenseDeleted = (expenseId: string) => {
  return logAction({
    action: 'delete',
    resource_type: 'expense',
    resource_id: expenseId
  });
};

export const logCustodyAccepted = (transactionId: string, amount: number) => {
  return logAction({
    action: 'accept',
    resource_type: 'employee_balance_transaction',
    resource_id: transactionId,
    details: { amount }
  });
};

export const logCustodyRejected = (transactionId: string, amount: number) => {
  return logAction({
    action: 'reject',
    resource_type: 'employee_balance_transaction',
    resource_id: transactionId,
    details: { amount }
  });
};

export const logCustodyDeleted = (transactionId: string, amount: number) => {
  return logAction({
    action: 'delete',
    resource_type: 'employee_balance_transaction',
    resource_id: transactionId,
    details: { amount }
  });
};
