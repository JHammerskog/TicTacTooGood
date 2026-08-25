import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The dev server proxies /api to Flask so the frontend can use relative URLs
// and same-origin requests. The target differs between Docker Compose, where
// the backend is a service name, and a bare `npm run dev` on the host.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': process.env.VITE_API_TARGET ?? 'http://localhost:5000',
    },
  },
});
