import React, { useState } from 'react';
import { Copy, Check, AlertCircle, Zap, Settings, Code, ShoppingCart } from 'lucide-react';

const OrdersWebhookSetup: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const webhookUrl = 'https://your-supabase-project.supabase.co/functions/v1/orders-webhook';

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
        <h2 className="text-2xl font-bold text-gray-900 mb-2">إعداد Webhook للطلبات</h2>
        <p className="text-gray-600">قم بتوصيل نظام الطلبات مع Make.com لاستقبال الطلبات تلقائياً</p>
      </div>

      {/* Webhook URL Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
        <div className="flex items-center space-x-3 space-x-reverse mb-4">
          <div className="bg-blue-600 text-white p-2 rounded-lg">
            <ShoppingCart className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-blue-900">رابط Webhook للطلبات</h3>
            <p className="text-blue-700 text-sm">استخدم هذا الرابط في Make.com لإرسال بيانات الطلبات</p>
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
                <h4 className="font-medium text-gray-900">إعداد السيناريو في Make.com</h4>
                <p className="text-gray-600 text-sm">أنشئ سيناريو جديد أو استخدم سيناريو موجود لمعالجة الطلبات</p>
              </div>
            </div>
            <div className="flex space-x-4 space-x-reverse">
              <div className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">2</div>
              <div>
                <h4 className="font-medium text-gray-900">أضف HTTP Module</h4>
                <p className="text-gray-600 text-sm">اختر "HTTP" &gt; "Make a request" من قائمة الوحدات</p>
              </div>
            </div>
            <div className="flex space-x-4 space-x-reverse">
              <div className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">3</div>
              <div>
                <h4 className="font-medium text-gray-900">تكوين الطلب</h4>
                <p className="text-gray-600 text-sm">الصق الرابط أعلاه، اختر POST، وأضف Content-Type: application/json</p>
              </div>
            </div>
            <div className="flex space-x-4 space-x-reverse">
              <div className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">4</div>
              <div>
                <h4 className="font-medium text-gray-900">اختبر الاتصال</h4>
                <p className="text-gray-600 text-sm">أرسل طلب تجريبي للتأكد من وصول البيانات بنجاح</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center space-x-3 space-x-reverse mb-4">
            <div className="bg-purple-100 text-purple-600 p-2 rounded-lg">
              <Code className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">مثال على بيانات الطلب</h3>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <pre className="text-sm text-gray-800 overflow-x-auto">
{`{
  "customer_name": "أحمد محمد علي",
  "phone_number": "+966501234567",
  "order_number": "ORD-2024-001",
  "products": [
    {
      "name": "جهاز لابتوب",
      "quantity": 1,
      "price": 2500
    },
    {
      "name": "ماوس لاسلكي",
      "quantity": 2,
      "price": 50
    }
  ],
  "total_price": 2600,
  "order_date": "2024-01-15T10:30:00Z",
  "status": "جديد"
}`}
            </pre>
          </div>
        </div>
      </div>

      {/* Required Fields */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">الحقول المطلوبة</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-900 mb-2">حقول أساسية</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-center space-x-2 space-x-reverse">
                <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                <span><code>customer_name</code> - اسم العميل (نص)</span>
              </li>
              <li className="flex items-center space-x-2 space-x-reverse">
                <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                <span><code>phone_number</code> - رقم الجوال (نص)</span>
              </li>
              <li className="flex items-center space-x-2 space-x-reverse">
                <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                <span><code>order_number</code> - رقم الطلب (نص فريد)</span>
              </li>
              <li className="flex items-center space-x-2 space-x-reverse">
                <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                <span><code>total_price</code> - المبلغ الإجمالي (رقم)</span>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-2">حقول اختيارية</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-center space-x-2 space-x-reverse">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span><code>order_date</code> - تاريخ الطلب (ISO 8601)</span>
              </li>
              <li className="flex items-center space-x-2 space-x-reverse">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span><code>status</code> - حالة الطلب (افتراضي: "جديد")</span>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="mt-4">
          <h4 className="font-medium text-gray-900 mb-2">مصفوفة المنتجات</h4>
          <p className="text-sm text-gray-600 mb-2">
            يجب أن تحتوي <code>products</code> على مصفوفة من المنتجات، كل منتج يحتوي على:
          </p>
          <ul className="space-y-1 text-sm text-gray-600 mr-4">
            <li>• <code>name</code> - اسم المنتج (نص)</li>
            <li>• <code>quantity</code> - الكمية (رقم)</li>
            <li>• <code>price</code> - سعر الوحدة (رقم)</li>
          </ul>
        </div>
      </div>

      {/* Status and Monitoring */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">حالة الاتصال والمراقبة</h3>
       
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="text-center p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="text-2xl font-bold text-green-600 mb-2">5</div>
            <div className="text-sm text-green-800">طلبات مستلمة</div>
          </div>
         
          <div className="text-center p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-2xl font-bold text-blue-600 mb-2">3</div>
            <div className="text-sm text-blue-800">طلبات معلقة</div>
          </div>
          
          <div className="text-center p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <div className="text-2xl font-bold text-purple-600 mb-2">2</div>
            <div className="text-sm text-purple-800">طلبات مكتملة</div>
          </div>
         
          <div className="text-center p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600 mb-2">0</div>
            <div className="text-sm text-yellow-800">أخطاء</div>
          </div>
        </div>

        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center space-x-2 space-x-reverse">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <span className="text-amber-800 font-medium">ملاحظات هامة:</span>
          </div>
          <ul className="text-amber-700 text-sm mt-2 space-y-1 mr-6">
            <li>• تأكد من إرسال البيانات بصيغة JSON صحيحة</li>
            <li>• رقم الطلب يجب أن يكون فريداً لكل طلب</li>
            <li>• تأكد من صحة أرقام الجوال (يفضل بالصيغة الدولية)</li>
            <li>• المبالغ يجب أن تكون أرقام صحيحة أو عشرية</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default OrdersWebhookSetup;