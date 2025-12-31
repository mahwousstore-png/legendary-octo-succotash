import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    allowedHosts: true,
    host: true
  },
  build: {
    // تقسيم الكود لتجنب مشاكل التصغير
    rollupOptions: {
      output: {
        manualChunks: {
          // فصل مكتبات React
          'react-vendor': ['react', 'react-dom'],
          // فصل مكتبات UI
          'ui-vendor': ['lucide-react', 'react-hot-toast'],
          // فصل مكتبات البيانات
          'data-vendor': ['@supabase/supabase-js', '@tanstack/react-query'],
          // فصل مكتبات التصدير
          'export-vendor': ['exceljs', 'file-saver', 'jspdf', 'html2canvas'],
          // فصل مكتبات الرسوم البيانية
          'chart-vendor': ['echarts', 'echarts-for-react'],
        }
      }
    },
    // تعطيل التصغير المتقدم الذي يسبب المشكلة
    minify: 'esbuild',
    target: 'es2020',
    // زيادة حد حجم الملفات
    chunkSizeWarningLimit: 2000,
  }
});
