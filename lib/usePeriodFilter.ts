import { useMemo } from 'react';
import { usePeriod } from '../contexts/PeriodContext';

/**
 * Hook لفلترة البيانات حسب الفترة الزمنية المختارة
 * يدعم حقول: created_at, order_date, transaction_date, date, payment_date, receipt_date
 */
export const usePeriodFilter = <T extends Record<string, any>>(
  data: T[],
  dateField?: keyof T
): T[] => {
  const { selectedPeriod, getDateRange } = usePeriod();

  return useMemo(() => {
    if (selectedPeriod === 'all_time') {
      return data;
    }

    const { start, end } = getDateRange();

    return data.filter(item => {
      // تحديد الحقل المناسب
      const field = dateField || (
                   item.created_at ? 'created_at' :
                   item.order_date ? 'order_date' :
                   item.transaction_date ? 'transaction_date' :
                   item.payment_date ? 'payment_date' :
                   item.receipt_date ? 'receipt_date' :
                   item.date ? 'date' : null);

      if (!field || !item[field]) return true;

      const itemDate = new Date(item[field]);
      return itemDate >= start && itemDate <= end;
    });
  }, [data, selectedPeriod, getDateRange, dateField]);
};
