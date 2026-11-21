import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En desarrollo, /api se redirige a la API de FastAPI en el puerto 8080.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 4200,
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.js',
  },
});
