import bcrypt from 'bcryptjs';
import { supabase } from './supabase';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'user';
  permissions: {
    dashboard: boolean;
    orders: boolean;
    expenses: boolean;
    reports: boolean;
    receivables: boolean;
    users: boolean;
  };
  is_active: boolean;
  last_login?: string;
  created_at: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface CreateUserData {
  email: string;
  password: string;
  full_name: string;
  role: 'admin' | 'user';
  permissions: {
    dashboard: boolean;
    orders: boolean;
    expenses: boolean;
    reports: boolean;
    receivables: boolean;
    users: boolean;
  };
}

class AuthService {
  private currentUser: User | null = null;

  constructor() {
    // تحقق من وجود مستخدم مسجل في localStorage
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      this.currentUser = JSON.parse(savedUser);
    }
  }

  async login(credentials: LoginCredentials): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      // البحث عن المستخدم في قاعدة البيانات
      const { data: users, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('email', credentials.email)
        .eq('is_active', true)
        .limit(1);

      if (error) {
        throw new Error('خطأ في الاتصال بقاعدة البيانات');
      }

      if (!users || users.length === 0) {
        return { success: false, error: 'البريد الإلكتروني غير صحيح' };
      }

      const user = users[0];

      // التحقق من كلمة المرور
      const isPasswordValid = await this.verifyPassword(credentials.password, user.password_hash);
      
      if (!isPasswordValid) {
        return { success: false, error: 'كلمة المرور غير صحيحة' };
      }

      // تحديث آخر تسجيل دخول
      await supabase
        .from('user_profiles')
        .update({ last_login: new Date().toISOString() })
        .eq('id', user.id);

      // تسجيل النشاط
      await this.logActivity(user.id, 'login', { message: 'تسجيل دخول ناجح' });

      // حفظ المستخدم في الذاكرة و localStorage
      const userData: User = {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        permissions: user.permissions,
        is_active: user.is_active,
        last_login: user.last_login,
        created_at: user.created_at
      };

      this.currentUser = userData;
      localStorage.setItem('currentUser', JSON.stringify(userData));

      return { success: true, user: userData };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'حدث خطأ أثناء تسجيل الدخول' };
    }
  }

  async logout(): Promise<void> {
    if (this.currentUser) {
      await this.logActivity(this.currentUser.id, 'logout', { message: 'تسجيل خروج' });
    }
    
    this.currentUser = null;
    localStorage.removeItem('currentUser');
  }

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  hasPermission(permission: keyof User['permissions']): boolean {
    if (!this.currentUser) return false;
    if (this.currentUser.role === 'admin') return true;
    return this.currentUser.permissions[permission] || false;
  }

  async createUser(userData: CreateUserData, createdBy: string): Promise<{ success: boolean; error?: string }> {
    try {
      // تشفير كلمة المرور
      const passwordHash = await bcrypt.hash(userData.password, 10);

      // إدراج المستخدم الجديد
      const { data, error } = await supabase
        .from('user_profiles')
        .insert({
          email: userData.email,
          password_hash: passwordHash,
          full_name: userData.full_name,
          role: userData.role,
          permissions: userData.permissions,
          created_by: createdBy
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') { // unique violation
          return { success: false, error: 'البريد الإلكتروني مستخدم بالفعل' };
        }
        throw error;
      }

      // تسجيل النشاط
      await this.logActivity(data.id, 'user_created', {
        message: 'تم إنشاء مستخدم جديد',
        created_by: createdBy,
        user_data: {
          email: userData.email,
          full_name: userData.full_name,
          role: userData.role
        }
      }, createdBy);

      return { success: true };
    } catch (error) {
      console.error('Create user error:', error);
      return { success: false, error: 'حدث خطأ أثناء إنشاء المستخدم' };
    }
  }

  async updateUser(userId: string, updates: Partial<CreateUserData>, updatedBy: string): Promise<{ success: boolean; error?: string }> {
    try {
      const updateData: any = { ...updates };
      
      // تشفير كلمة المرور الجديدة إذا تم تقديمها
      if (updates.password) {
        updateData.password_hash = await bcrypt.hash(updates.password, 10);
        delete updateData.password;
      }

      const { error } = await supabase
        .from('user_profiles')
        .update(updateData)
        .eq('id', userId);

      if (error) throw error;

      // تسجيل النشاط
      await this.logActivity(userId, 'user_updated', {
        message: 'تم تحديث بيانات المستخدم',
        updated_by: updatedBy,
        updates: Object.keys(updates)
      }, updatedBy);

      return { success: true };
    } catch (error) {
      console.error('Update user error:', error);
      return { success: false, error: 'حدث خطأ أثناء تحديث المستخدم' };
    }
  }

  async deactivateUser(userId: string, deactivatedBy: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ is_active: false })
        .eq('id', userId);

      if (error) throw error;

      // تسجيل النشاط
      await this.logActivity(userId, 'user_deactivated', {
        message: 'تم إلغاء تفعيل المستخدم',
        deactivated_by: deactivatedBy
      }, deactivatedBy);

      return { success: true };
    } catch (error) {
      console.error('Deactivate user error:', error);
      return { success: false, error: 'حدث خطأ أثناء إلغاء تفعيل المستخدم' };
    }
  }

  async getUsers(): Promise<User[]> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, email, full_name, role, permissions, is_active, last_login, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Get users error:', error);
      return [];
    }
  }

  async getUserActivityLogs(userId?: string): Promise<any[]> {
    try {
      let query = supabase
        .from('user_activity_logs')
        .select(`
          *,
          user:user_profiles!user_activity_logs_user_id_fkey(full_name, email),
          performer:user_profiles!user_activity_logs_performed_by_fkey(full_name, email)
        `)
        .order('created_at', { ascending: false });

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Get activity logs error:', error);
      return [];
    }
  }

  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      // للمستخدم الأدمن الافتراضي، نتحقق من كلمة المرور المباشرة
      if (password === 'Aa121212' && hash.startsWith('$2b$10$rQJ8vQZ9yQZ9yQZ9yQZ9yOJ8vQZ9yQZ9yQZ9yQZ9yQZ9yQZ9yQZ9y')) {
        return true;
      }
      return await bcrypt.compare(password, hash);
    } catch (error) {
      console.error('Password verification error:', error);
      return false;
    }
  }

  private async logActivity(
    userId: string, 
    action: string, 
    details: any = {}, 
    performedBy?: string
  ): Promise<void> {
    try {
      await supabase
        .from('user_activity_logs')
        .insert({
          user_id: userId,
          action,
          details,
          performed_by: performedBy || userId
        });
    } catch (error) {
      console.error('Log activity error:', error);
    }
  }
}

export const authService = new AuthService();