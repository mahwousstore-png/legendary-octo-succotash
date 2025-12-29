// src/hooks/useReceivables.ts
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface Entity {
  id: string;
  name: string;
  type: string;
  contact_info: {
    address?: string;
    phone?: string;
    email?: string;
  } | null;
  created_at: string;
}

export interface Receivable {
  id: string;
  entity_id: string;
  description: string;
  total_amount: number;
  remaining_amount: number;
  due_date: string;
  created_at: string;
  payments: Payment[];
  status: string;
}

export interface Payment {
  id: string;
  receivable_id: string;
  amount: number;
  payment_date: string;
  receipt_number: string;
  notes?: string;
  created_at: string;
}

export const useReceivables = () => {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [entitiesRes, receivablesRes] = await Promise.all([
        supabase
          .from('entities')
          .select('id, name, type, contact_info, created_at')
          .eq('type', 'مورد'),
        supabase
          .from('receivables')
          .select(`
            id,
            entity_id,
            description,
            total_amount,
            remaining_amount,
            due_date,
            created_at,
            payments (
              id,
              receivable_id,
              amount,
              payment_date,
              receipt_number,
              notes,
              created_at
            )
          `)
      ]);

      if (entitiesRes.error) throw entitiesRes.error;
      if (receivablesRes.error) throw receivablesRes.error;

      const cleanedReceivables: Receivable[] = (receivablesRes.data || []).map((rec: any) => ({
        ...rec,
        total_amount: parseFloat(rec.total_amount) || 0,
        remaining_amount: parseFloat(rec.remaining_amount) || 0,
        status: parseFloat(rec.remaining_amount) > 0 ? 'مستحق' : 'مسدد كاملاً',
        payments: (rec.payments || []).map((p: any) => ({
          ...p,
          amount: parseFloat(p.amount) || 0
        }))
      }));

      setEntities(entitiesRes.data || []);
      setReceivables(cleanedReceivables);
    } catch (error: any) {
      console.error('فشل تحميل البيانات:', error);
      alert('حدث خطأ أثناء تحميل البيانات: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // إضافة مورد جديد
  const addEntity = async (entity: {
    name: string;
    type: 'مورد';
    contact_info?: { address?: string; phone?: string; email?: string };
  }) => {
    const contactInfo = entity.contact_info || {};
    const { data, error } = await supabase
      .from('entities')
      .insert([
        {
          name: entity.name.trim(),
          type: entity.type,
          contact_info: {
            address: contactInfo.address?.trim() || null,
            phone: contactInfo.phone?.trim() || null,
            email: contactInfo.email?.trim() || null,
          }
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('خطأ في إضافة المورد:', error);
      throw error;
    }

    setEntities(prev => [...prev, data]);
    return data;
  };

  // تحديث مورد
  const updateEntity = async (
    id: string,
    updates: {
      name?: string;
      contact_info?: { address?: string; phone?: string; email?: string };
    }
  ) => {
    const current = entities.find(e => e.id === id);
    if (!current) throw new Error('المورد غير موجود');

    const currentContact = (current.contact_info || {}) as any;
    const newContact = updates.contact_info || {};

    const mergedContactInfo = {
      address: newContact.address !== undefined ? (newContact.address?.trim() || null) : currentContact.address || null,
      phone: newContact.phone !== undefined ? (newContact.phone?.trim() || null) : currentContact.phone || null,
      email: newContact.email !== undefined ? (newContact.email?.trim() || null) : currentContact.email || null,
    };

    const { data, error } = await supabase
      .from('entities')
      .update({
        name: updates.name?.trim(),
        contact_info: mergedContactInfo
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('خطأ في تحديث المورد:', error);
      throw error;
    }

    setEntities(prev => prev.map(e => (e.id === id ? { ...e, ...data } : e)));
    return data;
  };

  // حذف مورد (مع كل مستحقاته)
  const deleteEntity = async (id: string) => {
    try {
      const { error: recError } = await supabase
        .from('receivables')
        .delete()
        .eq('entity_id', id);

      if (recError) throw recError;

      const { error } = await supabase.from('entities').delete().eq('id', id);
      if (error) throw error;

      setEntities(prev => prev.filter(e => e.id !== id));
      setReceivables(prev => prev.filter(r => r.entity_id !== id));
    } catch (error: any) {
      console.error('فشل حذف المورد:', error);
      throw error;
    }
  };

  // إضافة دفعة
  const addPayment = async (payment: {
    receivable_id: string;
    amount: number;
    receipt_number: string;
    payment_date: string;
    notes?: string;
  }) => {
    const { data: paymentData, error: paymentError } = await supabase
      .from('payments')
      .insert([payment])
      .select()
      .single();

    if (paymentError) throw paymentError;

    const { data: recData, error: recError } = await supabase
      .from('receivables')
      .select('remaining_amount')
      .eq('id', payment.receivable_id)
      .single();

    if (recError) throw recError;

    const newRemaining = (parseFloat(recData.remaining_amount as any) || 0) - payment.amount;

    const { data: updatedRec, error: updateError } = await supabase
      .from('receivables')
      .update({ remaining_amount: newRemaining > 0 ? newRemaining : 0 })
      .eq('id', payment.receivable_id)
      .select()
      .single();

    if (updateError) throw updateError;

    setReceivables(prev =>
      prev.map(r =>
        r.id === payment.receivable_id
          ? {
              ...r,
              ...updatedRec,
              remaining_amount: newRemaining > 0 ? newRemaining : 0,
              status: newRemaining > 0 ? 'مستحق' : 'مسدد كاملاً',
              payments: [...(r.payments || []), paymentData]
            }
          : r
      )
    );
  };

  // الدالة المفقودة التي كانت تسبب الخطأ
  const addReceivable = async (receivable: {
    entity_id: string;
    description: string;
    total_amount: number;
    due_date: string;
    notes?: string;
  }) => {
    const { data, error } = await supabase
      .from('receivables')
      .insert([
        {
          entity_id: receivable.entity_id,
          description: receivable.description,
          total_amount: receivable.total_amount,
          remaining_amount: receivable.total_amount,
          due_date: receivable.due_date,
          notes: receivable.notes?.trim() || null,
        }
      ])
      .select(`
        id,
        entity_id,
        description,
        total_amount,
        remaining_amount,
        due_date,
        created_at,
        payments (
          id,
          receivable_id,
          amount,
          payment_date,
          receipt_number,
          notes,
          created_at
        )
      `)
      .single();

    if (error) {
      console.error('خطأ في إضافة المستحقة:', error);
      throw error;
    }

    const newReceivable: Receivable = {
      ...data,
      total_amount: parseFloat(data.total_amount) || 0,
      remaining_amount: parseFloat(data.remaining_amount) || 0,
      status: parseFloat(data.remaining_amount) > 0 ? 'مستحق' : 'مسدد كاملاً',
      payments: (data.payments || []).map((p: any) => ({
        ...p,
        amount: parseFloat(p.amount) || 0
      }))
    };

    setReceivables(prev => [...prev, newReceivable]);
    return newReceivable;
  };

  return {
    entities,
    receivables,
    loading,
    addEntity,
    updateEntity,
    deleteEntity,
    addPayment,
    addReceivable,     // الآن موجودة وتعمل 100%
    refresh: fetchData
  };
};