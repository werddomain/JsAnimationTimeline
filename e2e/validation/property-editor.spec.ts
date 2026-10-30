// e2e/validation/property-editor.spec.ts
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type {} from '../../demo/editor/src/propertyEditor';

const layer = (page: Page, id: string) => page.locator(`.jt-layer-row[data-row-id="${id}"]`);
const property = (page: Page, name: string) => page.locator(`.jt-grid__row[data-layer-id="card"][data-property="${name}"]`);
const snapshot = (page: Page) => page.evaluate(() => JSON.stringify(window.propertyEditorFixture?.editor.document));
async function point(page: Page, name: string, frame: number): Promise<{ x: number; y: number }> {
  await property(page, name).scrollIntoViewIfNeeded();
  return page.evaluate(({ name, frame }) => {
    const grid = window.propertyEditorFixture?.editor.getService('frames.grid');
    const row = grid?.rows().find((entry) => entry.kind === 'property' && entry.layerId === 'card' && entry.property === name);
    const rect = grid?.element()?.getBoundingClientRect();
    if (grid === undefined || row === undefined || rect === undefined) throw new Error('Missing property geometry');
    return { x: rect.left + (frame - 0.5) * grid.frameWidth(), y: rect.top + (row.index + 0.5) * grid.rowHeight() };
  }, { name, frame });
}
async function selectFrame(page: Page, name: string, frame: number, ctrl = false): Promise<void> {
  const position = await point(page, name, frame);
  if (ctrl) await page.keyboard.down('Control');
  await page.mouse.click(position.x, position.y);
  if (ctrl) await page.keyboard.up('Control');
}
const undo = (page: Page) => page.getByRole('button', { name: 'Annuler', exact: true }).click();
const createTween = (page: Page) => page.getByRole('button', { name: 'Créer une interpolation de mouvement', exact: true });

test.describe('production property rows and commands', () => {
  let errors: string[];
  test.beforeEach(async ({ page }) => {
    errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.goto('/property-editor.html');
    await page.waitForFunction(() => window.propertyEditorFixture?.ready);
    await page.getByRole('combobox', { name: 'Niveau de zoom', exact: true }).selectOption({ label: 'Ajuster à la fenêtre' });
  });
  test.afterEach(async ({ page }, info) => {
    await page.screenshot({ path: info.outputPath('property-editor.png'), fullPage: true });
    expect(errors).toEqual([]);
  });

  test('temporarily expands selection, restores manual state and keeps list/grid aligned without history', async ({ page }) => {
    const before = await snapshot(page);
    await layer(page, 'card').locator('.jt-layer-row__name').click();
    await expect(page.locator('.jt-property-row[data-layer-id="card"]')).toHaveCount(3);
    await layer(page, 'orb').locator('.jt-layer-row__name').click();
    await expect(page.locator('.jt-property-row[data-layer-id="card"]')).toHaveCount(0);
    await expect(page.locator('.jt-property-row[data-layer-id="orb"]')).toHaveCount(1);
    await layer(page, 'card').getByRole('button', { name: 'Déplier les propriétés', exact: true }).click();
    await layer(page, 'card').locator('.jt-layer-row__name').click();
    await layer(page, 'orb').locator('.jt-layer-row__name').click();
    await expect(page.locator('.jt-property-row')).toHaveCount(4);
    const labelBox = await page.locator('.jt-property-row[data-layer-id="card"][data-property="x"]').boundingBox();
    const gridBox = await property(page, 'x').boundingBox();
    expect(labelBox).not.toBeNull(); expect(gridBox).not.toBeNull();
    expect(Math.abs((labelBox?.y ?? 0) - (gridBox?.y ?? 0))).toBeLessThanOrEqual(1);
    expect(await snapshot(page)).toBe(before);
    expect(await page.evaluate(() => window.propertyEditorFixture?.editor.canUndo)).toBe(false);
    expect(await page.evaluate(() => window.propertyEditorFixture?.events().length)).toBe(0);
  });

  test('creates a tween from exactly two keys and F6 splits it without changing samples', async ({ page }) => {
    await layer(page, 'card').locator('.jt-layer-row__name').click();
    await selectFrame(page, 'opacity', 1);
    await expect(createTween(page)).toHaveAttribute('aria-disabled', 'true');
    await selectFrame(page, 'opacity', 100, true);
    await expect(createTween(page)).not.toHaveAttribute('aria-disabled', 'true');
    const original = await snapshot(page);
    await createTween(page).click();
    const tweened = await snapshot(page);
    expect(tweened).not.toBe(original);
    const sample = () => page.evaluate(() => Array.from({ length: 199 }, (_, i) =>
      window.propertyEditorFixture?.editor.sample(1 + i / 2).layer('card')?.propertyValues?.opacity));
    const beforeSamples = await sample();
    await selectFrame(page, 'opacity', 50);
    await page.keyboard.press('F6');
    await expect(property(page, 'opacity').locator('[data-frame="50"]')).toBeVisible();
    expect(await sample()).toEqual(beforeSamples);
    await undo(page); expect(await snapshot(page)).toBe(tweened);
    await undo(page); expect(await snapshot(page)).toBe(original);
  });

  test('moves a property key, edits another with the inspector and restores both through undo', async ({ page }) => {
    await layer(page, 'card').locator('.jt-layer-row__name').click();
    const before = await snapshot(page);
    const start = await point(page, 'x', 100); const end = await point(page, 'x', 80);
    await page.mouse.move(start.x, start.y); await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 8 }); await page.mouse.up();
    await expect(property(page, 'x').locator('[data-frame="80"]')).toBeVisible();
    await undo(page); expect(await snapshot(page)).toBe(before);
    await selectFrame(page, 'rotation', 50);
    await expect(page.locator('.jt-properties-panel__context')).toContainText('image 50');
    const field = page.locator('.jt-properties-panel [data-property="rotation"] input');
    await field.fill('45'); await field.press('Enter');
    await expect(property(page, 'rotation').locator('[data-frame="50"]')).toBeVisible();
    expect(await page.evaluate(() => window.propertyEditorFixture?.editor.sample(50).layer('card')?.propertyValues?.rotation))
      .toEqual({ kind: 'number', value: 45 });
    await undo(page); expect(await snapshot(page)).toBe(before);
  });

  test('refuses three keys, mixed properties and legacy copying without changing the document', async ({ page }) => {
    await layer(page, 'card').locator('.jt-layer-row__name').click();
    await selectFrame(page, 'opacity', 50); await page.keyboard.press('F6');
    const before = await snapshot(page);
    await selectFrame(page, 'opacity', 1);
    await selectFrame(page, 'opacity', 50, true);
    await selectFrame(page, 'opacity', 100, true);
    await expect(createTween(page)).toHaveAttribute('aria-disabled', 'true');
    await createTween(page).click({ force: true }); expect(await snapshot(page)).toBe(before);
    await selectFrame(page, 'opacity', 1); await selectFrame(page, 'x', 100, true);
    await expect(createTween(page)).toHaveAttribute('aria-disabled', 'true');
    await page.keyboard.press('Control+c');
    await expect(page.locator('#status')).toContainText('copie des propriétés indépendantes');
    expect(await snapshot(page)).toBe(before);
  });
});
