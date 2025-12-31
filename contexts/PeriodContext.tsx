import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type PeriodType = 
  | 'today'           // اليوم
  | 'yesterday'       // أمس
  | 'this_week'       // هذا الأسبوع
  | 'last_week'       // الأسبوع الماضي
  | 'this_month'      // هذا الشهر
  | 'last_month'      // الشهر الماضي
  | 'this_year'       // هذه السنة
  | 'last_year'       // السنة الماضية
  | 'custom'          // تحديد مخصص
  | 'all_time';       // كل الفترات

export interface DateRange {
  start: Date;
  end: Date;
}

interface PeriodContextType {
  selectedPeriod: PeriodType;
  setSelectedPeriod: (period: PeriodType) => void;
  customStartDate: string;
  customEndDate: string;
  setCustomStartDate: (date: string) => void;
  setCustomEndDate: (date: string) => void;
  getDateRange: () => DateRange;
  getPeriodLabel: () => string;
}

const PeriodContext = createContext<PeriodContextType | undefined>(undefined);

interface PeriodProviderProps {
  children: ReactNode;
}

export const PeriodProvider = ({ children }: PeriodProviderProps) => {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('this_month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // تحميل من localStorage عند البداية
  useEffect(() => {
    const saved = localStorage.getItem('mahwous_selected_period');
    if (saved) {
      setSelectedPeriod(saved as PeriodType);
    }
    const savedStart = localStorage.getItem('mahwous_custom_start');
    const savedEnd = localStorage.getItem('mahwous_custom_end');
    if (savedStart) setCustomStartDate(savedStart);
    if (savedEnd) setCustomEndDate(savedEnd);
  }, []);

  // حفظ في localStorage عند التغيير
  useEffect(() => {
    localStorage.setItem('mahwous_selected_period', selectedPeriod);
  }, [selectedPeriod]);

  useEffect(() => {
    if (customStartDate) {
      localStorage.setItem('mahwous_custom_start', customStartDate);
    }
    if (customEndDate) {
      localStorage.setItem('mahwous_custom_end', customEndDate);
    }
  }, [customStartDate, customEndDate]);

  const getDateRange = (): DateRange => {
    const now = new Date();
    let start: Date;
    let end: Date;

    switch (selectedPeriod) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        break;

      case 'yesterday':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
        break;

      case 'this_week':
        const dayOfWeek = now.getDay();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - dayOfWeek);
        startOfWeek.setHours(0, 0, 0, 0);
        
        start = startOfWeek;
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        break;

      case 'last_week':
        const lastWeekStart = new Date(now);
        lastWeekStart.setDate(now.getDate() - now.getDay() - 7);
        lastWeekStart.setHours(0, 0, 0, 0);
        
        const lastWeekEnd = new Date(lastWeekStart);
        lastWeekEnd.setDate(lastWeekStart.getDate() + 6);
        lastWeekEnd.setHours(23, 59, 59, 999);
        
        start = lastWeekStart;
        end = lastWeekEnd;
        break;

      case 'this_month':
        start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        break;

      case 'last_month':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        break;

      case 'this_year':
        start = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
        end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
        break;

      case 'last_year':
        start = new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0);
        end = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
        break;

      case 'custom':
        start = customStartDate ? new Date(customStartDate) : new Date(now.getFullYear(), 0, 1);
        end = customEndDate ? new Date(customEndDate) : now;
        end.setHours(23, 59, 59, 999);
        break;

      case 'all_time':
      default:
        start = new Date(2020, 0, 1, 0, 0, 0);
        end = now;
        break;
    }

    return { start, end };
  };

  const getPeriodLabel = (): string => {
    const labels: Record<PeriodType, string> = {
      today: 'اليوم',
      yesterday: 'أمس',
      this_week: 'هذا الأسبوع',
      last_week: 'الأسبوع الماضي',
      this_month: 'هذا الشهر',
      last_month: 'الشهر الماضي',
      this_year: 'هذه السنة',
      last_year: 'السنة الماضية',
      custom: 'فترة مخصصة',
      all_time: 'كل الفترات'
    };
    return labels[selectedPeriod];
  };

  return (
    <PeriodContext.Provider
      value={{
        selectedPeriod,
        setSelectedPeriod,
        customStartDate,
        customEndDate,
        setCustomStartDate,
        setCustomEndDate,
        getDateRange,
        getPeriodLabel
      }}
    >
      {children}
    </PeriodContext.Provider>
  );
};

export const usePeriod = () => {
  const context = useContext(PeriodContext);
  if (!context) {
    console.error('❌ usePeriod must be used within PeriodProvider');
    // بدلاً من throw error، نرجع قيم افتراضية
    return {
      selectedPeriod: 'all_time' as PeriodType,
      setSelectedPeriod: () => {},
      customStartDate: '',
      customEndDate: '',
      setCustomStartDate: () => {},
      setCustomEndDate: () => {},
      getDateRange: () => ({
        start: new Date(2020, 0, 1),
        end: new Date()
      }),
      getPeriodLabel: () => 'كل الفترات'
    };
  }
  return context;
};
