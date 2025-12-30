// تنسيق التاريخ والوقت للعرض في التقارير والسجلات
export const formatDateTime = (dateString: string): string => {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'غير محدد';
  
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

// تنسيق التاريخ فقط
export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'غير محدد';
  
  const formatter = new Intl.DateTimeFormat('ar-SA', {
    calendar: 'gregory',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  
  return formatter.format(date);
};

// تنسيق الوقت فقط
export const formatTime = (dateString: string): string => {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'غير محدد';
  
  const formatter = new Intl.DateTimeFormat('ar-SA', {
    calendar: 'gregory',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  return formatter.format(date);
};
