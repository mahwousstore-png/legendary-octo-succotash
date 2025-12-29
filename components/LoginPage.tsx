import React, { useState, useEffect, useCallback } from 'react';
import { Mail, Lock, AlertCircle, Eye, EyeOff, Shield, FileText, BarChart3, LogIn } from 'lucide-react';
import { authService, LoginCredentials } from '../lib/auth';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [credentials, setCredentials] = useState<LoginCredentials>({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const DEFAULT_LOGO_URL = 'https://ik.imagekit.io/hkp0zcyja/%D9%85%D9%86%D9%88%D8%B9/%D8%B4%D8%B9%D8%A7%D8%B1-%D9%85%D9%87%D9%88%D9%88%D8%B3.webp';

  // تحميل الشعار
  const fetchLogo = useCallback(async () => {
    setLogoUrl(DEFAULT_LOGO_URL);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchLogo(), 300);
    return () => clearTimeout(timer);
  }, [fetchLogo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credentials.email || !credentials.password) return;

    setLoading(true);
    setError(null);

    try {
      const result = await authService.login(credentials);
      if (result.success) {
        onLoginSuccess();
      } else {
        setError(result.error || 'البريد الإلكتروني أو كلمة المرور غير صحيحة');
      }
    } catch {
      setError('حدث خطأ، حاول مرة أخرى');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof LoginCredentials, value: string) => {
    setCredentials(prev => ({ ...prev, [field]: value }));
    if (error) setError(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-3 sm:p-4 bg-gradient-to-b from-royal-900 via-royal-800 to-royal-900 font-['Cairo']" dir="rtl">
      {/* خلفية متحركة */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-royal-900 via-royal-800 to-black animate-gradient"></div>
        {/* Gold accent decorations */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-gold-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-gold-500/10 rounded-full blur-3xl"></div>
      </div>

      {/* البطاقة الرئيسية */}
      <div className="relative w-full max-w-4xl mx-auto bg-white backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden border border-beige-200">
        <div className="grid grid-cols-1 md:grid-cols-2 min-h-[580px] md:h-[600px]">

          {/* === الجانب الأيسر: الترحيب === */}
          <div className="hidden md:flex flex-col justify-center p-8 lg:p-12 bg-royal-900">
            <div className="flex items-center gap-4 mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gold-500 rounded-xl shadow-gold">
                {logoUrl ? (
                  <img src={logoUrl} alt="مهووس" className="w-14 h-14 object-contain rounded-lg" />
                ) : (
                  <Shield className="w-8 h-8 text-royal-900" />
                )}
              </div>
              <div>
                <h1 className="text-4xl lg:text-5xl font-bold text-gold-500">مهووس</h1>
                <p className="text-lg text-royal-200">نظام إدارة الطلبات الذكي</p>
              </div>
            </div>
            <p className="text-royal-300 text-base leading-relaxed mb-6">
              نظام متكامل متصل بمنصة سلة، يمنحك تحكمًا فوريًا في الطلبات، التقارير، والمخزون.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 bg-royal-800 border border-gold-500/20 rounded-xl">
                <FileText className="w-5 h-5 text-gold-500" />
                <div>
                  <p className="font-semibold text-sm text-white">طلبات فورية</p>
                  <p className="text-xs text-royal-300">متصل بسلة</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-royal-800 border border-gold-500/20 rounded-xl">
                <BarChart3 className="w-5 h-5 text-gold-500" />
                <div>
                  <p className="font-semibold text-sm text-white">تقارير ذكية</p>
                  <p className="text-xs text-royal-300">تحليل لحظي</p>
                </div>
              </div>
              <div className="col-span-2 flex items-center gap-3 p-3 bg-royal-800 border border-gold-500/20 rounded-xl">
                <Shield className="w-5 h-5 text-gold-500" />
                <div>
                  <p className="font-semibold text-sm text-white">أمان متقدم</p>
                  <p className="text-xs text-royal-300">تشفير كامل للبيانات</p>
                </div>
              </div>
            </div>
          </div>

          {/* === الجانب الأيمن: نموذج تسجيل الدخول === */}
          <div className="flex flex-col justify-center p-5 sm:p-6 md:p-8 lg:p-12 bg-white">
            {/* شعار على الموبايل */}
            <div className="flex md:hidden items-center justify-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gold-500 rounded-xl shadow-gold flex items-center justify-center">
                {logoUrl ? (
                  <img src={logoUrl} alt="مهووس" className="w-9 h-9 object-contain rounded-lg" />
                ) : (
                  <Shield className="w-6 h-6 text-royal-900" />
                )}
              </div>
              <div className="text-right">
                <h1 className="text-xl font-bold text-royal-900">مهووس</h1>
                <p className="text-xs text-royal-400">تسجيل الدخول</p>
              </div>
            </div>

            <div className="max-w-sm mx-auto w-full">
              <div className="text-center mb-6">
                <h2 className="text-2xl sm:text-3xl font-bold text-royal-900 mb-1">مرحبًا بك</h2>
                <p className="text-sm text-royal-400">أدخل بياناتك للوصول إلى لوحة التحكم</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm flex items-center gap-2 text-right">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* البريد الإلكتروني */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-royal-800">البريد الإلكتروني</label>
                  <div className="relative">
                    <input
                      type="email"
                      value={credentials.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      className="w-full p-3 pr-11 pl-11 border border-beige-200 rounded-xl focus:ring-2 focus:ring-gold-200 focus:border-gold-500 bg-white transition-all duration-300 shadow-sm hover:shadow-md text-base"
                      placeholder="name@mahwous.com"
                      required
                      disabled={loading}
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-page-100 rounded-lg">
                      <Mail className="w-5 h-5 text-royal-400" />
                    </div>
                  </div>
                </div>

                {/* كلمة المرور */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-royal-800">كلمة المرور</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={credentials.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      className="w-full p-3 pr-11 pl-11 border border-beige-200 rounded-xl focus:ring-2 focus:ring-gold-200 focus:border-gold-500 bg-white transition-all duration-300 shadow-sm hover:shadow-md text-base"
                      placeholder="••••••••"
                      required
                      disabled={loading}
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-page-100 rounded-lg">
                      <Lock className="w-5 h-5 text-royal-400" />
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 p-2 hover:bg-page-100 rounded-lg transition-colors"
                      disabled={loading}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5 text-royal-400" /> : <Eye className="w-5 h-5 text-royal-400" />}
                    </button>
                  </div>
                </div>

                {/* زر تسجيل الدخول */}
                <button
                  type="submit"
                  disabled={loading || !credentials.email || !credentials.password}
                  className={`w-full flex items-center justify-center gap-3 p-3.5 rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl text-base
                    ${loading || !credentials.email || !credentials.password
                      ? 'bg-beige-200 text-royal-400 cursor-not-allowed'
                      : 'bg-gold-500 text-royal-900 hover:bg-gold-400 shadow-gold'
                    }`}
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-royal-900/30 border-t-royal-900 rounded-full animate-spin" />
                      <span>جاري تسجيل الدخول...</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-5 h-5" />
                      <span>تسجيل الدخول</span>
                    </>
                  )}
                </button>

                <p className="text-center text-xs text-royal-400 mt-4">
                  نظام آمن ومحمي بأحدث تقنيات الأمان
                </p>
              </form>
            </div>
          </div>
        </div>

        {/* التذييل */}
        <div className="absolute bottom-3 left-3 right-3 text-center sm:bottom-4 sm:right-4 sm:text-right text-xs text-royal-400">
          <p>
            © {new Date().getFullYear()} مهووس - جميع الحقوق محفوظة.
            طور بواسطة <a href="https://verinty.com" target="_blank" rel="noopener noreferrer" className="underline text-gold-600 hover:text-gold-500 font-medium">فيرانتي</a>
          </p>
        </div>
      </div>

      {/* أنيميشن الخلفية */}
      <style jsx>{`
        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 15s ease infinite;
        }
      `}</style>
    </div>
  );
};

export default LoginPage;