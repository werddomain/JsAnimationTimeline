// e2e/demo/demo-renders.spec.ts
import { expect, test } from '@playwright/test';

test('the editor demo renders without console or page errors', async ({ page }) => {
  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Éditeur de timeline' })).toBeVisible();
  await expect(page.locator('.jt-shell')).toBeVisible();
  await expect(page.locator('.jt-zone--layers')).toBeVisible();
  await expect(page.locator('.jt-zone--ruler')).toBeVisible();
  await expect(page.getByRole('slider', { name: 'Tête de lecture' })).toBeVisible();
  expect(problems).toEqual([]);
});
