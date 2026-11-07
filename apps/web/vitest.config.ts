import { defineConfig } from 'vitest/config';

// Unit tests only: pure logic, node environment, no DOM. UI behaviour is covered by Playwright (e2e/).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/unit/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/blueprints/**', 'e2e/**'],
    // On with --coverage (pnpm test:coverage) or COVERAGE=1 (CI); lcov is read by SonarQube Cloud.
    coverage: {
      enabled: process.env.COVERAGE === '1',
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      reporter: ['text-summary', 'lcov'],
      reportsDirectory: 'coverage',
    },
  },
});
