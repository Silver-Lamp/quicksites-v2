import { test, expect } from '@playwright/test';

test('legacy /admin/dashboard redirects to new dashboard', async ({ page }) => {
  const response = await page.goto('/admin/dashboard');
  expect(page.url()).toContain('/admin/sites/dashboard');
});
