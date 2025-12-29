export interface Product {
  id?: string;
  order_id?: string;
  name: string;
  quantity: number;
  unit_price: number;
  cost_price: number;
  subtotal: number;
  cost_subtotal: number;
  created_at?: string;
  updated_at?: string;
  supplier_id?: string;  // إضافة جديدة
  supplier_name?: string;  // إضافة جديدة
}

export interface Order {
  id: string;
  customer_name: string;
  phone_number: string;
  order_number: string;
  products?: Product[];
  total_price: number;
  subtotal_before_tax?: number;
  tax_amount?: number;
  shipping_cost?: number;
  shipping_company?: string;
  payment_method?: string;
  payment_status?: string;
  order_date: string;
  status: string;
  is_locked?: boolean;
  locked_by?: string;
  locked_at?: string;
  shipping_bearer?: 'customer' | 'store';
  created_at: string;
  updated_at: string;
}

export interface OrderStats {
  total_orders: number;
  total_revenue: number;
  pending_orders: number;
  completed_orders: number;
  locked_orders: number;
  unlocked_orders: number;
  average_order_value: number;
}