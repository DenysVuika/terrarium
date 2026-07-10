import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/simulate.ts'],
  outDir: 'dist',
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  sourcemap: true,
  clean: true,
  shims: false,
});
