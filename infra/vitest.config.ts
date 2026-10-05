import { defineConfig } from 'vitest/config';

// CDK assertion tests build apps with the context key 'aws:cdk:bundling-stacks': [] so no
// esbuild bundling happens here; `pnpm --filter @bata/infra run synth` exercises real bundling.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/cdk.out/**', '**/blueprints/**'],
    testTimeout: 120_000,
  },
});
