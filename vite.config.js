import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    // Older Android WebViews / iOS 14 Safari still show up on CrazyGames mobile
    target: 'es2020',
    cssTarget: ['safari14', 'chrome87'],
    outDir: 'dist',
    assetsDir: 'assets',
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  },
  server: {
    host: true,
    port: 3000
  }
});
