import { defineConfig } from '@playwright/test';
import { env } from 'node:process';

const deployment = env.NUTRI_DEPLOY_URL;

export default defineConfig({
  testDir: './e2e',
  testMatch: deployment ? '**/production.e2e.ts' : '**/ui.e2e.ts',
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL: deployment ?? 'http://127.0.0.1:5178', browserName: 'chromium',
    viewport: { width: 390, height: 844 }, locale: 'ko-KR',
    screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: deployment ? undefined : { command: 'npm run dev -- --host 127.0.0.1 --port 5178',
    url: 'http://127.0.0.1:5178', reuseExistingServer: true },
});
