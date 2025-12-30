/**
 * دوال تنسيق التاريخ والوقت الموحدة
 * المنطقة الزمنية: Asia/Riyadh (UTC+3)
 * اللغة: العربية السعودية (ar-SA)
 * التقويم: الميلادي (gregory)
 */

/**
 * تنسيق التاريخ والوقت معاً
 * الصيغة: YYYY-MM-DD HH:mm:ss
 * مثال: 2025-12-30 19:45:23
 */
export const formatDateTime = (dateString: string | Date): string => {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  const formatter = new Intl.DateTimeFormat('ar-SA', {
    calendar: 'gregory',
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  return formatter.format(date);
};

/**
 * تنسيق التاريخ فقط
 * الصيغة: YYYY-MM-DD
 * مثال: 2025-12-30
 */
export const formatDate = (dateString: string | Date): string => {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  const formatter = new Intl.DateTimeFormat('ar-SA', {
    calendar: 'gregory',
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(date);
};

/**
 * تنسيق الوقت فقط
 * الصيغة: HH:mm:ss
 * مثال: 19:45:23
 */
export const formatTime = (dateString: string | Date): string => {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  const formatter = new Intl.DateTimeFormat('ar-SA', {
    timeZone: 'Asia/Riyadh',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  return formatter.format(date);
};

/**
 * الحصول على نطاق تاريخ الشهر الحالي
 */
export const getCurrentMonthRange = () => {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  
  return {
    start: firstDay.toISOString(),
    end: lastDay.toISOString()
  };
};

/**
 * الحصول على نطاق تاريخ الشهر الماضي
 */
export const getLastMonthRange = () => {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  
  return {
    start: firstDay.toISOString(),
    end: lastDay.toISOString()
  };
};

/**
 * الحصول على نطاق تاريخ آخر 3 أشهر
 */
export const getLast3MonthsRange = () => {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  
  return {
    start: firstDay.toISOString(),
    end: lastDay.toISOString()
  };
};

/**
 * الحصول على نطاق تاريخ السنة الحالية
 */
export const getCurrentYearRange = () => {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), 0, 1);
  const lastDay = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  
  return {
    start: firstDay.toISOString(),
    end: lastDay.toISOString()
  };
};

/**
 * الحصول على نطاق تاريخ حسب الفترة المختارة
 */
export const getDateRangeByPeriod = (period: string): { start: string; end: string } => {
  switch (period) {
    case 'current_month':
      return getCurrentMonthRange();
    case 'last_month':
      return getLastMonthRange();
    case 'last_3_months':
      return getLast3MonthsRange();
    case 'current_year':
      return getCurrentYearRange();
    case 'all_time':
    default:
      return {
        start: new Date(2000, 0, 1).toISOString(),
        end: new Date().toISOString()
      };
  }
};

/**
 * الحصول على اسم الفترة بالعربية
 */
export const getPeriodLabel = (period: string): string => {
  const labels: Record<string, string> = {
    current_month: 'الشهر الحالي',
    last_month: 'الشهر الماضي',
    last_3_months: 'آخر 3 أشهر',
    current_year: 'السنة الحالية',
    all_time: 'كل الفترات'
  };
  return labels[period] || labels.all_time;
};
