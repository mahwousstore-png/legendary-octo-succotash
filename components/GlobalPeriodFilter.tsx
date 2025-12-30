import React from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { usePeriod } from '../contexts/PeriodContext';
import { formatDateTime } from '../lib/dateFormatter';

const GlobalPeriodFilter = () => {
  const {
    selectedPeriod,
    setSelectedPeriod,
    customStartDate,
    customEndDate,
    setCustomStartDate,
    setCustomEndDate,
    getDateRange,
    getPeriodLabel
  } = usePeriod();

  const dateRange = getDateRange();

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
        
        {/* أيقونة وعنوان */}
        <div className="flex items-center gap-2 min-w-fit">
          <Calendar className="h-5 w-5 text-[#D4AF37]" />
          <span className="text-sm font-semibold text-gray-700">الفترة الزمنية:</span>
        </div>

        {/* القائمة المنسدلة */}
        <div className="relative flex-1 w-full lg:w-auto">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value as any)}
            className="w-full lg:min-w-[200px] px-4 py-2.5 pr-10 
                       border border-gray-300 rounded-lg
                       bg-white text-sm font-medium
                       focus:ring-2 focus:ring-[#D4AF37] focus:border-[#D4AF37]
                       appearance-none cursor-pointer
                       transition-all duration-200"
          >
            <option value="today">📅 اليوم</option>
            <option value="yesterday">📅 أمس</option>
            <option value="this_week">📅 هذا الأسبوع</option>
            <option value="last_week">📅 الأسبوع الماضي</option>
            <option value="this_month">📅 هذا الشهر (افتراضي)</option>
            <option value="last_month">📅 الشهر الماضي</option>
            <option value="this_year">📅 هذه السنة</option>
            <option value="last_year">📅 السنة الماضية</option>
            <option value="custom">🎯 تحديد مخصص</option>
            <option value="all_time">♾️ كل الفترات</option>
          </select>
          <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        </div>

        {/* التواريخ المخصصة */}
        {selectedPeriod === 'custom' && (
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 whitespace-nowrap">من:</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg
                           focus:ring-2 focus:ring-[#D4AF37] focus:border-[#D4AF37]
                           text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 whitespace-nowrap">إلى:</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg
                           focus:ring-2 focus:ring-[#D4AF37] focus:border-[#D4AF37]
                           text-sm"
              />
            </div>
          </div>
        )}

        {/* عرض النطاق الزمني */}
        {selectedPeriod !== 'all_time' && (
          <div className="flex-1 lg:flex-none w-full lg:w-auto">
            <div className="bg-gradient-to-r from-[#D4AF37]/10 to-transparent 
                            border border-[#D4AF37]/20 rounded-lg px-4 py-2">
              <p className="text-xs text-gray-500 mb-0.5">نطاق العرض:</p>
              <p className="text-sm font-semibold text-gray-900" dir="ltr">
                {formatDateTime(dateRange.start.toISOString())}
                <span className="mx-2 text-gray-400">→</span>
                {formatDateTime(dateRange.end.toISOString())}
              </p>
            </div>
          </div>
        )}

        {/* Badge الفترة المختارة */}
        <div className="hidden lg:block">
          <span className="inline-flex items-center px-3 py-1.5 
                           bg-[#D4AF37] text-black text-xs font-bold rounded-full">
            {getPeriodLabel()}
          </span>
        </div>
      </div>
    </div>
  );
};

export default GlobalPeriodFilter;
