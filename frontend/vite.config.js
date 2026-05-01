import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/healthstitch/',
  server: {
    port: 5173,
    // Proxy only used in local dev (when VITE_API_URL is unset / same-origin).
    // When VITE_API_URL points at a tunnel, requests go directly to that origin.
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/auth': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
});
