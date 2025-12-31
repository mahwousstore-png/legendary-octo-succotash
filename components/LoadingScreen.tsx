import React from 'react';
import { Loader2 } from 'lucide-react';

const LoadingScreen: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#D4AF37]/10 to-gray-50 flex items-center justify-center" dir="rtl">
      <div className="text-center">
        {/* شعار متحرك */}
        <div className="mb-8 relative">
          <div className="animate-spin rounded-full h-24 w-24 border-8 border-gray-200 border-t-[#D4AF37] mx-auto"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-12 w-12 text-[#D4AF37] animate-pulse" />
          </div>
        </div>

        {/* النص */}
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          جاري التحميل...
        </h2>
        <p className="text-gray-600">
          يرجى الانتظار بينما نقوم بتحضير كل شيء
        </p>

        {/* نقاط متحركة */}
        <div className="flex justify-center gap-2 mt-6">
          <div className="w-3 h-3 bg-[#D4AF37] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-3 h-3 bg-[#D4AF37] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-3 h-3 bg-[#D4AF37] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;
