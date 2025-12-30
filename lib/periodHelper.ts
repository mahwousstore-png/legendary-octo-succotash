export interface PeriodRange {
  start: Date;
  end: Date;
  label: string;
}

export const getPeriodRange = (
  period: string,
  customStart?: string,
  customEnd?: string
): PeriodRange => {
  const now = new Date();
  let start: Date;
  let end: Date;
  let label: string;

  switch (period) {
    case 'current_month':
      // من أول يوم في الشهر الحالي إلى آخر يوم
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      label = 'الشهر الحالي';
      break;

    case 'last_month':
      // من أول يوم في الشهر الماضي إلى آخر يوم
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      label = 'الشهر الماضي';
      break;

    case 'last_3_months':
      // آخر 3 أشهر
      start = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      label = 'آخر 3 أشهر';
      break;

    case 'last_6_months':
      // آخر 6 أشهر
      start = new Date(now.getFullYear(), now.getMonth() - 5, 1, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      label = 'آخر 6 أشهر';
      break;

    case 'current_year':
      // من أول يناير حتى آخر ديسمبر في السنة الحالية
      start = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
      end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
      label = 'السنة الحالية';
      break;

    case 'last_year':
      // السنة الماضية
      start = new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0);
      end = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
      label = 'السنة الماضية';
      break;

    case 'custom':
      // فترة مخصصة
      if (customStart && customEnd) {
        start = new Date(customStart);
        start.setHours(0, 0, 0, 0);
        end = new Date(customEnd);
        end.setHours(23, 59, 59, 999);
        label = 'فترة مخصصة';
      } else {
        // إذا لم تحدد، استخدم الشهر الحالي
        start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        label = 'الشهر الحالي';
      }
      break;

    case 'all_time':
    default:
      // كل الفترات - من 2000 حتى 2100
      start = new Date(2000, 0, 1, 0, 0, 0);
      end = new Date(2100, 11, 31, 23, 59, 59);
      label = 'كل الفترات';
      break;
  }

  return { start, end, label };
};

// دالة للتحقق إذا كان التاريخ ضمن النطاق
export const isDateInRange = (date: string | Date, range: PeriodRange): boolean => {
  const checkDate = typeof date === 'string' ? new Date(date) : date;
  return checkDate >= range.start && checkDate <= range.end;
};

// دالة لفلترة البيانات حسب الفترة
export const filterByPeriod = <T extends { created_at?: string; date?: string; order_date?: string; transaction_date?: string; receipt_date?: string }>(
  data: T[],
  period: string,
  customStart?: string,
  customEnd?: string
): T[] => {
  if (period === 'all_time') {
    return data;
  }

  const range = getPeriodRange(period, customStart, customEnd);

  return data.filter(item => {
    const dateField = item.created_at || item.date || item.order_date || item.transaction_date || item.receipt_date;
    if (!dateField) return false;
    return isDateInRange(dateField, range);
  });
};

// دالة لتنسيق التاريخ بالعربية
export const formatDateTime = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const formatter = new Intl.DateTimeFormat('ar-SA', {
    calendar: 'gregory',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  return formatter.format(dateObj);
};
