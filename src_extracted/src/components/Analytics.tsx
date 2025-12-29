import React, { useState } from 'react';
import { PieChart, BarChart3, TrendingUp, Calendar, Filter, Download } from 'lucide-react';

interface AnalyticsProps {
  data: any[];
}

const Analytics: React.FC<AnalyticsProps> = ({ data }) => {
  const [timeRange, setTimeRange] = useState('7d');
  const [selectedMetric, setSelectedMetric] = useState('count');

  const sourceData = data.reduce((acc, item) => {
    acc[item.source] = (acc[item.source] || 0) + 1;
    return acc;
  }, {});

  const typeData = data.reduce((acc, item) => {
    acc[item.type] = (acc[item.type] || 0) + 1;
    return acc;
  }, {});

  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

  return (
    <div className="p-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">التحليلات المتقدمة</h2>
        <p className="text-gray-600">تحليل شامل لبيانات Make.com مع رؤى قابلة للتنفيذ</p>
      </div>

      {/* Controls */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-8">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex gap-3">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="24h">آخر 24 ساعة</option>
              <option value="7d">آخر 7 أيام</option>
              <option value="30d">آخر 30 يوم</option>
              <option value="90d">آخر 90 يوم</option>
            </select>

            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="count">عدد السجلات</option>
              <option value="success_rate">معدل النجاح</option>
              <option value="response_time">زمن الاستجابة</option>
            </select>
          </div>

          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center space-x-2 space-x-reverse">
            <Download className="h-4 w-4" />
            <span>تصدير التقرير</span>
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-blue-100 text-blue-600 p-3 rounded-lg">
              <BarChart3 className="h-6 w-6" />
            </div>
            <span className="text-green-500 text-sm font-medium">+12.5%</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">{data.length}</h3>
          <p className="text-gray-600">إجمالي السجلات</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-green-100 text-green-600 p-3 rounded-lg">
              <TrendingUp className="h-6 w-6" />
            </div>
            <span className="text-green-500 text-sm font-medium">+8.3%</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">98.7%</h3>
          <p className="text-gray-600">معدل النجاح</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-purple-100 text-purple-600 p-3 rounded-lg">
              <Calendar className="h-6 w-6" />
            </div>
            <span className="text-green-500 text-sm font-medium">-5.2%</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">2.4s</h3>
          <p className="text-gray-600">متوسط زمن الاستجابة</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-orange-100 text-orange-600 p-3 rounded-lg">
              <PieChart className="h-6 w-6" />
            </div>
            <span className="text-green-500 text-sm font-medium">+15.7%</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">4</h3>
          <p className="text-gray-600">مصادر البيانات</p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Source Distribution */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">توزيع مصادر البيانات</h3>
          <div className="space-y-4">
            {Object.entries(sourceData).map(([source, count], index) => {
              const percentage = ((count as number) / data.length) * 100;
              return (
                <div key={source} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700 font-medium">{source}</span>
                    <span className="text-gray-900 font-bold">{count} ({percentage.toFixed(1)}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="h-3 rounded-full transition-all duration-500"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: colors[index % colors.length]
                      }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Type Analysis */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">تحليل أنواع البيانات</h3>
          <div className="space-y-4">
            {Object.entries(typeData).map(([type, count], index) => {
              const percentage = ((count as number) / data.length) * 100;
              return (
                <div key={type} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3 space-x-reverse">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: colors[index % colors.length] }}
                    ></div>
                    <span className="text-gray-700 font-medium">{type}</span>
                  </div>
                  <div className="text-left">
                    <div className="text-gray-900 font-bold">{count}</div>
                    <div className="text-gray-500 text-sm">{percentage.toFixed(1)}%</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Trends Chart */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">اتجاهات البيانات</h3>
        <div className="h-64 flex items-end justify-between space-x-2 space-x-reverse">
          {[
            { day: 'الاثنين', value: 45 },
            { day: 'الثلاثاء', value: 52 },
            { day: 'الأربعاء', value: 38 },
            { day: 'الخميس', value: 61 },
            { day: 'الجمعة', value: 55 },
            { day: 'السبت', value: 67 },
            { day: 'الأحد', value: 43 }
          ].map((item, index) => (
            <div key={index} className="flex flex-col items-center flex-1">
              <div
                className="bg-blue-500 rounded-t-lg w-full transition-all duration-700 hover:bg-blue-600 cursor-pointer"
                style={{ height: `${item.value}%` }}
                title={`${item.day}: ${item.value} سجل`}
              ></div>
              <span className="text-xs text-gray-600 mt-2">{item.day}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Insights */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">رؤى ذكية</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg p-4 border border-blue-200">
            <h4 className="font-semibold text-gray-900 mb-2">🚀 نمو متسارع</h4>
            <p className="text-gray-600 text-sm">
              زيادة بنسبة 15% في البيانات المستلمة مقارنة بالأسبوع الماضي. استمر على هذا المعدل!
            </p>
          </div>
          
          <div className="bg-white rounded-lg p-4 border border-blue-200">
            <h4 className="font-semibold text-gray-900 mb-2">⚡ أداء ممتاز</h4>
            <p className="text-gray-600 text-sm">
              معدل استجابة 98.7% يضعك في المستوى الأمثل للأداء. لا توجد أخطاء في آخر 48 ساعة.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;