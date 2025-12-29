import React from 'react';
import { ShoppingCart, Users, DollarSign, Clock, CheckCircle, Package } from 'lucide-react';
import { useOrders } from '../hooks/useOrders';
import { Order } from '../types/order';

const OrdersDashboard: React.FC = () => {
  const { orders, stats, loading, error } = useOrders();

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
      value: stats.total_orders.toString(),
      icon: ShoppingCart,
      color: 'blue',
      change: '+12%'
    },
    {
      title: 'إجمالي الإيرادات',
      value: `${stats.total_revenue.toLocaleString('EN-US')} ر.س`,
      icon: DollarSign,
      color: 'green',
      change: '+18%'
    },
    {
      title: 'طلبات معلقة',
      value: stats.pending_orders.toString(),
      icon: Clock,
      color: 'orange',
      change: '-5%'
    },
    {
      title: 'طلبات مكتملة',
      value: stats.completed_orders.toString(),
      icon: CheckCircle,
      color: 'purple',
      change: '+22%'
    },
    {
      title: 'طلبات غير مقفلة',
      value: stats.unlocked_orders.toString(),
      icon: Clock,
      color: 'orange',
      change: `${stats.unlocked_orders > 0 ? '+' : ''}${stats.unlocked_orders}`
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
              {stats.average_order_value.toLocaleString('EN-US', { 
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
          {orders.slice(0, 10).map((order: Order) => (
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
                  {new Date(order.order_date).toLocaleDateString('ar-SA')}
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