import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Order, OrderStats, Product } from '../types/order';

export const useOrders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<OrderStats>({
    total_orders: 0,
    total_revenue: 0,
    pending_orders: 0,
    completed_orders: 0,
    locked_orders: 0,
    unlocked_orders: 0,
    average_order_value: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // دالة واحدة فقط لإعادة حساب إجماليات الطلب (تم حذف التكرار)
  const updateOrderTotals = async (orderId: string) => {
    try {
      const { data: products } = await supabase
        .from('order_products')
        .select('subtotal')
        .eq('order_id', orderId);

      const productsSubtotal = products?.length
        ? products.reduce((sum, p) => sum + parseFloat(p.subtotal || '0'), 0)
        : 0;

      const { data: order } = await supabase
        .from('orders')
        .select('shipping_cost')
        .eq('id', orderId)
        .single();

      if (!order) return;

      const shippingCost = parseFloat(order.shipping_cost || '0');
      const taxableBase = productsSubtotal + shippingCost;
      const taxAmount = taxableBase * 0.15;
      const totalPrice = taxableBase + taxAmount;

      await supabase
        .from('orders')
        .update({
          subtotal_before_tax: productsSubtotal,
          tax_amount: taxAmount,
          total_price: totalPrice,
        })
        .eq('id', orderId);
    } catch (err) {
      console.error('فشل في تحديث إجماليات الطلب:', err);
    }
  };

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          order_products (
            id,
            order_id,
            product_name,
            quantity,
            unit_price,
            cost_price,
            subtotal,
            cost_subtotal,
            created_at,
            updated_at,
            supplier_id,
            supplier_name
          )
        `)
        .order('order_date', { ascending: false });

      if (ordersError) throw ordersError;

      const formattedOrders: Order[] = (ordersData || []).map((order: any) => ({
        ...order,
        products: (order.order_products || []).map((p: any) => ({
          id: p.id,
          order_id: p.order_id,
          name: p.product_name,
          quantity: p.quantity,
          unit_price: typeof p.unit_price === 'string' ? parseFloat(p.unit_price) : p.unit_price,
          cost_price: typeof p.cost_price === 'string' ? parseFloat(p.cost_price || '0') : (p.cost_price || 0),
          subtotal: typeof p.subtotal === 'string' ? parseFloat(p.subtotal) : p.subtotal,
          cost_subtotal: typeof p.cost_subtotal === 'string' ? parseFloat(p.cost_subtotal || '0') : (p.cost_subtotal || 0),
          created_at: p.created_at,
          updated_at: p.updated_at,
          supplier_id: p.supplier_id,
          supplier_name: p.supplier_name
        }))
      }));

      setOrders(formattedOrders);

      // حساب الإحصائيات
      const newStats: OrderStats = {
        total_orders: formattedOrders.length,
        total_revenue: formattedOrders.reduce((sum, order) => sum + (order.total_price || 0), 0),
        pending_orders: formattedOrders.filter(o => o.status === 'بإنتظار المراجعة').length,
        completed_orders: formattedOrders.filter(o => o.status === 'مكتمل').length,
        locked_orders: formattedOrders.filter(o => o.is_locked).length,
        unlocked_orders: formattedOrders.filter(o => !o.is_locked && o.status !== 'ملغي').length,
        average_order_value: 0,
      };

      newStats.average_order_value = newStats.total_orders > 0
        ? newStats.total_revenue / newStats.total_orders
        : 0;

      setStats(newStats);
    } catch (err: any) {
      console.error('Error fetching orders:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // تحديث حالة الطلب
  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const { data: order } = await supabase.from('orders').select('is_locked').eq('id', orderId).single();
      if (order?.is_locked) throw new Error('لا يمكن تعديل طلب مقفل');

      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;
      await fetchOrders();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل في تحديث الحالة');
      return false;
    }
  };

  // قفل الطلب
  const lockOrder = async (orderId: string) => {
    try {
      const { data: products } = await supabase
        .from('order_products')
        .select('id')
        .eq('order_id', orderId);

      if (!products || products.length === 0) {
        throw new Error('يجب إضافة منتج واحد على الأقل قبل الإقفال');
      }

      await updateOrderTotals(orderId);

      const { error } = await supabase
        .from('orders')
        .update({
          is_locked: true,
          status: 'مقفل',
          locked_at: new Date().toISOString(),
        })
        .eq('id', orderId);

      if (error) throw error;
      await fetchOrders();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل في قفل الطلب');
      return false;
    }
  };

  // تحديث تكلفة المنتج
  const updateProductCost = async (productId: string, costPrice: number) => {
    try {
      const { data: product, error: fetchError } = await supabase
        .from('order_products')
        .select('quantity, order_id, order!is_locked')
        .eq('id', productId)
        .single();

      if (fetchError) throw fetchError;
      if (product.order?.is_locked) throw new Error('لا يمكن تعديل منتج في طلب مقفل');

      const costSubtotal = product.quantity * costPrice;

      const { error } = await supabase
        .from('order_products')
        .update({ cost_price: costPrice, cost_subtotal: costSubtotal })
        .eq('id', productId);

      if (error) throw error;

      await updateOrderTotals(product.order_id);
      await fetchOrders();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل في تح76 تكلفة المنتج');
      return false;
    }
  };

  // تحديث بيانات المنتج (مثل المورد)
  const updateProduct = async (productId: string, updates: Partial<Product>) => {
    try {
      const { data: prod } = await supabase
        .from('order_products')
        .select('order!is_locked')
        .eq('id', productId)
        .single();

      if (prod?.order?.is_locked) throw new Error('لا يمكن تعديل منتج في طلب مقفل');

      const validUpdates: any = {};
      if (updates.supplier_id !== undefined) validUpdates.supplier_id = updates.supplier_id;
      if (updates.supplier_name !== undefined) validUpdates.supplier_name = updates.supplier_name;

      if (Object.keys(validUpdates).length === 0) return true;

      const { error } = await supabase
        .from('order_products')
        .update(validUpdates)
        .eq('id', productId);

      if (error) throw error;
      await fetchOrders();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل في تحديث المنتج');
      return false;
    }
  };

  // إنشاء طلب يدوي
  const createManualOrder = async (
    orderData: Omit<Order, 'id' | 'products' | 'order_date' | 'order_number' | 'subtotal_before_tax' | 'tax_amount' | 'total_price'>,
    products: Omit<Product, 'id' | 'subtotal' | 'cost_subtotal'>[]
  ) => {
    try {
      const orderNumber = `ORD-${Date.now().toString().slice(-8)}`;
      const { data: newOrder, error: insertError } = await supabase
        .from('orders')
        .insert({
          ...orderData,
          order_number: orderNumber,
          order_date: new Date().toISOString(),
          is_locked: false,
          subtotal_before_tax: 0,
          tax_amount: 0,
          total_price: 0,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      if (products.length > 0) {
        const productsToInsert = products.map(p => ({
          order_id: newOrder.id,
          product_name: p.name,
          quantity: p.quantity,
          unit_price: p.unit_price,
          cost_price: p.cost_price || 0,
          supplier_id: p.supplier_id || null,
          supplier_name: p.supplier_name || null,
        }));

        const { error: prodError } = await supabase
          .from('order_products')
          .insert(productsToInsert);

        if (prodError) throw prodError;
      }

      await updateOrderTotals(newOrder.id);
      await fetchOrders();
      return newOrder;
    } catch (err: any) {
      setError(`فشل في إنشاء الطلب: ${err.message}`);
      throw err;
    }
  };

  // إضافة منتج إلى طلب موجود
  const addProductToOrder = async (orderId: string, newProduct: Omit<Product, 'id' | 'subtotal' | 'cost_subtotal'>) => {
    try {
      const { data: order } = await supabase
        .from('orders')
        .select('is_locked')
        .eq('id', orderId)
        .single();

      if (order?.is_locked) throw new Error('لا يمكن إضافة منتج إلى طلب مقفل');

      const { data: inserted, error } = await supabase
        .from('order_products')
        .insert({
          order_id: orderId,
          product_name: newProduct.name,
          quantity: newProduct.quantity,
          unit_price: newProduct.unit_price,
          cost_price: newProduct.cost_price || 0,
          supplier_id: newProduct.supplier_id || null,
          supplier_name: newProduct.supplier_name || null,
        })
        .select()
        .single();

      if (error) throw error;

      await updateOrderTotals(orderId);
      await fetchOrders();
      return inserted;
    } catch (err: any) {
      setError(`فشل في إضافة المنتج: ${err.message}`);
      throw err;
    }
  };

  // حذف الطلب + المنتجات المرتبطة (حماية البيانات)
  const deleteOrder = async (orderId: string) => {
    try {
      // حذف المنتجات أولاً (لأن لديها FK)
      await supabase.from('order_products').delete().eq('order_id', orderId);
      const { error } = await supabase.from('orders').delete().eq('id', orderId);
      if (error) throw error;

      await fetchOrders();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل في حذف الطلب');
      return false;
    }
  };

  // جلب البيانات + الاشتراك في التغييرات
  useEffect(() => {
    fetchOrders();

    const channel = supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => fetchOrders()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_products' },
        () => fetchOrders()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchOrders]);

  return {
    orders,
    stats,
    loading,
    error,
    refetch: fetchOrders,
    updateOrderStatus,
    lockOrder,
    updateOrderTotals,
    updateProductCost,
    updateProduct,
    createManualOrder,
    addProductToOrder,
    deleteOrder,
  };
};