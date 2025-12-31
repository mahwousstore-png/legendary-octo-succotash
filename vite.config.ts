import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    allowedHosts: ["3000-i9roxn00sdd28okcl3gwm-137282cb.sg1.manus.computer"]
  }
});
