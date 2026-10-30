// e2e/validation/property-editor-easing.spec.ts
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import type { IPropertyEditorFixture } from '../../demo/editor/src/propertyEditor';

/** Observe only: every edit, selection, history action and reload uses real UI. */
async function snapshot(page: Page) {
  return page.evaluate(() => {
    const fixture = window.propertyEditorFixture as IPropertyEditorFixture;
    const editor = fixture.editor;
    const orb = editor.document.layers.find((layer) => layer.id === 'orb');
    const card = editor.document.layers.find((layer) => layer.id === 'card');
    if (orb?.type !== 'layer' || card?.type !== 'layer') throw new Error('Missing property editor objects');
    return {
      document: editor.document, orb: orb.propertyTimelines?.x, card: card.propertyTimelines,
      eventCount: fixture.events().length, undo: editor.canUndo, redo: editor.canRedo,
      samples: Array.from({ length: 199 }, (_, index) => {
        const value = editor.sample(1 + index / 2).layer('orb')?.propertyValues?.x;
        return value?.kind === 'number' ? value.value : undefined;
      })
    };
  });
}

async function selectOrb(page: Page): Promise<void> {
  await page.getByRole('treeitem', { name: 'Orbe', exact: true }).click();
  await page.locator('.jt-property-row[data-layer-id="orb"][data-property="x"]').click();
  await page.getByRole('combobox', { name: 'Niveau de zoom', exact: true }).selectOption('0.25');
}

async function clickFrame(page: Page, frame: number, button: 'left' | 'right' = 'left'): Promise<void> {
  const row = page.locator('.jt-grid__row[data-layer-id="orb"][data-property="x"]');
  await expect(row).toBeVisible();
  const position = await row.evaluate((element, at) => {
    const width = Number.parseFloat(getComputedStyle(element).getPropertyValue('--jt-grid-frame-width'));
    if (!Number.isFinite(width) || width <= 0) throw new Error('Missing frame width');
    return { x: (at - 0.5) * width, y: element.getBoundingClientRect().height / 2 };
  }, frame);
  await row.click({ position, button });
}

async function openEffect(page: Page, frame = 10): Promise<Locator> {
  await clickFrame(page, frame, 'right');
  await page.getByRole('menuitem', { name: 'Modifier l’accélération', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Effet de l’interpolation', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('combobox', { name: 'Famille', exact: true })).toBeFocused();
  return dialog;
}

test.describe('property easing through the production editor', () => {
  const problems = new WeakMap<Page, string[]>();
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const errors: string[] = []; problems.set(page, errors);
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error' || message.type() === 'warning') errors.push(message.text()); });
    page.on('requestfailed', (request) => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
    await page.goto('/property-editor.html');
    await page.waitForFunction(() => window.propertyEditorFixture?.ready === true);
    await selectOrb(page);
  });
  test.afterEach(async ({ page }, testInfo) => {
    await page.screenshot({ path: testInfo.outputPath('property-editor-easing.png'), fullPage: true });
    expect(problems.get(page)).toEqual([]);
  });

  test('previews overshoot locally, applies a parameterized effect and preserves exact history and JSON reload', async ({ page }, testInfo) => {
    const before = await snapshot(page);
    let dialog = await openEffect(page);
    const family = dialog.getByRole('combobox', { name: 'Famille', exact: true });
    await expect(family.locator('option')).toHaveCount(13);
    await expect(dialog.getByRole('combobox', { name: 'Mode', exact: true }).locator('option')).toHaveCount(3);
    await family.selectOption('back');
    await dialog.getByRole('combobox', { name: 'Mode', exact: true }).selectOption('out');
    await dialog.getByRole('spinbutton', { name: 'Amplitude', exact: true }).fill('2');
    expect(Number(await dialog.locator('svg').getAttribute('data-max'))).toBeGreaterThan(1);
    expect((await snapshot(page)).document).toEqual(before.document);
    expect((await snapshot(page)).eventCount).toBe(0);
    await dialog.screenshot({ path: testInfo.outputPath('easing-back-preview.png') });
    await dialog.getByRole('button', { name: 'Annuler', exact: true }).click();
    expect(await snapshot(page)).toEqual(before);

    dialog = await openEffect(page);
    await dialog.getByRole('combobox', { name: 'Famille', exact: true }).selectOption('power');
    await dialog.getByRole('combobox', { name: 'Mode', exact: true }).selectOption('in');
    await dialog.getByRole('spinbutton', { name: 'Puissance', exact: true }).fill('3');
    await dialog.getByRole('button', { name: 'Appliquer', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    const after = await snapshot(page);
    expect(after.orb?.transitions?.[0].easing).toEqual({ kind: 'effect', family: 'power', mode: 'in', parameters: { power: 3 } });
    expect(after.samples[98]).toBeCloseTo(140 * (49 / 99) ** 3, 10);
    expect(after.samples).not.toEqual(before.samples); expect(after.card).toEqual(before.card);
    expect(after.eventCount).toBe(1);
    await page.getByRole('button', { name: 'Annuler', exact: true }).click();
    expect((await snapshot(page)).document).toEqual(before.document);
    expect((await snapshot(page)).undo).toBe(false);
    await page.getByRole('button', { name: 'Rétablir', exact: true }).click();
    expect((await snapshot(page)).document).toEqual(after.document);
    await page.getByRole('button', { name: 'Mémoriser le document', exact: true }).click();
    await page.getByRole('button', { name: 'Réinitialiser la démonstration', exact: true }).click();
    expect((await snapshot(page)).document).toEqual(before.document);
    await page.getByRole('button', { name: 'Recharger la copie', exact: true }).click();
    const reloaded = await snapshot(page);
    expect(reloaded.document).toEqual(after.document); expect(reloaded.samples).toEqual(after.samples);
    await testInfo.attach('property-easing-history.json', { body: Buffer.from(JSON.stringify({ before, after, reloaded }, null, 2)), contentType: 'application/json' });
  });

  test('rejects invalid Bezier drafts, applies explicit control points, and undoes through the toolbar', async ({ page }) => {
    const before = await snapshot(page); const dialog = await openEffect(page);
    await dialog.getByRole('combobox', { name: 'Famille', exact: true }).selectOption('bezier');
    await expect(dialog.getByRole('combobox', { name: 'Mode', exact: true })).toBeHidden();
    await dialog.getByRole('spinbutton', { name: 'X1', exact: true }).fill('-0.1');
    await expect(dialog.getByRole('button', { name: 'Appliquer', exact: true })).toBeDisabled();
    await expect(dialog.getByRole('status')).toContainText('Vérifiez les paramètres');
    expect(await snapshot(page)).toEqual(before);
    await dialog.getByRole('spinbutton', { name: 'X1', exact: true }).fill('0.25');
    await dialog.getByRole('spinbutton', { name: 'Y1', exact: true }).fill('-0.55');
    await dialog.getByRole('spinbutton', { name: 'X2', exact: true }).fill('0.7');
    await dialog.getByRole('spinbutton', { name: 'Y2', exact: true }).fill('1.6');
    expect(Number(await dialog.locator('svg').getAttribute('data-min'))).toBeLessThan(0);
    expect(Number(await dialog.locator('svg').getAttribute('data-max'))).toBeGreaterThan(1);
    await dialog.getByRole('button', { name: 'Appliquer', exact: true }).click();
    expect((await snapshot(page)).orb?.transitions?.[0].easing).toEqual({ kind: 'bezier', x1: 0.25, y1: -0.55, x2: 0.7, y2: 1.6 });
    await page.getByRole('button', { name: 'Annuler', exact: true }).click();
    expect((await snapshot(page)).document).toEqual(before.document);
  });

  test('captures inside an elastic tween with F6 and preserves the source until a new effect is confirmed', async ({ page }, testInfo) => {
    const before = await snapshot(page);
    await clickFrame(page, 50); await page.keyboard.press('F6');
    await expect.poll(async () => (await snapshot(page)).orb?.keys.length).toBe(3);
    const split = await snapshot(page);
    expect(split.orb?.keys.map(({ frame }) => frame)).toEqual([1, 50, 100]);
    expect(split.orb?.transitions).toHaveLength(2);
    expect(split.orb?.transitions?.every(({ source }) => source !== undefined)).toBe(true);
    expect(split.samples).toEqual(before.samples);
    let dialog = await openEffect(page, 20);
    await expect(dialog).toContainText('Courbe conservée');
    await expect(dialog.getByRole('img', { name: 'Aperçu des valeurs de la courbe conservée', exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Appliquer', exact: true })).toBeDisabled();
    await dialog.screenshot({ path: testInfo.outputPath('easing-retained-source.png') });
    await page.keyboard.press('Escape');
    expect(await snapshot(page)).toEqual(split);
    dialog = await openEffect(page, 20);
    await dialog.getByRole('combobox', { name: 'Famille', exact: true }).selectOption('bounce');
    await dialog.getByRole('spinbutton', { name: 'Rebonds', exact: true }).fill('5');
    await dialog.getByRole('button', { name: 'Annuler', exact: true }).click();
    expect(await snapshot(page)).toEqual(split);
    dialog = await openEffect(page, 20);
    await dialog.getByRole('combobox', { name: 'Famille', exact: true }).selectOption('bounce');
    await dialog.getByRole('combobox', { name: 'Mode', exact: true }).selectOption('out');
    await dialog.getByRole('spinbutton', { name: 'Rebonds', exact: true }).fill('5');
    await dialog.getByRole('spinbutton', { name: 'Rapport des rebonds', exact: true }).fill('2.5');
    await dialog.getByRole('button', { name: 'Appliquer', exact: true }).click();
    const changed = await snapshot(page);
    expect(changed.orb?.transitions?.[0].source).toBeUndefined();
    expect(changed.orb?.transitions?.[1]).toEqual(split.orb?.transitions?.[1]);
    expect(changed.orb?.keys).toEqual(split.orb?.keys);
    expect(changed.eventCount).toBe(split.eventCount + 1);
    await page.getByRole('button', { name: 'Annuler', exact: true }).click();
    expect((await snapshot(page)).document).toEqual(split.document);
    await page.getByRole('button', { name: 'Annuler', exact: true }).click();
    expect((await snapshot(page)).document).toEqual(before.document);
  });

  for (const width of [375, 768, 1440]) test(`keeps the effect dialog accessible at ${width}px`, async ({ page }, testInfo) => {
    const before = await snapshot(page); const dialog = await openEffect(page);
    await page.setViewportSize({ width, height: 900 });
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    const box = await dialog.boundingBox();
    if (box === null) throw new Error('Missing effect dialog bounds');
    expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(width);
    await page.keyboard.press('Shift+Tab');
    await expect(dialog.getByRole('button', { name: 'Annuler', exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('combobox', { name: 'Famille', exact: true })).toBeFocused();
    await expect(dialog.getByRole('img', { name: 'Aperçu de la courbe d’accélération', exact: true })).toBeVisible();
    await dialog.screenshot({ path: testInfo.outputPath(`easing-dialog-${width}.png`) });
    await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
    expect(await snapshot(page)).toEqual(before);
  });
});
