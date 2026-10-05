import { defineConfig, devices } from '@playwright/test';

// E2E_WITH_API=1 also starts the local API dev server (services/api/scripts/dev-server.ts, step 8).
// Tests tagged @emu need the Firebase emulators: run them inside `firebase emulators:exec`.
const withApi = process.env.E2E_WITH_API === '1';

const apiServer = {
  command: 'pnpm --filter @bata/api run dev',
  url: 'http://127.0.0.1:3001/v1/health',
  reuseExistingServer: !process.env.CI,
  timeout: 60_000,
  env: {
    STAGE: 'dev',
    WEB_ORIGIN: 'http://localhost:4173',
    FIREBASE_PROJECT_ID: 'demo-bata',
    GCLOUD_PROJECT: 'demo-bata',
    FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
    FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
    SHOW_DRAFT_QUESTIONS: 'true',
  },
};

const webServer = {
  command: 'pnpm run build:e2e && pnpm run preview',
  url: 'http://localhost:4173',
  reuseExistingServer: !process.env.CI,
  timeout: 180_000,
};

export default defineConfig({
  testDir: './e2e',
  testIgnore: ['**/blueprints/**'],
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    permissions: ['camera', 'microphone'],
    launchOptions: {
      args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: withApi ? [apiServer, webServer] : [webServer],
});
