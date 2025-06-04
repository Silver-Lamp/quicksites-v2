import { test, expect } from '@playwright/test';

test('edit template via dashboard UI flow', async ({ page }) => {
  await page.goto('http://localhost:3000/admin/templates');

  // Select "towing-basic" from dropdown
  await page.selectOption('select', { label: 'towing-basic' });

  // Click the "Edit" tab to load the editor
  await page.getByRole('tab', { name: 'Edit' }).click();

  // Wait for the JSON editor to load
  await page.waitForSelector('[data-testid="template-json"]');

  // Update JSON
  await page.getByTestId('template-json').fill(`{
    "pages": [
      {
        "slug": "index",
        "content_blocks": [
          { "type": "hero", "content": "Updated by Playwright" }
        ]
      }
    ]
  }`);

  // Fill in commit message
  await page.getByTestId('commit-message').fill('Updated via dashboard flow test');

  // Save template
  await page.getByTestId('save-template').click();

  // Confirm toast
  await expect(page.locator('text=Template saved successfully.')).toBeVisible({ timeout: 5000 });
});
