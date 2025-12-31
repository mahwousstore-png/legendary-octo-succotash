import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('========================================');
    console.error('❌ Error Boundary caught error:');
    console.error('Error:', error);
    console.error('Error Message:', error.message);
    console.error('Error Stack:', error.stack);
    console.error('Component Stack:', errorInfo.componentStack);
    console.error('========================================');
    this.setState({
      error,
      errorInfo
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4" dir="rtl">
          <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl p-8">
            {/* أيقونة التحذير */}
            <div className="flex justify-center mb-6">
              <div className="bg-red-100 rounded-full p-6">
                <AlertTriangle className="h-16 w-16 text-red-600" />
              </div>
            </div>

            {/* العنوان */}
            <h1 className="text-3xl font-bold text-gray-900 text-center mb-4">
              عذراً، حدث خطأ غير متوقع
            </h1>

            {/* الوصف */}
            <p className="text-gray-600 text-center mb-6">
              واجه التطبيق مشكلة تقنية. يرجى المحاولة مرة أخرى أو الاتصال بالدعم الفني.
            </p>

            {/* تفاصيل الخطأ (للمطورين) */}
            {this.state.error && (
              <div className="bg-gray-50 rounded-lg p-4 mb-6 text-right">
                <p className="text-sm font-mono text-red-600 mb-2">
                  {this.state.error.toString()}
                </p>
                {this.state.errorInfo && (
                  <details className="text-xs text-gray-500 mt-2">
                    <summary className="cursor-pointer font-semibold">
                      تفاصيل تقنية (للمطورين)
                    </summary>
                    <pre className="mt-2 overflow-auto max-h-40 text-left">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            {/* أزرار الإجراءات */}
            <div className="flex gap-4 justify-center">
              <button
                onClick={this.handleReload}
                className="flex items-center gap-2 bg-[#D4AF37] hover:bg-[#C4A137] 
                           text-black font-bold px-6 py-3 rounded-lg 
                           transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                <RefreshCw className="h-5 w-5" />
                إعادة المحاولة
              </button>
              
              <button
                onClick={this.handleGoHome}
                className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 
                           text-white font-bold px-6 py-3 rounded-lg 
                           transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                <Home className="h-5 w-5" />
                العودة للرئيسية
              </button>
            </div>

            {/* معلومات إضافية */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-500 text-center">
                إذا استمرت المشكلة، يرجى التواصل مع الدعم الفني
              </p>
              <p className="text-xs text-gray-400 text-center mt-2">
                رمز الخطأ: ERR_{Date.now()}
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
