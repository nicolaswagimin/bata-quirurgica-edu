import { defineConfig } from 'vitest/config';

// Unit tests only: pure logic, node environment, no DOM. UI behaviour is covered by Playwright (e2e/).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/unit/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/blueprints/**', 'e2e/**'],
  },
});
