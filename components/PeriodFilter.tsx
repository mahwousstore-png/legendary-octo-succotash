import React from 'react';
import { Calendar } from 'lucide-react';
import { getPeriodRange, formatDateTime } from '../lib/periodHelper';

interface PeriodFilterProps {
  selectedPeriod: string;
  onPeriodChange: (period: string) => void;
  customStartDate?: string;
  customEndDate?: string;
  onCustomDateChange?: (start: string, end: string) => void;
}

const PeriodFilter = ({
  selectedPeriod,
  onPeriodChange,
  customStartDate,
  customEndDate,
  onCustomDateChange
}: PeriodFilterProps) => {
  const periodRanges = getPeriodRange(selectedPeriod, customStartDate, customEndDate);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
        {/* اختيار الفترة */}
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-gray-600" />
          <label className="text-sm font-semibold text-gray-700 whitespace-nowrap">
            عرض بيانات:
          </label>
          <select
            value={selectedPeriod}
            onChange={(e) => onPeriodChange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white min-w-[180px]"
          >
            <option value="current_month">الشهر الحالي</option>
            <option value="last_month">الشهر الماضي</option>
            <option value="last_3_months">آخر 3 أشهر</option>
            <option value="last_6_months">آخر 6 أشهر</option>
            <option value="current_year">السنة الحالية</option>
            <option value="last_year">السنة الماضية</option>
            <option value="custom">فترة مخصصة</option>
            <option value="all_time">كل الفترات</option>
          </select>
        </div>

        {/* فترة مخصصة */}
        {selectedPeriod === 'custom' && onCustomDateChange && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">من:</span>
            <input
              type="date"
              value={customStartDate || ''}
              onChange={(e) => onCustomDateChange(e.target.value, customEndDate || '')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600">إلى:</span>
            <input
              type="date"
              value={customEndDate || ''}
              onChange={(e) => onCustomDateChange(customStartDate || '', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {/* عرض نطاق التاريخ */}
        {selectedPeriod !== 'all_time' && (
          <div className="flex-1 text-sm text-gray-600 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
            <span className="font-semibold text-blue-700">الفترة:</span>{' '}
            {formatDateTime(periodRanges.start)} - {formatDateTime(periodRanges.end)}
          </div>
        )}
      </div>
    </div>
  );
};

export default PeriodFilter;
