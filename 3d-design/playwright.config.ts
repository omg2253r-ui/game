import { defineConfig, devices } from '@playwright/test';

// Point at an already-running deployment instead of starting dev servers:
//   E2E_BASE_URL=https://your-app.onrender.com pnpm e2e
const external = process.env.E2E_BASE_URL;

/**
 * E2E for the main flow. Starts the API with the fast mock provider and an
 * isolated data dir, plus the Vite dev server that proxies /api.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  // Next dev compiles each route on first hit; allow for it.
  expect: { timeout: 15_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: external ?? 'http://localhost:5174',
    trace: 'off',
    launchOptions: { args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] },
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
      testIgnore: /mobile\.spec\.ts/,
    },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: external
    ? undefined
    : [
        {
          command: 'pnpm --filter @3d-design/api exec next dev --port 3101',
          url: 'http://localhost:3101/api/health',
          env: {
            MOCK_DELAY_SCALE: '0.15',
            DATA_DIR: '.data-e2e',
            RATE_LIMIT_USER_PER_MIN: '100',
            RATE_LIMIT_IP_PER_MIN: '1000',
          },
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
        {
          command: 'pnpm --filter @3d-design/web exec vite --port 5174 --strictPort',
          url: 'http://localhost:5174',
          env: { API_URL: 'http://localhost:3101' },
          reuseExistingServer: !process.env.CI,
          timeout: 60_000,
        },
      ],
});
