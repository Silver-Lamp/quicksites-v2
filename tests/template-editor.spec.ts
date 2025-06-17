import { test, expect } from '@playwright/test';
// import fetch from 'node-fetch';

const TEST_TEMPLATE_NAME = 'towing-basic';

test.beforeEach(async () => {
  // Seed a test template
  await fetch('http://localhost:3000/api/templates/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      template_name: TEST_TEMPLATE_NAME,
      industry: 'towing',
      layout: 'default',
      color_scheme: 'blue',
      data: {
        pages: [{ slug: 'index', content_blocks: [] }],
      },
      editor_id: 'playwright@test.local',
      commit_message: 'Created from test',
    }),
  });
});

test('edit and save an existing template', async ({ page }) => {
  await page.goto(
    `http://localhost:3000/admin/templates/${TEST_TEMPLATE_NAME}`
  );

  // Wait for the editor to appear
  await page.waitForSelector('[data-testid="template-json"]');

  // Update JSON content
  await page.getByTestId('template-json').fill(`{
    "pages": [
      {
        "slug": "index",
        "content_blocks": [
          { "type": "hero", "content": "Playwright was here." }
        ]
      }
    ]
  }`);

  // Fill in commit message
  await page
    .getByTestId('commit-message')
    .fill('Automated update from Playwright');

  // Trigger save
  await page.getByTestId('save-template').click();

  // Confirm success
  await expect(page.locator('text=Template saved successfully.')).toBeVisible({
    timeout: 5000,
  });
});
