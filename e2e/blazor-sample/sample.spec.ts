// e2e/blazor-sample/sample.spec.ts
import { expect, test } from '@playwright/test';

test('l’application charge ses ressources et lie les modifications de l’éditeur', async ({ page }) => {
  const errors: string[] = [];
  const assets: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', response => {
    if (response.url().includes('_content/JsTimeline.Blazor/')) {
      assets.push(`${response.status()} ${new URL(response.url()).pathname}`);
    }
  });

  await page.goto('/');
  await expect(page.locator('.JsTimeLine')).toBeVisible();
  expect(assets.some(asset => asset.startsWith('200 ') && asset.endsWith('/css/timeline-editor.css'))).toBeTruthy();
  expect(assets.some(asset => asset.startsWith('200 ') && asset.endsWith('/js/timeline-editor.mjs'))).toBeTruthy();
  expect(assets.some(asset => asset.startsWith('200 ') && asset.endsWith('/js/timeline-runtime.mjs'))).toBeTruthy();
  await expect(page.getByText('Durée : 24 images')).toBeVisible();
  await page.getByRole('button', { name: 'Importer un exemple' }).click();
  await expect(page.getByText('Durée : 48 images')).toBeVisible();
  await page.getByText('Annuler', { exact: true }).click();
  await expect(page.getByText('Durée : 24 images')).toBeVisible();
  await expect(page.getByRole('alert')).toBeEmpty();
  expect(errors).toEqual([]);
});

test('lecture et navigation entre les scènes restent opérationnelles', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');
  await page.getByRole('link', { name: 'Lecteur HTML' }).click();
  await page.getByRole('button', { name: 'Image 1', exact: true }).click();
  await expect(page.getByText('Image : 1', { exact: true })).toBeVisible();
  await expect(page.locator('#logo')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
  await page.getByRole('button', { name: 'Image 24', exact: true }).click();
  await expect(page.getByText('Image : 24', { exact: true })).toBeVisible();
  await expect(page.locator('#logo')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 200, 0)');
  await page.getByRole('button', { name: 'Lire', exact: true }).click();
  await expect(page.getByText('Image : 24', { exact: true })).not.toBeVisible();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('link', { name: 'Scène C#' }).click();
  await expect(page.locator('.JsTimeLine')).toBeVisible();
  await expect(page.getByTestId('stage-object')).toBeVisible();
  const playhead = page.getByRole('slider', { name: 'Tête de lecture', exact: true });
  await playhead.focus();
  await playhead.press('Home');
  await expect(page.getByTestId('stage-value')).toHaveText('0');
  await playhead.press('End');
  await expect(page.getByTestId('stage-value')).toHaveText('100');
  await page.getByRole('link', { name: 'Éditeur HTML' }).click();
  await expect(page.locator('.JsTimeLine')).toBeVisible();
  await expect(page.getByText('Durée : 24 images')).toBeVisible();
  await page.getByRole('link', { name: 'Scène C#' }).click();
  await expect(page.locator('.JsTimeLine')).toBeVisible();
  await expect(page.getByTestId('stage-value')).toHaveText('0');
  await page.getByRole('slider', { name: 'Tête de lecture', exact: true }).press('End');
  await expect(page.getByTestId('stage-value')).toHaveText('100');
  await expect(page.getByRole('alert')).toBeEmpty();
  expect(errors).toEqual([]);
});
