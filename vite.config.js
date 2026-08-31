import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { LOCAL_API_HOST, LOCAL_API_PORT } from './config/local-development.js';

export default defineConfig({
  plugins: [tailwindcss()],
  server: { proxy: { '/api': `http://${LOCAL_API_HOST}:${LOCAL_API_PORT}` } },
  build: { sourcemap: false },
});
