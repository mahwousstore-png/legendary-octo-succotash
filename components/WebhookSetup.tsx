import React, { useState } from 'react';
import { Copy, Check, AlertCircle, Zap, Settings, Code } from 'lucide-react';

const WebhookSetup: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const webhookUrl = 'https://your-domain.com/api/webhook/make-data';

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">إعداد Webhooks</h2>
        <p className="text-gray-600">قم بتوصيل حساب Make.com الخاص بك لاستقبال البيانات تلقائياً</p>
      </div>

      {/* Webhook URL Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
        <div className="flex items-center space-x-3 space-x-reverse mb-4">
          <div className="bg-blue-600 text-white p-2 rounded-lg">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-blue-900">رابط Webhook الخاص بك</h3>
            <p className="text-blue-700 text-sm">استخدم هذا الرابط في Make.com لإرسال البيانات</p>
          </div>
        </div>
        <div className="bg-white border border-blue-300 rounded-lg p-4 flex items-center justify-between">
          <code className="text-blue-800 text-sm font-mono flex-1 truncate">{webhookUrl}</code>
          <button
            onClick={copyToClipboard}
            className="mr-2 bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 transition-colors duration-200 flex items-center space-x-2 space-x-reverse"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            <span>{copied ? 'تم النسخ!' : 'نسخ'}</span>
          </button>
        </div>
      </div>

      {/* Setup Instructions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center space-x-3 space-x-reverse mb-4">
            <div className="bg-green-100 text-green-600 p-2 rounded-lg">
              <Settings className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">خطوات الإعداد</h3>
          </div>
          <div className="space-y-4">
            <div className="flex space-x-4 space-x-reverse">
              <div className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">1</div>
              <div>
                <h4 className="font-medium text-gray-900">سجل الدخول إلى Make.com</h4>
                <p className="text-gray-600 text-sm">ادخل إلى حسابك في Make.com وافتح السيناريو المطلوب</p>
              </div>
            </div>
            <div className="flex space-x-4 space-x-reverse">
              <div className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">2</div>
              <div>
                <h4 className="font-medium text-gray-900">أضف HTTP Module</h4>
                {/* تم استبدال > بـ &gt; لتجنب خطأ JSX */}
                <p className="text-gray-600 text-sm">اختر "HTTP" &gt; "Make a request" من قائمة الوحدات</p>
              </div>
            </div>
            <div className="flex space-x-4 space-x-reverse">
              <div className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">3</div>
              <div>
                <h4 className="font-medium text-gray-900">أضف رابط Webhook</h4>
                <p className="text-gray-600 text-sm">الصق الرابط أعلاه في حقل URL واختر POST كطريقة</p>
              </div>
            </div>
            <div className="flex space-x-4 space-x-reverse">
              <div className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">4</div>
              <div>
                <h4 className="font-medium text-gray-900">اختبر الاتصال</h4>
                <p className="text-gray-600 text-sm">شغّل السيناريو للتأكد من وصول البيانات بنجاح</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center space-x-3 space-x-reverse mb-4">
            <div className="bg-purple-100 text-purple-600 p-2 rounded-lg">
              <Code className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">مثال على البيانات</h3>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <pre className="text-sm text-gray-800 overflow-x-auto">
{`{
  "source": "Google Sheets",
  "type": "form_submission",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "name": "أحمد محمد",
    "email": "ahmed@example.com",
    "phone": "+966501234567",
    "status": "جديد"
  }
}`}
            </pre>
          </div>
          <div className="mt-4 text-sm text-gray-600">
            <p>سيتم حفظ جميع البيانات المستلمة تلقائياً في قاعدة البيانات وعرضها في لوحة التحكم</p>
          </div>
        </div>
      </div>

      {/* Status and Monitoring */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">حالة الاتصال والمراقبة</h3>
       
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="text-2xl font-bold text-green-600 mb-2">3</div>
            <div className="text-sm text-green-800">طلبات ناجحة</div>
          </div>
         
          <div className="text-center p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600 mb-2">0</div>
            <div className="text-sm text-yellow-800">طلبات فاشلة</div>
          </div>
         
          <div className="text-center p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-2xl font-bold text-blue-600 mb-2">100%</div>
            <div className="text-sm text-blue-800">معدل النجاح</div>
          </div>
        </div>

        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center space-x-2 space-x-reverse">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <span className="text-amber-800 font-medium">ملاحظة هامة:</span>
          </div>
          <p className="text-amber-700 text-sm mt-2">
            تأكد من إرسال البيانات بصيغة JSON وتضمين جميع الحقول المطلوبة لضمان عمل النظام بشكل صحيح.
          </p>
        </div>
      </div>
    </div>
  );
};

// تم حذف السطر المكرر
export default WebhookSetup;