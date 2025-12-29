// src/types/receivables.ts

export type EntityType = 'منشأة' | 'فرد';

export interface ContactInfo {
  phone?: string | null;
  email?: string | null;
}

export interface Entity {
  id: string;
  name: string;
  type: EntityType;
  contact_info?: ContactInfo | null;
  created_at: string;
}

export interface Payment {
  id: string;
  receivable_id: string;
  amount: number;
  payment_date: string;
  receipt_number: string;
  notes?: string | null;
  created_at: string;
}

export interface Receivable {
  id: string;
  entity_id: string;
  description: string;
  total_amount: number;
  remaining_amount: number;
  due_date?: string | null;
  status: 'مستحق' | 'مسدد كاملاً';
  payments?: Payment[];
  created_at: string;
}