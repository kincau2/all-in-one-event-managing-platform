import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@aioemp/seatmap-core': path.resolve(__dirname, '../seatmap-core/src/index.ts'),
    },
  },
  build: {
    outDir: path.resolve(__dirname, '../admin/js/seatmap-editor'),
    emptyOutDir: true,
    lib: {
      entry: path.resolve(__dirname, 'src/main.tsx'),
      name: 'AioempSeatmapEditor',
      formats: ['iife'],
      fileName: () => 'seatmap-editor.js',
    },
    rollupOptions: {
      // React & ReactDOM will be provided by WordPress
      // but we bundle them for simplicity in this plugin
      output: {
        // Single file output
        inlineDynamicImports: true,
        assetFileNames: 'seatmap-editor.[ext]',
      },
    },
    sourcemap: true,
    minify: 'esbuild',
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
});
