import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  publicDir: 'public',
  server: {
    port: 7822,
    open: '/index.html',
  },
  build: {
    rollupOptions: {
      input: {
        main:    'index.html',
        sheet:   'sheet.html',
        builder: 'builder.html',
        gm:      'gm.html',
      },
    },
  },
});
