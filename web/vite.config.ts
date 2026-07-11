import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const rootSourcePath = fileURLToPath(new URL('../src', import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(rootSourcePath),
    },
  },
  server: {
    port: 8080,
    open: true,
  },
});
