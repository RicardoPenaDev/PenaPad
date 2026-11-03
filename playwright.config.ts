import { defineConfig } from '@playwright/test';

// Testes da interface: o app roda no Chromium com a parte nativa simulada (e2e/harness.ts)
export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:5174',
    viewport: { width: 1280, height: 800 },
    locale: 'pt-BR',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx vite --port 5174 --strictPort',
    url: 'http://localhost:5174/e2e/index.html',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
