import { defineConfig } from 'vite';

export default defineConfig({
  // Needed for https://GayathriMatha.github.io/bhajanamala/
  base: '/bhajanamala/',
  server: {
    port: 5173,
    open: true,
  },
  preview: {
    port: 4173,
  },
});
