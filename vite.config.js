import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    target: 'esnext',
    minify: false,
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor-react';
            }
            if (id.includes('@carbon/react') || id.includes('@carbon/icons-react')) {
              return 'vendor-carbon';
            }
            if (id.includes('@carbon/charts') || id.includes('d3')) {
              return 'vendor-charts';
            }
            if (id.includes('zustand') || id.includes('axios')) {
              return 'vendor-state';
            }
            return 'vendor';
          }
        }
      }
    },
    chunkSizeWarningLimit: 1000,
    sourcemap: false
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@carbon/react',
      '@carbon/icons-react',
      'zustand'
    ]
  },
  server: {
    port: 5173,
    strictPort: true
  }
});
