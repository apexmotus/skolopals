import { defineConfig } from 'vitest/config';

/**
 * Jest was dropped for the test runner: NestJS 12's packages publish ESM-
 * only, which Jest+CommonJS (this app's own module format — see
 * tsconfig.json) cannot `require()` without fighting Jest's ESM support at
 * every turn. Vitest runs on Vite/esbuild, which resolves both CJS and ESM
 * node_modules natively regardless of this app's own module format — the
 * same reason the current NestJS CLI scaffolds Vitest by default now.
 */
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/**/*.module.ts', 'src/main.ts'],
      thresholds: { lines: 75 },
    },
  },
});
