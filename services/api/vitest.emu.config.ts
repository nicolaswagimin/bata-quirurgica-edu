import { defineConfig } from 'vitest/config';

// Emulator-backed tests. Run ONLY inside `firebase emulators:exec` (Firestore needs Java 21).
// This file is the env loader for those tests: emulator hosts are set here explicitly.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/emu/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/blueprints/**'],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 20_000,
    env: {
      STAGE: 'test',
      WEB_ORIGIN: 'http://localhost:4173',
      FIREBASE_PROJECT_ID: 'demo-bata',
      GCLOUD_PROJECT: 'demo-bata',
      FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
      FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
      SHOW_DRAFT_QUESTIONS: 'true',
    },
  },
});
