import { defineConfig } from '@playwright/test';
import { execSync } from 'child_process';

const branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
const screenshotDir = `tests/__screenshots__/${branch}`;

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    screenshotDir
  }
});
