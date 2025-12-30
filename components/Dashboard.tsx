import React, { useMemo, useState } from 'react';
import { DollarSign, TrendingUp, Package, Truck } from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import { useOrders } from '../hooks/useOrders';
import { createClient } from '@supabase/supabase-js';
import { useQuery, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { formatDateTime, getDateRangeByPeriod, getPeriodLabel } from '../lib/dateFormatter';

// إنشاء Supabase Client مرة واحدة فقط خارج المكون
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const TAX_RATE = 0.15;

// إنشاء QueryClient داخل الملف (لكن نضعه داخل Wrapper لتجنب إعادة الإنشاء)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

// Wrapper لتوفير QueryClient للمكون الداخلي
const DashboardContent: React.FC = () => {
  const { orders, stats, loading: ordersLoading, error: ordersError } = useOrders();
  const [selectedPeriod, setSelectedPeriod] = useState<string>('current_month');

  // حساب نطاق التاريخ حسب الفترة المختارة
  const periodRange = useMemo(() => getDateRangeByPeriod(selectedPeriod), [selectedPeriod]);

  // تصفية الطلبات حسب الفترة المختارة
  const filteredOrders = useMemo(() => {
    if (selectedPeriod === 'all_time') return orders;
    return orders.filter((order: any) => {
      const orderDate = new Date(order.order_date || order.created_at);
      return orderDate >= new Date(periodRange.start) && orderDate <= new Date(periodRange.end);
    });
  }, [orders, selectedPeriod, periodRange]);

  // جلب طرق الدفع
  const { data: paymentMethods = [], isLoading: pmLoading } = useQuery({
    queryKey: ['payment_methods'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_methods')
        .select('id, code, name, percentage_fee, fixed_fee')
        .eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
  });

  // جلب المصروفات (آخر 30 يوم)
  const { data: expenses = [], isLoading: expensesLoading } = useQuery({
    queryKey: ['expenses', 'last30days'],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data, error } = await supabase
        .from('expenses')
        .select('amount')
        .gte('date', thirtyDaysAgo.toISOString().split('T')[0]);
      if (error) throw error;
      return data || [];
    },
  });

  const totalOtherExpenses = useMemo(() => {
    return expenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0);
  }, [expenses]);

  const getPaymentFee = (paymentMethodCode: string | null | undefined, totalPrice: number): number => {
    if (!paymentMethodCode || !totalPrice) return 0;
    const method = paymentMethods.find(m => m.code === paymentMethodCode);
    if (!method) return 0;
    const percentageFee = totalPrice * (method.percentage_fee / 100);
    const totalFee = percentageFee + (method.fixed_fee || 0);
    return Number(totalFee.toFixed(2));
  };

  const calculateNetProfit = (order: any) => {
    const revenue = order.total_price || 0;
    const productCostInclTax = order.products?.reduce((sum: number, p: any) => sum + (p.cost_subtotal || 0), 0) || 0;
    const shippingWithTax = (order.shipping_cost || 0) * (1 + TAX_RATE);
    const paymentFee = getPaymentFee(order.payment_method, revenue);
    const netProfit = revenue - paymentFee - shippingWithTax - productCostInclTax;
    return { netProfit, paymentFee, shippingWithTax, productCostInclTax };
  };

  const lockedOrders = useMemo(() =>
    filteredOrders.filter((order: any) => order.is_locked === true),
    [filteredOrders]
  );

  const totalSales = useMemo(() =>
    lockedOrders.reduce((sum, o) => sum + (o.total_price || 0), 0),
    [lockedOrders]
  );

  const totalNetProfit = useMemo(() =>
    lockedOrders.reduce((sum, o) => sum + calculateNetProfit(o).netProfit, 0),
    [lockedOrders]
  );

  const totalPaymentFees = useMemo(() =>
    lockedOrders.reduce((sum, o) => sum + calculateNetProfit(o).paymentFee, 0),
    [lockedOrders]
  );

  const openOrdersCount = useMemo(() =>
    filteredOrders.filter((o: any) => !o.is_locked && o.status !== 'ملغي').length,
    [filteredOrders]
  );

  const lockedOrdersCount = useMemo(() =>
    filteredOrders.filter((o: any) => o.is_locked).length,
    [filteredOrders]
  );

  const cancelledOrdersCount = useMemo(() =>
    filteredOrders.filter((o: any) => o.status === 'ملغي').length,
    [filteredOrders]
  );

  const totalShippingCosts = useMemo(() =>
    lockedOrders.reduce((sum, o) => sum + calculateNetProfit(o).shippingWithTax, 0),
    [lockedOrders]
  );

  const totalProductCosts = useMemo(() =>
    lockedOrders.reduce((sum, o) => sum + calculateNetProfit(o).productCostInclTax, 0),
    [lockedOrders]
  );

  const finalNetProfit = totalSales - totalPaymentFees - totalShippingCosts - totalProductCosts - totalOtherExpenses;

  // آخر 7 أيام
  const lastWeekDates = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (6 - i));
      return date;
    });
  }, []);

  const dailyNetProfits = useMemo(() => {
    return lastWeekDates.map(date => {
      const dayOrders = lockedOrders.filter((order: any) => {
        const orderDate = new Date(order.order_date);
        return orderDate.toDateString() === date.toDateString();
      });
      return dayOrders.reduce((sum, order) => sum + calculateNetProfit(order).netProfit, 0);
    });
  }, [lockedOrders, lastWeekDates]);

  const formattedDates = useMemo(() =>
    lastWeekDates.map(date => date.toLocaleDateString('EN-US', { day: 'numeric', month: 'short' })),
    [lastWeekDates]
  );

  const dailyNetProfitOption = useMemo(() => ({
    title: { text: 'صافي الربح اليومي (آخر 7 أيام)', textStyle: { color: '#111111' } },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: formattedDates },
    yAxis: { name: 'صافي الربح (ر.س)' },
    series: [{
      type: 'line',
      data: dailyNetProfits,
      smooth: true,
      lineStyle: { color: '#D4AF37', width: 3 },
      itemStyle: { color: '#D4AF37' },
      areaStyle: { color: 'rgba(212, 175, 55, 0.15)' }
    }],
    grid: { left: '10%', right: '10%', bottom: '15%' }
  }), [formattedDates, dailyNetProfits]);

  const shippingCostsByCompany = useMemo(() => {
    const costs: Record<string, number> = {};
    lockedOrders.forEach((order: any) => {
      const company = order.shipping_company || 'غير محدد';
      const costWithTax = (order.shipping_cost || 0) * (1 + TAX_RATE);
      costs[company] = (costs[company] || 0) + costWithTax;
    });
    return Object.entries(costs)
      .sort(([, a], [, b]) => b - a)
      .map(([company, total]) => ({ company, total: Number(total.toFixed(2)) }));
  }, [lockedOrders]);

  const formatCurrency = (value: number) =>
    `SAR ${value.toLocaleString('EN-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const isLoading = ordersLoading || pmLoading || expensesLoading;

  if (isLoading) {
    return (
      <div className="p-4 min-h-screen bg-page-100">
        <div className="animate-pulse space-y-6">
          <div className="h-6 bg-beige-200 rounded-xl w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl p-6 border border-beige-200">
                <div className="h-10 bg-beige-200 rounded-lg mb-4"></div>
                <div className="h-4 bg-beige-200 rounded w-32"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (ordersError) {
    return <div className="p-8 text-center text-red-600">حدث خطأ: {ordersError}</div>;
  }

  return (
    <div className="p-4 min-h-screen bg-page-100 space-y-6" dir="rtl">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-gradient-to-r from-gold-500 to-gold-600 p-2 md:p-3 rounded-xl shadow-gold">
          <DollarSign className="h-6 w-6 md:h-8 md:w-8 text-royal-900" />
        </div>
        <div>
          <h1 className="text-xl md:text-3xl font-bold text-royal-900">لوحة التحكم المالية</h1>
          <p className="text-sm md:text-base text-royal-400">نظرة شاملة على الأداء المالي</p>
        </div>
      </div>

      {/* فلتر الفترة الزمنية */}
      <div className="bg-white rounded-xl p-4 border border-beige-200 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <label className="font-semibold text-royal-900">عرض البيانات:</label>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 md:flex-none">
            <select 
              value={selectedPeriod} 
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="px-4 py-2 border border-beige-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500 bg-white text-royal-900"
            >
              <option value="current_month">الشهر الحالي</option>
              <option value="last_month">الشهر الماضي</option>
              <option value="last_3_months">آخر 3 أشهر</option>
              <option value="current_year">السنة الحالية</option>
              <option value="all_time">كل الفترات</option>
            </select>
            
            <div className="text-sm text-royal-600 bg-gold-50 px-4 py-2 rounded-lg border border-gold-200">
              <span className="font-medium">الفترة:</span> {formatDateTime(new Date(periodRange.start))} - {formatDateTime(new Date(periodRange.end))}
            </div>
          </div>
        </div>
      </div>

      {/* إحصائيات أعداد الطلبات */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
        <div className="bg-white rounded-xl md:rounded-2xl p-4 md:p-6 border border-beige-200 shadow-luxury hover:shadow-xl transition-all border-r-4 border-r-gold-500">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-royal-400 text-sm font-medium">الطلبات المفتوحة</h3>
              <p className="text-2xl md:text-3xl font-bold text-royal-900 mt-2">{openOrdersCount}</p>
            </div>
            <div className="p-3 bg-gold-50 rounded-full">
              <Package className="h-6 w-6 text-gold-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl md:rounded-2xl p-4 md:p-6 border border-beige-200 shadow-luxury hover:shadow-xl transition-all border-r-4 border-r-green-500">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-royal-400 text-sm font-medium">الطلبات المقفلة</h3>
              <p className="text-2xl md:text-3xl font-bold text-royal-900 mt-2">{lockedOrdersCount}</p>
            </div>
            <div className="p-3 bg-green-50 rounded-full">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl md:rounded-2xl p-4 md:p-6 border border-beige-200 shadow-luxury hover:shadow-xl transition-all border-r-4 border-r-red-500">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-royal-400 text-sm font-medium">الطلبات الملغية</h3>
              <p className="text-2xl md:text-3xl font-bold text-royal-900 mt-2">{cancelledOrdersCount}</p>
            </div>
            <div className="p-3 bg-red-50 rounded-full">
              <Package className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {[
          { title: 'إجمالي المبيعات', value: formatCurrency(totalSales), color: 'gold' },
          { title: 'صافي الربح (بعد كل التكاليف)', value: formatCurrency(finalNetProfit), color: finalNetProfit >= 0 ? 'green' : 'red' },
          { title: 'متوسط قيمة الطلب', value: lockedOrders.length > 0 ? formatCurrency(totalSales / lockedOrders.length) : 'SAR 0.00', color: 'royal' },
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-xl md:rounded-2xl p-4 md:p-6 border border-beige-200 shadow-luxury hover:shadow-xl transition-all">
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <div className={`p-2 md:p-3 rounded-lg ${stat.color === 'gold' ? 'bg-gold-50 border border-gold-200' : stat.color === 'green' ? 'bg-green-50 border border-green-200' : stat.color === 'red' ? 'bg-red-50 border border-red-200' : 'bg-page-100 border border-beige-200'}`}>
                {i === 0 && <DollarSign className={`h-5 w-5 md:h-6 md:w-6 ${stat.color === 'gold' ? 'text-gold-600' : 'text-green-600'}`} />}
                {i === 1 && <TrendingUp className={`h-5 w-5 md:h-6 md:w-6 ${stat.color === 'green' ? 'text-green-600' : 'text-red-600'}`} />}
                {i === 2 && <Package className="h-5 w-5 md:h-6 md:w-6 text-royal-600" />}
              </div>
            </div>
            <h3 className="text-lg md:text-2xl font-bold text-royal-900">{stat.value}</h3>
            <p className="text-royal-400 text-xs md:text-sm mt-1">{stat.title}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl md:rounded-2xl p-4 md:p-6 border border-beige-200 shadow-luxury">
        <h3 className="text-lg md:text-xl font-bold mb-4 md:mb-6 text-royal-900">التحليل المالي التفصيلي</h3>
        <div className="space-y-2 md:space-y-3 text-xs md:text-sm">
          <div className="flex justify-between"><span className="text-royal-600">إجمالي المبيعات</span><strong className="text-sm md:text-base text-royal-900">{formatCurrency(totalSales)}</strong></div>
          <div className="flex justify-between text-red-600"><span>رسوم بوابات الدفع</span><strong className="text-sm md:text-base">-{formatCurrency(totalPaymentFees)}</strong></div>
          <div className="flex justify-between text-red-600"><span>تكلفة الشحن (شامل الضريبة)</span><strong className="text-sm md:text-base">-{formatCurrency(totalShippingCosts)}</strong></div>
          <div className="flex justify-between text-red-600"><span>تكلفة المنتجات</span><strong className="text-sm md:text-base">-{formatCurrency(totalProductCosts)}</strong></div>
          <div className="flex justify-between text-red-600"><span>مصروفات أخرى (آخر 30 يوم)</span><strong className="text-sm md:text-base">-{formatCurrency(totalOtherExpenses)}</strong></div>
          <div className="border-t border-beige-200 pt-3 md:pt-4 flex justify-between text-base md:text-lg font-bold">
            <span className="text-royal-900">صافي الربح النهائي</span>
            <span className={finalNetProfit >= 0 ? 'text-green-600' : 'text-red-600'}>
              {formatCurrency(finalNetProfit)}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl md:rounded-2xl p-4 md:p-6 border border-beige-200 shadow-luxury">
        <h3 className="text-lg md:text-xl font-bold mb-4 text-royal-900">صافي الربح اليومي (آخر 7 أيام)</h3>
        <div className="-mx-2 md:mx-0">
          <ReactECharts option={dailyNetProfitOption} style={{ height: '280px' }} className="md:!h-[350px]" />
        </div>
      </div>

      <div className="bg-white rounded-xl md:rounded-2xl p-4 md:p-6 border border-beige-200 shadow-luxury">
        <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
          <Truck className="h-5 w-5 md:h-7 md:w-7 text-gold-600" />
          <h3 className="text-base md:text-xl font-bold text-royal-900">تكاليف الشحن حسب الشركة</h3>
        </div>
        <div className="overflow-x-auto -mx-4 md:mx-0">
          <table className="w-full text-xs md:text-sm">
            <thead className="bg-page-100">
              <tr>
                <th className="px-3 md:px-6 py-2 md:py-3 text-right font-bold text-royal-800 border-b-2 border-beige-200">شركة الشحن</th>
                <th className="px-3 md:px-6 py-2 md:py-3 text-right font-bold text-royal-800 border-b-2 border-beige-200">التكلفة الإجمالية</th>
              </tr>
            </thead>
            <tbody>
              {shippingCostsByCompany.map(({ company, total }) => (
                <tr key={company} className="hover:bg-gold-50/50 border-b border-beige-200">
                  <td className="px-3 md:px-6 py-3 md:py-4 text-royal-700">{company}</td>
                  <td className="px-3 md:px-6 py-3 md:py-4 font-semibold text-royal-900">{formatCurrency(total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// المكون الرئيسي المُصدَّر (مع QueryClientProvider داخلي)
const Dashboard: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <DashboardContent />
    </QueryClientProvider>
  );
};

export default Dashboard;