import React, { useState, useEffect } from 'react';
import { Shield, Search, Calendar, User, Activity } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { authService } from '../lib/auth';
import { formatDateTime } from '../lib/dateFormatter';

interface SystemLog {
  id: string;
  user_name: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: Record<string, any>;
  created_at: string;
}

const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const currentUser = authService.getCurrentUser();
  const isAdmin = currentUser?.role === 'admin';

  useEffect(() => {
    if (isAdmin) {
      fetchLogs();
    }
  }, [isAdmin]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('system_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-6 text-center">
        <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900">غير مصرح</h2>
        <p className="text-gray-600 mt-2">هذه الصفحة متاحة للمديرين فقط</p>
      </div>
    );
  }

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.action.includes(searchTerm) ||
                         log.resource_type.includes(searchTerm);
    const matchesFilter = filterAction === 'all' || log.action === filterAction;
    return matchesSearch && matchesFilter;
  });

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      create: 'إنشاء',
      update: 'تحديث',
      delete: 'حذف',
      accept: 'قبول',
      reject: 'رفض',
      confirm: 'تأكيد'
    };
    return labels[action] || action;
  };

  const getActionColor = (action: string) => {
    const colors: Record<string, string> = {
      create: 'bg-green-100 text-green-800',
      update: 'bg-blue-100 text-blue-800',
      delete: 'bg-red-100 text-red-800',
      accept: 'bg-green-100 text-green-800',
      reject: 'bg-red-100 text-red-800',
      confirm: 'bg-blue-100 text-blue-800'
    };
    return colors[action] || 'bg-gray-100 text-gray-800';
  };

  const getResourceLabel = (type: string) => {
    const labels: Record<string, string> = {
      expense: 'مصروف',
      custody: 'عهدة',
      order: 'طلب',
      employee_balance_transaction: 'معاملة عهدة',
      asset: 'أصل'
    };
    return labels[type] || type;
  };

  return (
    <div className="p-6 min-h-screen bg-gray-50">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">سجل الأحداث والرقابة</h1>
        </div>
        <p className="text-gray-600">تتبع جميع العمليات والتحركات في النظام</p>
      </div>

      {/* البحث والفلاتر */}
      <div className="bg-white rounded-xl p-4 mb-6 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="بحث في السجلات..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">جميع الإجراءات</option>
            <option value="create">إنشاء</option>
            <option value="update">تحديث</option>
            <option value="delete">حذف</option>
            <option value="accept">قبول</option>
            <option value="reject">رفض</option>
          </select>

          <button
            onClick={fetchLogs}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            تحديث
          </button>
        </div>
      </div>

      {/* الجدول */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">التاريخ والوقت</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">المستخدم</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">الإجراء</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">نوع المورد</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">التفاصيل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    جاري التحميل...
                  </td>
                </tr>
              ) : paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    لا توجد سجلات
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDateTime(log.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <User className="h-4 w-4 text-gray-400 ml-2" />
                        <span className="text-sm font-medium text-gray-900">{log.user_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getActionColor(log.action)}`}>
                        {getActionLabel(log.action)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {getResourceLabel(log.resource_type)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {log.details && Object.keys(log.details).length > 0 ? (
                        <div className="max-w-xs">
                          {log.details.amount !== undefined && (
                            <span className="text-xs">المبلغ: {log.details.amount}</span>
                          )}
                          {Object.keys(log.details).length > 0 && (
                            <details className="cursor-pointer">
                              <summary className="text-xs text-blue-600">عرض التفاصيل</summary>
                              <pre className="text-xs mt-1 p-2 bg-gray-50 rounded overflow-auto max-h-20">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-700">
              عرض {((currentPage - 1) * itemsPerPage) + 1} إلى {Math.min(currentPage * itemsPerPage, filteredLogs.length)} من {filteredLogs.length}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                السابق
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                التالي
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLogs;
