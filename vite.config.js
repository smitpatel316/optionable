import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // Keep fonts as real files: the server CSP is `default-src 'self'` with no
    // `font-src data:`, so Vite's <4KB data-URI inlining would get blocked.
    assetsInlineLimit: (filePath) => (/\.(woff2?|ttf|otf|eot)$/.test(filePath) ? false : undefined),
  },
});

