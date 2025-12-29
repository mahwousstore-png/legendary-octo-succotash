import React from 'react';
import { Loader2, Zap, BarChart3, ShoppingCart } from 'lucide-react';

const LoadingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center relative overflow-hidden">
      {/* Background Animation */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-100/30 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-100/30 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-200/20 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>
      {/* Floating Icons */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-20 text-blue-200/20 animate-float">
          <BarChart3 className="w-8 h-8" />
        </div>
        <div className="absolute top-40 right-32 text-blue-200/20 animate-float-delayed">
          <ShoppingCart className="w-6 h-6" />
        </div>
        <div className="absolute bottom-32 left-40 text-blue-200/20 animate-float">
          <Zap className="w-10 h-10" />
        </div>
        <div className="absolute bottom-20 right-20 text-blue-200/20 animate-float-delayed">
          <BarChart3 className="w-7 h-7" />
        </div>
      </div>
      {/* Main Loading Content */}
      <div className="relative z-10 text-center">
        {/* Logo */}
        <div className="mb-8">
          <div className="relative">
            <img
              src="https://ik.imagekit.io/hkp0zcyja/%D9%85%D9%86%D9%88%D8%B9/%D8%B4%D8%B9%D8%A7%D8%B1-%D9%85%D9%87%D9%88%D9%88%D8%B3.webp"
              alt="مهووس | Mahwous"
              className="w-24 h-24 mx-auto rounded-2xl shadow-lg ring-2 ring-blue-100 backdrop-blur-sm"
            />
            <div className="absolute -inset-2 bg-gradient-to-r from-blue-200 to-blue-300 rounded-3xl blur opacity-50 animate-pulse"></div>
          </div>
        </div>
        {/* Brand Name */}
        <h1 className="text-4xl md:text-6xl font-bold text-gray-800 mb-4 tracking-tight">
          <span className="bg-gradient-to-r from-gray-800 via-blue-600 to-blue-800 bg-clip-text text-transparent">
            مهووس
          </span>
        </h1>
       
        <p className="text-xl text-gray-600 mb-8 font-light">
          نظام إدارة الطلبات الذكي
        </p>
        {/* Loading Spinner */}
        <div className="relative mb-8">
          <div className="flex items-center justify-center">
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 border-2 border-blue-200/50 rounded-full animate-ping"></div>
          </div>
        </div>
        {/* Loading Text */}
        <div className="space-y-2">
          <p className="text-gray-500 text-lg animate-pulse">
            جاري تحميل النظام...
          </p>
          <div className="flex items-center justify-center space-x-1 space-x-reverse">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-100"></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-200"></div>
          </div>
        </div>
        {/* Progress Bar */}
        <div className="mt-8 w-64 mx-auto">
          <div className="bg-gray-200/50 rounded-full h-2 overflow-hidden backdrop-blur-sm">
            <div className="bg-gradient-to-r from-blue-400 to-blue-600 h-full rounded-full animate-loading-bar"></div>
          </div>
        </div>
        {/* Footer */}
        <div className="mt-12 flex items-center justify-center space-x-2 space-x-reverse text-gray-500 text-sm">
          <img
            src="https://profilecdn.haraj.com.sa/12722282/avatar-md.webp"
            alt="Verinty"
            className="w-5 h-5 rounded-full opacity-70"
          />
          <span>طور بواسطة Verinty</span>
        </div>
      </div>
    </div>
  );
};

export default LoadingPage;