import { test, expect } from '@playwright/test';

const routes = ['/', '/admin/dashboard', '/unauthorized'];

for (const route of routes) {
  test(`visual regression: ${route}`, async ({ page }) => {
    await page.goto('http://localhost:3000' + route);
    await expect(page).toHaveScreenshot(route.replace(/\//g, '_') + '.png', { fullPage: true });
  });
}
