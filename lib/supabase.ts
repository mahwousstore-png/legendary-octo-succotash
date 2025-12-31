import { createClient } from '@supabase/supabase-js';

// التحقق من المتغيرات
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  console.error('❌ Missing VITE_SUPABASE_URL environment variable');
  throw new Error('Supabase URL is not configured. Please check your environment variables.');
}

if (!supabaseAnonKey) {
  console.error('❌ Missing VITE_SUPABASE_ANON_KEY environment variable');
  throw new Error('Supabase Anon Key is not configured. Please check your environment variables.');
}

console.log('✅ Supabase configured:', {
  url: supabaseUrl.substring(0, 30) + '...',
  hasKey: !!supabaseAnonKey
});

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  global: {
    headers: {
      'x-application-name': 'mahwous-store'
    }
  }
});

// اختبار الاتصال
supabase
  .from('user_profiles')
  .select('count', { count: 'exact', head: true })
  .then(({ error }) => {
    if (error) {
      console.warn('⚠️  Supabase connection test failed:', error.message);
    } else {
      console.log('✅ Supabase connection successful');
    }
  })
  .catch(err => {
    console.error('❌ Supabase connection error:', err);
  });

export interface WebhookData {
  id: string;
  source: string;
  type: string;
  data: any;
  timestamp: string;
  created_at: string;
  updated_at: string;
}