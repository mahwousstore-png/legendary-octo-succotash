// src/App.tsx
import React, { useState, useEffect } from 'react';
import {
  Home,
  ShoppingCart,
  Lock,
  FileText,
  DollarSign,
  Users,
  Menu,
  User,
  LogOut,
  Users2,
  CreditCard,
  Wallet,
  Loader2,
  Package,
  X,
  Truck,
} from 'lucide-react';

import Dashboard from './components/Dashboard';
import UnlockedOrders from './components/UnlockedOrders';
import LockedOrders from './components/LockedOrders';
import Expenses from './components/Expenses';
import Inventory from './components/Inventory';
import CancelledOrders from './components/CancelledOrders';
import ShippingCompanies from './components/ShippingCompanies';
import Reports from './components/Reports';
import CustomReports from './components/CustomReports';
import Suppliers from './components/Suppliers';
import PaymentMethodsDashboard from './components/PaymentMethodsDashboard';
import EmployeeBalances from './components/EmployeeBalances';
import UserManagement from './components/UserManagement';
import LoginPage from './components/LoginPage';

import { useOrders } from './hooks/useOrders';
import { authService } from './lib/auth';

interface MenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  category: string;
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 768);
  const { orders, stats } = useOrders();

  // === قائمة العناصر في السايدبار ===
  const menuItems: MenuItem[] = [
    { id: 'dashboard', label: 'لوحة التحكم', icon: Home, category: 'main' },
    { id: 'unlocked-orders', label: 'الطلبات الجديدة', icon: ShoppingCart, category: 'orders' },
    { id: 'locked-orders', label: 'الطلبات المقفلة', icon: Lock, category: 'orders' },
    { id: 'cancelled-orders', label: 'الطلبات الملغية', icon: X, category: 'orders' },
    { id: 'shipping-companies', label: 'شركات الشحن', icon: Truck, category: 'financial' },
    { id: 'payment-methods', label: 'طرق الدفع', icon: CreditCard, category: 'financial' },
    { id: 'employee-balances', label: 'أرصدة الموظفين', icon: Wallet, category: 'financial' },
    { id: 'suppliers', label: 'إدارة الموردين', icon: Users2, category: 'financial' },
    { id: 'expenses', label: 'المصروفات', icon: DollarSign, category: 'financial' },
    { id: 'inventory', label: 'المخزون', icon: Package, category: 'financial' },
    { id: 'reports', label: 'التقارير', icon: FileText, category: 'main' },
    { id: 'custom-reports', label: 'التقارير المخصصة', icon: FileText, category: 'main' },
    { id: 'users', label: 'إدارة المستخدمين', icon: Users, category: 'admin' },
  ];

  // تحويل id إلى مفتاح الصلاحية في الـ permissions
  const getPermissionKey = (id: string): string | null => {
    const map: Record<string, string> = {
      'dashboard': 'dashboard',
      'unlocked-orders': 'unlocked-orders',
      'locked-orders': 'locked-orders',
      'shipping-companies': 'shipping-companies',
      'payment-methods': 'payment-methods',
      'employee-balances': 'employee-balances',
      'suppliers': 'suppliers',
      'expenses': 'expenses',
      'inventory': 'inventory',
      'cancelled-orders': 'cancelled-orders',
      'reports': 'reports',
      'custom-reports': 'reports',
      'users': 'users',
    };
    return map[id] || null;
  };

  // التحقق من صلاحية التبويب
  const hasPermissionForTab = (tabId: string, user = currentUser): boolean => {
    if (!user?.permissions) return false;
    const permKey = getPermissionKey(tabId);
    if (!permKey) return false;
    return user.permissions[permKey] === true;
  };

  // تصفية القوائم حسب الصلاحيات
  const filteredMenuItems = menuItems.filter(item => {
    const permKey = getPermissionKey(item.id);
    if (!permKey || !currentUser?.permissions) return false;
    return currentUser.permissions[permKey] === true;
  });

  // تسميات الفئات
  const categories: Record<string, string> = {
    main: 'الرئيسية',
    orders: 'الطلبات',
    financial: 'المالية',
    admin: 'الإدارة',
  };

  // === تهيئة التطبيق عند التحميل ===
  useEffect(() => {
    const initApp = async () => {
      setIsLoading(true);
      try {
        const user = authService.getCurrentUser();

        if (user) {
          setIsAuthenticated(true);
          setCurrentUser(user);

          // جلب آخر تبويب محفوظ (إن وجد) وإلا نستخدم dashboard
          const savedTab = localStorage.getItem('lastActiveTab') || 'dashboard';
          if (hasPermissionForTab(savedTab, user)) {
            setActiveTab(savedTab);
          } else {
            setActiveTab('dashboard');
          }
        } else {
          setIsAuthenticated(false);
          setCurrentUser(null);
        }
      } catch (err) {
        console.error('فشلت عملية تهيئة التطبيق:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initApp();
  }, []);

  // حفظ آخر تبويب مسموح عند تغييره
  useEffect(() => {
    if (currentUser && hasPermissionForTab(activeTab)) {
      localStorage.setItem('lastActiveTab', activeTab);
    }
  }, [activeTab, currentUser]);

  const handleLoginSuccess = () => {
    const user = authService.getCurrentUser();
    setIsAuthenticated(true);
    setCurrentUser(user);
    setIsLoading(false);

    // بعد تسجيل الدخول نرجع للداشبورد أو آخر تبويب مسموح
    if (hasPermissionForTab(activeTab, user)) {
      // يبقى كما هو
    } else {
      setActiveTab('dashboard');
    }
  };

  const handleLogout = async () => {
    await authService.logout();
    setIsAuthenticated(false);
    setCurrentUser(null);
    setActiveTab('dashboard');
    localStorage.removeItem('lastActiveTab');
  };

  // === شاشة التحميل ===
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-lg font-medium text-blue-800">جاري تحميل النظام...</p>
          <p className="text-sm text-blue-600 mt-2">التحقق من الصلاحيات</p>
        </div>
      </div>
    );
  }

  // === شاشة تسجيل الدخول ===
  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  // === الواجهة الرئيسية بعد التحقق من الصلاحيات ===
  return (
    <div className="min-h-screen bg-white font-sans relative" dir="rtl">
      {/* الهيدر */}
      <header className="bg-white border-b border-blue-100 fixed top-0 left-0 right-0 z-40 shadow-sm">
        <div className="max-w-full mx-auto px-2 sm:px-4 lg:px-8">
          <div className="flex justify-between items-center h-14 md:h-16">
            <div className="flex items-center space-x-2 md:space-x-4 space-x-reverse">
              <button
                onClick={() => setIsSidebarOpen(prev => !prev)}
                className="p-1.5 md:p-2 rounded-lg hover:bg-blue-50 text-blue-600 hover:text-blue-700 transition-colors duration-200"
              >
                <Menu className="h-5 w-5 md:h-6 md:w-6" />
              </button>
              <img
                src="https://ik.imagekit.io/hkp0zcyja/%D9%85%D9%86%D9%88%D8%B9/%D8%B4%D8%B9%D8%A7%D8%B1-%D9%85%D9%87%D9%88%D9%88%D8%B3.webp"
                alt="مهووس | Mahwous"
                className="h-8 w-8 md:h-12 md:w-12 rounded-lg shadow-md ring-1 ring-blue-100"
              />
              <div className="hidden sm:block">
                <h1 className="text-base md:text-xl font-bold text-blue-800">مهووس | Mahwous</h1>
                <div className="hidden md:flex items-center space-x-2 space-x-reverse text-xs md:text-sm text-blue-600 mt-1">
                  <img
                    src="https://cdn.salla.network/images/logo/logo-wide.svg"
                    alt="منصة سلة"
                    className="h-3 md:h-4 w-auto opacity-80"
                  />
                  <span>نظام إدارة الطلبات متصل بمنصة سلة</span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2 md:space-x-4 space-x-reverse">
              <div className="flex items-center space-x-2 md:space-x-3 space-x-reverse">
                <div className="text-right hidden md:block">
                  <p className="text-xs md:text-sm font-medium text-gray-900">{currentUser?.full_name}</p>
                  <p className="text-xs text-gray-500">
                    {currentUser?.role === 'admin' ? 'مدير' : 'مستخدم'}
                  </p>
                </div>
                <div className="bg-blue-100 text-blue-600 p-1.5 md:p-2 rounded-full">
                  <User className="h-4 w-4 md:h-5 md:w-5" />
                </div>
                <button
                  onClick={handleLogout}
                  className="p-1.5 md:p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                  title="تسجيل الخروج"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="hidden xl:flex items-center space-x-2 space-x-reverse text-xs text-gray-500">
              <img
                src="https://profilecdn.haraj.com.sa/12722282/avatar-md.webp"
                alt="شعار Verinty"
                className="h-6 w-6 rounded-full object-cover opacity-60"
              />
              <span>طور بواسطة Verinty</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex pt-14 md:pt-16">
        {/* Overlay للموبايل */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          ></div>
        )}

        {/* السايدبار - يظهر فقط بعد التحقق من الصلاحيات */}
        <div
          className={`w-56 md:w-64 bg-white border-l border-blue-100 fixed right-0 top-14 md:top-16 bottom-0 overflow-y-auto transform transition-transform duration-300 ease-in-out ${
            isSidebarOpen ? 'translate-x-0' : 'translate-x-full'
          } shadow-md z-30`}
        >
          <nav className="p-3 md:p-6">
            <div className="space-y-4 md:space-y-6">
              {Object.entries(categories).map(([key, label]) => {
                const itemsInCategory = filteredMenuItems.filter(item => item.category === key);
                if (itemsInCategory.length === 0) return null;

                return (
                  <div key={key}>
                    <h3 className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-2 md:mb-4 border-b border-blue-100 pb-1 md:pb-2">
                      {label}
                    </h3>
                    {itemsInCategory.map(item => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.id;

                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            setActiveTab(item.id);
                            if (window.innerWidth < 768) {
                              setIsSidebarOpen(false);
                            }
                          }}
                          className={`
                            w-full flex items-center space-x-2 md:space-x-3 space-x-reverse px-2 md:px-4 py-2 md:py-3 rounded-lg text-xs md:text-sm font-medium
                            transition-all duration-200 hover:bg-blue-50
                            ${isActive ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-300' : 'text-gray-700 hover:text-blue-600'}
                          `}
                        >
                          <Icon className={`h-4 w-4 md:h-5 md:w-5 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </nav>
        </div>

        {/* المحتوى الرئيسي */}
        <div className={`flex-1 ${isSidebarOpen ? 'mr-56 md:mr-64' : 'mr-0'} transition-all duration-300`}>
          <div className="p-2 md:p-6">
            <div className="bg-white rounded-lg md:rounded-xl shadow-md min-h-[calc(100vh-6rem)] md:min-h-[calc(100vh-8rem)] border border-blue-50">
              {/* رسالة عدم وجود صلاحية */}
              {!hasPermissionForTab(activeTab) ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Lock className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">غير مصرح لك</h3>
                    <p className="text-gray-600">ليس لديك صلاحية للوصول إلى هذه الصفحة</p>
                  </div>
                </div>
              ) : (
                // عرض المحتوى حسب التبويب
                <>
                  {activeTab === 'dashboard' && <Dashboard />}
                  {activeTab === 'unlocked-orders' && <UnlockedOrders />}
                  {activeTab === 'locked-orders' && <LockedOrders />}
                  {activeTab === 'shipping-companies' && <ShippingCompanies />}
                  {activeTab === 'payment-methods' && <PaymentMethodsDashboard />}
                  {activeTab === 'employee-balances' && <EmployeeBalances />}
                  {activeTab === 'suppliers' && <Suppliers />}
                  {activeTab === 'expenses' && <Expenses />}
                  {activeTab === 'inventory' && <Inventory />}
                  {activeTab === 'cancelled-orders' && <CancelledOrders />}
                  {activeTab === 'reports' && <Reports />}
                  {activeTab === 'custom-reports' && <CustomReports />}
                  {activeTab === 'users' && <UserManagement />}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;