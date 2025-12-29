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
}

export interface ExpenseStats {
  total_expenses: number;
  monthly_expenses: number;
  fixed_expenses: number;
  variable_expenses: number;
  categories_count: number;
}