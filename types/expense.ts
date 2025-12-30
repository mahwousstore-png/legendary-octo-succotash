export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  type: 'fixed' | 'variable';
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  user_id?: string;
  balance_transaction_id?: string;
  deducted_from_custody?: boolean;
}

export interface EmployeeBalanceTransaction {
  id: string;
  user_id: string;
  amount: number;
  type: 'credit' | 'debit';
  reason?: string;
  transaction_date: string;
  created_by: string;
  created_at: string;
  status?: 'pending' | 'confirmed' | 'rejected';
  confirmed_at?: string;
  confirmed_by?: string;
}

export interface ExpenseStats {
  total_expenses: number;
  monthly_expenses: number;
  fixed_expenses: number;
  variable_expenses: number;
  categories_count: number;
}