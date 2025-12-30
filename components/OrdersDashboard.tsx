import React, { useState, useMemo } from 'react';
import { ShoppingCart, Users, DollarSign, Clock, CheckCircle, Package } from 'lucide-react';
import { useOrders } from '../hooks/useOrders';
import { Order } from '../types/order';
import { formatDateTime, getDateRangeByPeriod, getPeriodLabel } from '../lib/dateFormatter';

const OrdersDashboard: React.FC = () => {
  const { orders, stats, loading, error } = useOrders();
  const [selectedPeriod, setSelectedPeriod] = useState<string>('current_month');

  // حساب نطاق التاريخ حسب الفترة المختارة
  const periodRange = useMemo(() => getDateRangeByPeriod(selectedPeriod), [selectedPeriod]);

  // تصفية الطلبات حسب الفترة المختارة
  const filteredOrders = useMemo(() => {
    if (selectedPeriod === 'all_time') return orders;
    return orders.filter((order: Order) => {
      const orderDate = new Date(order.order_date || order.created_at);
      return orderDate >= new Date(periodRange.start) && orderDate <= new Date(periodRange.end);
    });
  }, [orders, selectedPeriod, periodRange]);

  // إعادة حساب الإحصائيات للفترة المختارة
  const periodStats = useMemo(() => {
    const unlockedOrders = filteredOrders.filter((o: Order) => !o.is_locked);
    const lockedOrders = filteredOrders.filter((o: Order) => o.is_locked);
    
    return {
      total_orders: filteredOrders.length,
      total_revenue: filteredOrders.reduce((sum, o) => sum + (o.total_price || 0), 0),
      pending_orders: unlockedOrders.length,
      completed_orders: lockedOrders.length,
      unlocked_orders: unlockedOrders.length,
      average_order_value: filteredOrders.length > 0 
        ? filteredOrders.reduce((sum, o) => sum + (o.total_price || 0), 0) / filteredOrders.length 
        : 0
    };
  }, [filteredOrders]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl p-6">
                <div className="h-12 bg-gray-200 rounded mb-4"></div>
                <div className="h-6 bg-gray-200 rounded mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-800">خطأ: {error}</p>
        </div>
      </div>
    );
  }

  const statsCards = [
    {
      title: 'إجمالي الطلبات',
      value: periodStats.total_orders.toString(),
      icon: ShoppingCart,
      color: 'blue',
      change: '+12%'
    },
    {
      title: 'إجمالي الإيرادات',
      value: `${periodStats.total_revenue.toLocaleString('EN-US')} ر.س`,
      icon: DollarSign,
      color: 'green',
      change: '+18%'
    },
    {
      title: 'طلبات معلقة',
      value: periodStats.pending_orders.toString(),
      icon: Clock,
      color: 'orange',
      change: '-5%'
    },
    {
      title: 'طلبات مكتملة',
      value: periodStats.completed_orders.toString(),
      icon: CheckCircle,
      color: 'purple',
      change: '+22%'
    },
    {
      title: 'طلبات غير مقفلة',
      value: periodStats.unlocked_orders.toString(),
      icon: Clock,
      color: 'orange',
      change: `${periodStats.unlocked_orders > 0 ? '+' : ''}${periodStats.unlocked_orders}`
    }
  ];

  const getColorClasses = (color: string) => {
    const colors = {
      blue: 'bg-blue-50 text-blue-600 border-blue-200',
      green: 'bg-green-50 text-green-600 border-green-200',
      orange: 'bg-orange-50 text-orange-600 border-orange-200',
      purple: 'bg-purple-50 text-purple-600 border-purple-200'
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  const getStatusColor = (status: string) => {
    const statusColors = {
      'جديد': 'bg-blue-100 text-blue-800',
      'مؤكد': 'bg-green-100 text-green-800',
      'قيد التجهيز': 'bg-yellow-100 text-yellow-800',
      'تم الشحن': 'bg-purple-100 text-purple-800',
      'مسلم': 'bg-green-100 text-green-800',
      'ملغي': 'bg-red-100 text-red-800'
    };
    return statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">لوحة تحكم الطلبات</h2>
        <p className="text-gray-600">إدارة ومتابعة جميع الطلبات الواردة</p>
      </div>

      {/* فلتر الفترة الزمنية */}
      <div className="bg-white rounded-xl p-4 mb-6 border border-gray-200 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <label className="font-semibold text-gray-700">عرض البيانات:</label>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 md:flex-none">
            <select 
              value={selectedPeriod} 
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
            >
              <option value="current_month">الشهر الحالي</option>
              <option value="last_month">الشهر الماضي</option>
              <option value="last_3_months">آخر 3 أشهر</option>
              <option value="current_year">السنة الحالية</option>
              <option value="all_time">كل الفترات</option>
            </select>
            
            <div className="text-sm text-gray-600 bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
              <span className="font-medium">الفترة:</span> {formatDateTime(new Date(periodRange.start))} - {formatDateTime(new Date(periodRange.end))}
            </div>
          </div>
        </div>
      </div>

      {/* إحصائيات سريعة */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        {statsCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-shadow duration-200">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg border ${getColorClasses(stat.color)}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <span className="text-green-600 text-sm font-medium">{stat.change}</span>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-1">{stat.value}</h3>
                <p className="text-gray-600 text-sm">{stat.title}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* متوسط قيمة الطلب */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">متوسط قيمة الطلب</h3>
            <p className="text-3xl font-bold text-blue-600">
              {periodStats.average_order_value.toLocaleString('EN-US', { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
              })} ر.س
            </p>
          </div>
          <div className="bg-blue-600 text-white p-4 rounded-lg">
            <Package className="h-8 w-8" />
          </div>
        </div>
      </div>

      {/* آخر الطلبات */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">آخر الطلبات</h3>
        <div className="space-y-4">
          {filteredOrders.slice(0, 10).map((order: Order) => (
            <div key={order.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-150">
              <div className="flex items-center space-x-4 space-x-reverse">
                <div className="bg-blue-100 text-blue-600 p-2 rounded-lg">
                  <ShoppingCart className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">{order.customer_name}</h4>
                  <p className="text-sm text-gray-600">طلب رقم: {order.order_number}</p>
                  <p className="text-sm text-gray-600">{order.phone_number}</p>
                </div>
              </div>
              
              <div className="text-center">
                <p className="font-bold text-gray-900">
                  {parseFloat(order.total_price.toString()).toLocaleString('EN-US')} ر.س
                </p>
                <p className="text-sm text-gray-600">
                  {order.products?.length || 0} منتج
                </p>
              </div>
              
              <div className="text-left">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                  {order.status}
                </span>
                <p className="text-sm text-gray-600 mt-1">
                  {formatDateTime(order.order_date)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default OrdersDashboard;