import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const api = process.env.API_URL ?? 'http://localhost:3001';
// Same-origin /api in dev and preview, so the session cookie and CSRF origin check just work.
const proxy = { '/api': { target: api, changeOrigin: false } };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy },
  preview: { proxy },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
  },
});
