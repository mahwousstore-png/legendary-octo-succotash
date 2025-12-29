import React, { useState, useEffect } from 'react';
import { Users, Plus, Edit, Trash2, Activity, X, Save, Shield, UserCheck, UserX, Search } from 'lucide-react';
import { authService, User, CreateUserData } from '../lib/auth';

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [currentUser] = useState(authService.getCurrentUser());

  const [newUser, setNewUser] = useState<CreateUserData>({
    email: '',
    password: '',
    full_name: '',
    role: 'user',
    permissions: {
      dashboard: true,
      'unlocked-orders': false,
      'locked-orders': false,
      'payment-methods': false,
      'employee-balances': false,
      suppliers: false,
      expenses: false,
      reports: false,
      users: false,
    }
  });

  // تسميات الصلاحيات بالعربية (للعرض في الواجهة)
  const permissionLabels: Record<string, string> = {
    dashboard: 'لوحة التحكم',
    'unlocked-orders': 'الطلبات المفتوحة',
    'locked-orders': 'الطلبات المقفلة',
    'shipping-companies': 'شركات الشحن',
    'payment-methods': 'طرق الدفع والمستحقات',
    'employee-balances': 'أرصدة الموظفين',
    suppliers: 'إدارة الموردين',
    expenses: 'المصروفات',
    inventory: 'المخزون',
    'cancelled-orders': 'الطلبات الملغية',
    reports: 'التقارير',
    users: 'إدارة المستخدمين',
  };

  useEffect(() => {
    fetchUsers();
    fetchActivityLogs();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const usersData = await authService.getUsers();
      setUsers(usersData);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchActivityLogs = async () => {
    try {
      const logs = await authService.getUserActivityLogs();
      setActivityLogs(logs);
    } catch (error) {
      console.error('Error fetching activity logs:', error);
    }
  };

  const resetNewUser = () => {
    setNewUser({
      email: '',
      password: '',
      full_name: '',
      role: 'user',
      permissions: {
        dashboard: true,
        'unlocked-orders': false,
        'locked-orders': false,
        'payment-methods': false,
        'employee-balances': false,
        suppliers: false,
        expenses: false,
        reports: false,
        users: false,
      }
    });
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleCreateUser = async () => {
    if (!currentUser) return;
    try {
      const result = await authService.createUser(newUser, currentUser.id);
      if (result.success) {
        setShowAddModal(false);
        resetNewUser();
        fetchUsers();
        fetchActivityLogs();
        alert('تم إنشاء المستخدم بنجاح');
      } else {
        alert(result.error || 'حدث خطأ أثناء إنشاء المستخدم');
      }
    } catch (error) {
      alert('حدث خطأ غير متوقع');
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser || !currentUser) return;
    try {
      const result = await authService.updateUser(selectedUser.id, newUser, currentUser.id);
      if (result.success) {
        setShowEditModal(false);
        setSelectedUser(null);
        resetNewUser();
        fetchUsers();
        fetchActivityLogs();
        alert('تم تحديث المستخدم بنجاح');
      } else {
        alert(result.error || 'حدث خطأ أثناء تحديث المستخدم');
      }
    } catch (error) {
      alert('حدث خطأ غير متوقع');
    }
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setNewUser({
      email: user.email,
      password: '',
      full_name: user.full_name,
      role: user.role,
      permissions: { ...user.permissions }
    });
    setShowEditModal(true);
  };

  const openActivityModal = async (user: User) => {
    setSelectedUser(user);
    const userLogs = await authService.getUserActivityLogs(user.id);
    setActivityLogs(userLogs);
    setShowActivityModal(true);
  };

  const handleDeactivateUser = async (user: User) => {
    if (!currentUser || user.id === currentUser.id) {
      alert('لا يمكنك إلغاء تفعيل حسابك الخاص');
      return;
    }
    if (confirm(`هل أنت متأكد من إلغاء تفعيل "${user.full_name}"؟`)) {
      const result = await authService.deactivateUser(user.id, currentUser.id);
      if (result.success) {
        fetchUsers();
        fetchActivityLogs();
        alert('تم إلغاء التفعيل بنجاح');
      }
    }
  };

  const formatDate = (date: string) => new Date(date).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  // دالة لتحويل نوع الإجراء إلى نص عربي واضح
  const getActionLabel = (action: string): string => {
    const labels: Record<string, string> = {
      login: 'تسجيل الدخول',
      logout: 'تسجيل الخروج',
      create_user: 'إنشاء مستخدم جديد',
      update_user: 'تعديل بيانات مستخدم',
      deactivate_user: 'إلغاء تفعيل مستخدم',
      activate_user: 'إعادة تفعيل مستخدم',
      change_password: 'تغيير كلمة المرور',
      update_permissions: 'تعديل الصلاحيات',
      view_report: 'عرض تقرير',
      export_data: 'تصدير بيانات',
      delete_record: 'حذف سجل',
      create_order: 'إنشاء طلب',
      update_order: 'تعديل طلب',
      // أضف أي إجراءات أخرى تستخدمها في authService
    };

    return labels[action] || action.replace(/_/g, ' ');
  };

  if (loading) return <div className="p-8 text-center">جاري التحميل...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">إدارة المستخدمين</h2>
          <p className="text-gray-600 mt-1">إدارة صلاحيات الوصول والمستخدمين</p>
        </div>
        <button
          onClick={() => { resetNewUser(); setShowAddModal(true); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl flex items-center gap-2"
        >
          <Plus className="h-5 w-5" /> إضافة مستخدم
        </button>
      </div>

      {/* البحث والفلتر */}
      <div className="bg-gray-50 rounded-xl p-4 mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute right-3 top-3 text-gray-400 h-5 w-5" />
          <input
            type="text"
            placeholder="البحث بالاسم أو الإيميل..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pr-10 pl-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          className="px-4 py-3 border rounded-lg"
        >
          <option value="all">جميع الأدوار</option>
          <option value="admin">مدير</option>
          <option value="user">مستخدم</option>
        </select>
      </div>

      {/* جدول المستخدمين */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">المستخدم</th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">الدور</th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">الصلاحيات</th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">آخر دخول</th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">الحالة</th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredUsers.map(user => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center ml-3">
                      <Users className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-medium">{user.full_name}</div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                    {user.role === 'admin' ? 'مدير' : 'مستخدم'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-2 justify-end">
                    {Object.keys(user.permissions).filter(k => user.permissions[k as keyof typeof user.permissions]).map(key => (
                      <span key={key} className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                        {permissionLabels[key] || key}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {user.last_login ? formatDate(user.last_login) : 'لم يسجل بعد'}
                </td>
                <td className="px-6 py-4 text-center">
                  {user.is_active ?
                    <span className="text-green-600 flex items-center gap-1"><UserCheck className="h-4 w-4" />نشط</span> :
                    <span className="text-red-600 flex items-center gap-1"><UserX className="h-4 w-4" />معطل</span>
                  }
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3 justify-end">
                    <button onClick={() => openActivityModal(user)} title="سجل النشاط" className="text-gray-600 hover:text-green-600">
                      <Activity className="h-5 w-5" />
                    </button>
                    <button onClick={() => openEditModal(user)} title="تعديل" className="text-blue-600 hover:text-blue-800">
                      <Edit className="h-5 w-5" />
                    </button>
                    {user.id !== currentUser?.id && (
                      <button onClick={() => handleDeactivateUser(user)} title="إلغاء التفعيل" className="text-red-600 hover:text-red-800">
                        <Trash2 className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>


      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">إضافة مستخدم جديد</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الاسم الكامل</label>
                  <input
                    type="text"
                    value={newUser.full_name}
                    onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="أدخل الاسم الكامل"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">البريد الإلكتروني</label>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="user@example.com"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">كلمة المرور</label>
                  <input
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الدور</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value as 'admin' | 'user' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="user">مستخدم</option>
                    <option value="admin">مدير</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">الصلاحيات</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {Object.entries(permissionLabels).map(([key, label]) => (
                    <label key={key} className="flex items-center space-x-2 space-x-reverse">
                      <input
                        type="checkbox"
                        checked={newUser.permissions[key as keyof typeof newUser.permissions] ?? false}
                        onChange={(e) => setNewUser({
                          ...newUser,
                          permissions: {
                            ...newUser.permissions,
                            [key]: e.target.checked
                          }
                        })}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-700">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-6 border-t border-gray-200 mt-6">
              <button
                onClick={handleCreateUser}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center justify-center space-x-2 space-x-reverse"
              >
                <Save className="h-4 w-4" />
                <span>إنشاء المستخدم</span>
              </button>
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors duration-200"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">تعديل المستخدم: {selectedUser.full_name}</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الاسم الكامل</label>
                  <input
                    type="text"
                    value={newUser.full_name}
                    onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">البريد الإلكتروني</label>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">كلمة المرور الجديدة (اختياري)</label>
                  <input
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="اتركه فارغاً للاحتفاظ بكلمة المرور الحالية"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الدور</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value as 'admin' | 'user' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="user">مستخدم</option>
                    <option value="admin">مدير</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">الصلاحيات</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {Object.entries(permissionLabels).map(([key, label]) => (
                    <label key={key} className="flex items-center space-x-2 space-x-reverse">
                      <input
                        type="checkbox"
                        checked={newUser.permissions[key as keyof typeof newUser.permissions] ?? false}
                        onChange={(e) => setNewUser({
                          ...newUser,
                          permissions: {
                            ...newUser.permissions,
                            [key]: e.target.checked
                          }
                        })}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-700">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-6 border-t border-gray-200 mt-6">
              <button
                onClick={handleUpdateUser}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center justify-center space-x-2 space-x-reverse"
              >
                <Save className="h-4 w-4" />
                <span>حفظ التغييرات</span>
              </button>
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors duration-200"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activity Modal */}
      {showActivityModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">سجل نشاط: {selectedUser.full_name}</h3>
              <button
                onClick={() => setShowActivityModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4 max-h-96 overflow-y-auto">
              {activityLogs.map((log) => (
                <div key={log.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 space-x-reverse">
                      <div className="bg-blue-100 text-blue-600 p-2 rounded-full">
                        <Activity className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">{getActionLabel(log.action)}</h4>
                        <p className="text-sm text-gray-600 mt-1">
                          {log.details?.message || 'لا توجد تفاصيل إضافية'}
                        </p>
                        {log.performer && log.performer.full_name !== selectedUser.full_name && (
                          <p className="text-xs text-gray-500 mt-1">
                            تم بواسطة: {log.performer.full_name}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-left">
                      <p className="text-sm text-gray-500">{formatDate(log.created_at)}</p>
                    </div>
                  </div>
                </div>
              ))}

              {activityLogs.length === 0 && (
                <div className="text-center py-8">
                  <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">لا يوجد نشاط</h3>
                  <p className="text-gray-600">لم يتم تسجيل أي نشاط لهذا المستخدم</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;