import { defineConfig } from 'vitest/config';

// CDK assertion tests build apps with the context key 'aws:cdk:bundling-stacks': [] so no
// esbuild bundling happens here; `pnpm --filter @bata/infra run synth` exercises real bundling.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/cdk.out/**', '**/blueprints/**'],
    testTimeout: 120_000,
    // On with --coverage (pnpm test:coverage) or COVERAGE=1 (CI); lcov is read by SonarQube Cloud.
    coverage: {
      enabled: process.env.COVERAGE === '1',
      provider: 'v8',
      include: ['lib/**/*.ts', 'bin/**/*.ts'],
      reporter: ['text-summary', 'lcov'],
      reportsDirectory: 'coverage',
    },
  },
});
