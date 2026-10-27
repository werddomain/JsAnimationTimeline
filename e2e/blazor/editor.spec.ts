// e2e/blazor/editor.spec.ts
import { expect, test } from '@playwright/test';

test('loads editor resources and binds import, undo and parent replacement', async ({ page }) => {
  const failures: string[] = [];
  page.on('pageerror', error => failures.push(error.message));
  const assets: string[] = [];
  page.on('response', response => {
    if (response.url().includes('_content/JsTimeline.Blazor/')) {
      assets.push(`${response.status()} ${new URL(response.url()).pathname}`);
    }
  });
  await page.goto('/');
  await expect(page.getByTestId('ready')).toHaveText('1');
  await expect(page.locator('.JsTimeLine')).toBeVisible();
  expect(assets.some(a => a.includes('200') && a.endsWith('/css/timeline-editor.css'))).toBeTruthy();
  expect(assets.some(a => a.includes('200') && a.endsWith('/js/timeline-editor.mjs'))).toBeTruthy();
  await page.getByRole('button', { name: 'Import' }).click();
  await expect(page.getByTestId('frames')).toHaveText('48');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByTestId('frames')).toHaveText('24');
  await page.getByRole('button', { name: 'Replace' }).click();
  await expect(page.getByTestId('frames')).toHaveText('72');
  await page.getByRole('button', { name: 'Export' }).click();
  await expect(page.getByTestId('export')).toContainText('72');
  expect(failures).toEqual([]);
  await expect(page.getByTestId('error')).toBeEmpty();
});

for (const scene of ['Html', 'JsModule', 'DotNet', 'None']) {
  test(`creates ${scene} stage in a browser`, async ({ page }) => {
    await page.goto(`/?scene=${scene}`);
    await expect(page.getByTestId('ready')).toHaveText('1');
    await expect(page.locator('.JsTimeLine')).toBeVisible();
    await expect(page.getByTestId('error')).toBeEmpty();
    if (scene === 'JsModule') await expect(page.getByTestId('module-stage')).toHaveText('created');
    if (scene === 'DotNet') await expect(page.getByTestId('dotnet-stage')).not.toHaveText('0');
  });
}


test('releases a .NET stage and reconnects it on the same editor', async ({ page }) => {
  await page.goto('/?scene=DotNet');
  await expect(page.getByTestId('ready')).toHaveText('1');
  await expect(page.getByTestId('bound')).toHaveText('1');
  await page.getByRole('button', { name: 'Use None' }).click();
  await expect(page.getByTestId('ready')).toHaveText('2');
  await expect(page.getByTestId('released')).toHaveText('1');
  await page.getByRole('button', { name: 'Use DotNet' }).click();
  await expect(page.getByTestId('ready')).toHaveText('3');
  await expect(page.getByTestId('bound')).toHaveText('2');
  await expect(page.getByTestId('error')).toBeEmpty();
});
