import { defineConfig } from 'vitest/config';

// Unit tests: no emulators, no network. Env needed by lazily-read config is set here (loader = this file).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/unit/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/blueprints/**'],
    env: {
      STAGE: 'test',
      WEB_ORIGIN: 'http://localhost:4173',
      FIREBASE_PROJECT_ID: 'demo-bata',
      GROQ_CHAT_MODEL: 'openai/gpt-oss-120b',
      GROQ_STT_MODEL: 'whisper-large-v3-turbo',
      KB_MAX_DISTANCE: '0.35',
    },
    // On with --coverage (pnpm test:coverage) or COVERAGE=1 (CI); lcov is read by SonarQube Cloud.
    coverage: {
      enabled: process.env.COVERAGE === '1',
      provider: 'v8',
      include: ['src/**/*.ts'],
      reporter: ['text-summary', 'lcov'],
      reportsDirectory: 'coverage',
    },
  },
});
