import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/play/',
  build: {
    outDir: resolve(__dirname, '../../play'),
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    open: true,
  },
});
