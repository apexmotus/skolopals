import { defineConfig } from 'vitest/config';

/** e2e suite (Phase 2+ — see docs/nestjs-api-plan/06-phase2-auth.md); no specs exist yet. */
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    testTimeout: 30_000,
  },
});
