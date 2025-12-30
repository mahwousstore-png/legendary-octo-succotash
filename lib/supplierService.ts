import { supabase } from './supabase';
import { authService } from './auth';
import { logAction } from './auditLogger';

export interface SupplierLedger {
  id: string;
  supplier_name: string;
  order_id: string | null;
  product_details: string;
  amount: number;
  paid_amount: number;
  remaining_amount: number;
  locked_by: string;
  locked_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupplierPayment {
  id: string;
  ledger_id: string;
  paid_amount: number;
  paid_by: string;
  paid_by_user_id: string | null;
  balance_transaction_id: string | null;
  payment_date: string;
  notes: string | null;
}

/**
 * إنشاء مستحق جديد للمورد (عند إقفال الطلب)
 */
export const createSupplierLedger = async (data: {
  supplier_name: string;
  order_id?: string;
  product_details: string;
  amount: number;
}): Promise<{ success: boolean; ledger?: SupplierLedger; error?: string }> => {
  try {
    const currentUser = authService.getCurrentUser();
    
    if (!currentUser) {
      return { success: false, error: 'لم يتم تسجيل الدخول' };
    }

    const { data: ledger, error } = await supabase
      .from('supplier_ledger')
      .insert([{
        supplier_name: data.supplier_name,
        order_id: data.order_id || null,
        product_details: data.product_details,
        amount: data.amount,
        paid_amount: 0,
        remaining_amount: data.amount,
        locked_by: currentUser.full_name || currentUser.email,
        locked_by_user_id: currentUser.id
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating supplier ledger:', error);
      return { success: false, error: error.message };
    }

    // تسجيل في Audit Log
    await logAction({
      action: 'create',
      resource_type: 'supplier_ledger',
      resource_id: ledger.id,
      details: {
        supplier: data.supplier_name,
        amount: data.amount,
        order_id: data.order_id
      }
    });

    return { success: true, ledger };
  } catch (err: any) {
    console.error('Exception in createSupplierLedger:', err);
    return { success: false, error: err.message };
  }
};

/**
 * سداد دفعة للمورد (من عهدة الموظف)
 */
export const paySupplierLedger = async (
  ledgerId: string,
  paymentAmount: number,
  notes?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const currentUser = authService.getCurrentUser();
    
    if (!currentUser) {
      return { success: false, error: 'لم يتم تسجيل الدخول' };
    }

    // 1. التحقق من رصيد العهدة
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('current_balance')
      .eq('id', currentUser.id)
      .single();

    const currentBalance = profile?.current_balance || 0;

    if (paymentAmount > currentBalance) {
      return { 
        success: false, 
        error: `رصيد العهدة غير كافٍ. الرصيد المتاح: ${currentBalance} ر.س` 
      };
    }

    // 2. التحقق من المبلغ المتبقي
    const { data: ledger } = await supabase
      .from('supplier_ledger')
      .select('remaining_amount, supplier_name, paid_amount')
      .eq('id', ledgerId)
      .single();

    if (!ledger) {
      return { success: false, error: 'المستحق غير موجود' };
    }

    if (paymentAmount > ledger.remaining_amount) {
      return { 
        success: false, 
        error: `المبلغ أكبر من المتبقي. المبلغ المتبقي: ${ledger.remaining_amount} ر.س` 
      };
    }

    // 3. خصم من العهدة
    const { data: transaction, error: transError } = await supabase
      .from('employee_balance_transactions')
      .insert([{
        user_id: currentUser.id,
        amount: -paymentAmount,
        type: 'debit',
        reason: `سداد دفعة للمورد: ${ledger.supplier_name}`,
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        confirmed_by: currentUser.id
      }])
      .select()
      .single();

    if (transError) {
      console.error('Error creating balance transaction:', transError);
      return { success: false, error: 'فشل خصم المبلغ من العهدة' };
    }

    // 4. تسجيل السداد
    const { error: paymentError } = await supabase
      .from('supplier_payments')
      .insert([{
        ledger_id: ledgerId,
        paid_amount: paymentAmount,
        paid_by: currentUser.full_name || currentUser.email,
        paid_by_user_id: currentUser.id,
        balance_transaction_id: transaction.id,
        notes: notes || null
      }]);

    if (paymentError) {
      console.error('Error creating supplier payment:', paymentError);
      // Rollback: حذف transaction
      await supabase
        .from('employee_balance_transactions')
        .delete()
        .eq('id', transaction.id);
      return { success: false, error: 'فشل تسجيل السداد' };
    }

    // 5. تحديث المبلغ المتبقي
    const newRemaining = ledger.remaining_amount - paymentAmount;
    const newPaidAmount = ledger.paid_amount + paymentAmount;

    const { error: updateError } = await supabase
      .from('supplier_ledger')
      .update({
        paid_amount: newPaidAmount,
        remaining_amount: newRemaining
      })
      .eq('id', ledgerId);

    if (updateError) {
      console.error('Error updating supplier ledger:', updateError);
    }

    // 6. تحديث رصيد الموظف
    await supabase
      .from('user_profiles')
      .update({
        current_balance: currentBalance - paymentAmount
      })
      .eq('id', currentUser.id);

    // 7. تسجيل في Audit Log
    await logAction({
      action: 'create',
      resource_type: 'supplier_payment',
      resource_id: ledgerId,
      details: {
        supplier: ledger.supplier_name,
        amount: paymentAmount,
        remaining: newRemaining
      }
    });

    return { success: true };
  } catch (err: any) {
    console.error('Exception in paySupplierLedger:', err);
    return { success: false, error: err.message };
  }
};

/**
 * جلب جميع المستحقات
 */
export const fetchSupplierLedgers = async (): Promise<SupplierLedger[]> => {
  try {
    const { data, error } = await supabase
      .from('supplier_ledger')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching supplier ledgers:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Exception in fetchSupplierLedgers:', err);
    return [];
  }
};

/**
 * جلب سدادات مستحق معين
 */
export const fetchPaymentsByLedger = async (ledgerId: string): Promise<SupplierPayment[]> => {
  try {
    const { data, error } = await supabase
      .from('supplier_payments')
      .select('*')
      .eq('ledger_id', ledgerId)
      .order('payment_date', { ascending: false });

    if (error) {
      console.error('Error fetching payments:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Exception in fetchPaymentsByLedger:', err);
    return [];
  }
};

/**
 * حذف مستحق (للمدير فقط)
 */
export const deleteSupplierLedger = async (ledgerId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const currentUser = authService.getCurrentUser();
    
    if (!currentUser || currentUser.role !== 'admin') {
      return { success: false, error: 'غير مصرح لك بالحذف' };
    }

    const { error } = await supabase
      .from('supplier_ledger')
      .delete()
      .eq('id', ledgerId);

    if (error) {
      console.error('Error deleting supplier ledger:', error);
      return { success: false, error: error.message };
    }

    // تسجيل في Audit Log
    await logAction({
      action: 'delete',
      resource_type: 'supplier_ledger',
      resource_id: ledgerId,
      details: {}
    });

    return { success: true };
  } catch (err: any) {
    console.error('Exception in deleteSupplierLedger:', err);
    return { success: false, error: err.message };
  }
};
