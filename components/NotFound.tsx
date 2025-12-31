import React from 'react';
import { Home, ArrowRight } from 'lucide-react';

interface NotFoundProps {
  onNavigateHome?: () => void;
  onNavigateBack?: () => void;
}

const NotFound = ({ onNavigateHome, onNavigateBack }: NotFoundProps) => {
  const handleGoHome = () => {
    if (onNavigateHome) {
      onNavigateHome();
    } else {
      window.location.href = '/';
    }
  };

  const handleGoBack = () => {
    if (onNavigateBack) {
      onNavigateBack();
    } else {
      window.history.back();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4" dir="rtl">
      <div className="text-center max-w-lg">
        <h1 className="text-9xl font-bold text-[#D4AF37] mb-4">404</h1>
        <h2 className="text-3xl font-bold text-gray-800 mb-4">
          الصفحة غير موجودة
        </h2>
        <p className="text-gray-600 mb-8">
          عذراً، الصفحة التي تبحث عنها غير متوفرة أو تم نقلها
        </p>
        
        <div className="flex gap-4 justify-center">
          <button
            onClick={handleGoHome}
            className="flex items-center gap-2 bg-[#D4AF37] hover:bg-[#C4A137] 
                       text-black font-bold px-6 py-3 rounded-lg 
                       transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            <Home className="h-5 w-5" />
            العودة للرئيسية
          </button>
          
          <button
            onClick={handleGoBack}
            className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 
                       text-white font-bold px-6 py-3 rounded-lg 
                       transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            <ArrowRight className="h-5 w-5" />
            رجوع
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
