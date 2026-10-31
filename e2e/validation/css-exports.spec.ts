// e2e/validation/css-exports.spec.ts
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type {} from '../../demo/editor/src/cssExports';

const snapshot = (page: Page) => page.evaluate(() => window.cssExportsFixture!.snapshot());
async function seek(page: Page, frame: number): Promise<void> {
  await page.getByLabel('Image', { exact: true }).fill(String(frame));
  await page.getByRole('button', { name: 'Afficher cette image', exact: true }).click();
  await expect(page.locator('#frame-output')).toHaveAttribute('data-frame', String(frame));
}
async function compare(page: Page): Promise<void> {
  const state = await snapshot(page);
  if (state.cssScene === undefined) throw new Error('CSS scene is not loaded.');
  expect(state.cssScene.buttons).toEqual(state.source.buttons);
  const heights = await page.evaluate(() => {
    const measure = (root: ParentNode) => [...root.querySelectorAll('#css-scene .button')].map((button) => button.getBoundingClientRect().height);
    const output = document.querySelector<HTMLIFrameElement>('#css-frame')?.contentDocument;
    if (output === undefined || output === null) throw new Error('CSS frame unavailable.');
    return { source: measure(document), css: measure(output) };
  });
  expect(heights.source).toHaveLength(4);
  expect(heights.css).toEqual(heights.source);
  expect(state.cssScene.opacity).toBeCloseTo(state.source.opacity, 4);
  expect(state.cssScene.left).toBeCloseTo(state.source.left, 2);
  state.cssScene.transform.forEach((value, index) => expect(value).toBeCloseTo(state.source.transform[index], 3));
  expect(state.cssScene.color).toBe(state.source.color);
  expect(state.cssScene.borderStyle).toBe(state.source.borderStyle);
  expect(state.outsideOpacity).toBe('1');
  expect(state.animations).toBeGreaterThan(0);
}

test.describe('continuous HTML CSS exports', () => {
  let errors: string[];
  test.beforeEach(async ({ page }) => {
    errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.goto('/css-exports.html');
    await expect(page.getByRole('heading', { name: 'La même courbe, en CSS.' })).toBeVisible();
    await page.getByRole('button', { name: 'Exporter et comparer', exact: true }).click();
    await expect(page.locator('#export-status')).toContainText('CSS continu chargé');
  });
  test.afterEach(async ({ page }, info) => {
    await page.screenshot({ path: info.outputPath('css-exports.png'), fullPage: true });
    expect(errors).toEqual([]);
  });

  test('matches the real source at fractional frames and exact hold boundaries without editing keys', async ({ page }) => {
    const original = (await snapshot(page)).editable;
    for (const frame of [97, 1, 9.999, 10, 10.001, 20.5, 39.999, 40, 40.001, 49.75, 79.999, 80, 80.001]) {
      await seek(page, frame); await compare(page);
      const state = await snapshot(page);
      expect(state.source.buttons).toEqual(['0.5', '0.8', '0.5', '0.5']);
      expect(state.editable).toBe(original);
    }
    await seek(page, 9.999); expect((await snapshot(page)).source.opacity).toBe(1);
    await seek(page, 10); expect((await snapshot(page)).source.opacity).toBe(.2);
    await seek(page, 97); expect((await snapshot(page)).source.opacity).toBe(.9);
  });

  test('preserves Bezier acceleration independently from the other property timelines', async ({ page }) => {
    await page.getByLabel('Courbe de l’opacité', { exact: true }).selectOption('bezier');
    await page.getByRole('button', { name: 'Exporter et comparer', exact: true }).click();
    await expect(page.locator('#export-status')).toContainText('CSS continu chargé');
    for (const frame of [10.25, 20.5, 49.75, 79.5]) { await seek(page, frame); await compare(page); }
    expect((await snapshot(page)).css).toContain('cubic-bezier');
  });

  test('downloads the actual style sheet and recompiles while the source preview is active', async ({ page }) => {
    await seek(page, 49.75);
    const before = await snapshot(page);
    await page.getByRole('button', { name: 'Exporter et comparer', exact: true }).click();
    await expect(page.locator('#export-status')).toContainText('CSS continu chargé');
    const after = await snapshot(page);
    expect(after.source).toEqual(before.source);
    expect(after.editable).toBe(before.editable);
    await compare(page);
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Télécharger le CSS', exact: true }).click();
    const download = await pending;
    expect(download.suggestedFilename()).toBe('timeline-animation.css');
    const file = await download.path();
    if (file === null) throw new Error('CSS download unavailable.');
    expect(await readFile(file, 'utf8')).toBe(after.css);
  });

  test('refuses unsupported easing and an important source rule without replacing the valid output', async ({ page }) => {
    await seek(page, 61.5);
    const before = await snapshot(page);
    for (const name of ['Tester une courbe élastique', 'Tester une classe prioritaire']) {
      await page.getByRole('button', { name, exact: true }).click();
      await expect(page.locator('#refusal-status')).toContainText('Export refusé');
      await expect(page.locator('#refusal-status')).toContainText('JavaScript');
      const after = await snapshot(page);
      expect(after.editable).toBe(before.editable);
      expect(after.source).toEqual(before.source);
      expect(after.cssScene).toEqual(before.cssScene);
      expect(after.css).toBe(before.css);
      expect(after.refusedCss).toBe('');
    }
  });

  test('restores sources and exported scene without leaving styles or an animation loop behind', async ({ page }) => {
    await seek(page, 75.5);
    await page.getByRole('button', { name: 'Lire', exact: true }).click();
    await expect.poll(async () => (await snapshot(page)).playing).toBe(true);
    await page.getByRole('button', { name: 'Restaurer les styles', exact: true }).click();
    await expect(page.locator('#export-status')).toContainText('Styles d’origine restaurés');
    const state = await snapshot(page);
    expect(state.playing).toBe(false);
    expect(state.animations).toBe(0);
    expect(state.source.opacity).toBe(1);
    expect(state.source.buttons).toEqual(['1', '1', '1', '1']);
    expect(state.cssScene).toEqual(state.source);
    expect(state.outsideOpacity).toBe('1');
  });

  for (const width of [320, 768, 1440]) test(`keeps continuous comparison usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await expect(page.getByRole('button', { name: 'Télécharger le CSS', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await seek(page, 49.75); await compare(page);
  });
});

