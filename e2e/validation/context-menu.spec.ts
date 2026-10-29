// e2e/validation/context-menu.spec.ts
/** Permanent I1 validation through real menus, keyboard and read-only fixture inspection. */
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import type { ILayer } from '@kazo-ca/timeline-runtime';
import type { ContextMenuEditorId } from '../../demo/runtime/src/fixtures/contextMenuTypes';
import type {} from '../../demo/runtime/src/fixtures/contextMenuTypes';
import { RUNTIME_DEMO_URL } from '../runtime/demoUrl';

async function state(page: Page, id: ContextMenuEditorId = 'primary') {
  return page.evaluate((id) => {
    const fixture = window.contextMenuReview;
    if (fixture?.ready !== true) throw new Error('Context menu fixture is not ready.');
    return fixture.inspect(id);
  }, id);
}

async function cellPoint(page: Page, rowId: string, frame: number, id: ContextMenuEditorId = 'primary') {
  await page.locator(`#${id} .jt-grid`).scrollIntoViewIfNeeded();
  return page.evaluate(({ id, rowId, frame }) => {
    const fixture = window.contextMenuReview;
    if (fixture?.ready !== true) throw new Error('Context menu fixture is not ready.');
    return fixture.cellPoint(id, rowId, frame);
  }, { id, rowId, frame });
}

async function cell(page: Page, rowId: string, frame: number, options: { right?: boolean; modifier?: 'Control' | 'Shift'; editor?: ContextMenuEditorId } = {}): Promise<void> {
  const point = await cellPoint(page, rowId, frame, options.editor);
  if (options.modifier !== undefined) await page.keyboard.down(options.modifier);
  try { await page.mouse.click(point.x, point.y, { button: options.right ? 'right' : 'left' }); }
  finally { if (options.modifier !== undefined) await page.keyboard.up(options.modifier); }
}

function row(page: Page, id: string, editor: ContextMenuEditorId = 'primary'): Locator {
  return page.locator(`#${editor} [data-row-id="${id}"] .jt-layer-row__name`);
}
const menu = (page: Page): Locator => page.getByRole('menu', { name: 'Actions de la timeline' });
const action = (page: Page, name: string): Locator => page.getByRole('menuitem', { name, exact: true });
const undo = (page: Page): Promise<void> => page.locator('#primary').getByRole('button', { name: 'Annuler', exact: true }).click();
const redo = (page: Page): Promise<void> => page.locator('#primary').getByRole('button', { name: 'Rétablir', exact: true }).click();

async function layer(page: Page, id: string): Promise<ILayer> {
  const found = (await state(page)).document.layers.find((node) => node.id === id);
  if (found?.type !== 'layer') throw new Error(`Missing layer: ${id}`);
  return found;
}

test.describe('I1 context menus', () => {
  const pageProblems = new WeakMap<Page, string[]>();
  test.beforeEach(async ({ page }) => {
    const problems: string[] = [];
    pageProblems.set(page, problems);
    page.on('pageerror', (error) => problems.push(`${page.url()}: ${error.message}`));
    page.on('console', (message) => { if (message.type() === 'error' || message.type() === 'warning') problems.push(`${page.url()}: ${message.type()}: ${message.text()}`); });
    page.on('requestfailed', (request) => problems.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`));
    page.on('response', (response) => { if (response.status() >= 400) problems.push(`${response.status()} ${response.url()}`); });
    await page.goto(`${RUNTIME_DEMO_URL}/fixtures/context-menu.html`);
    await expect(page.locator('#primary .jt-grid')).toBeVisible();
    await page.waitForFunction(() => window.contextMenuReview?.ready === true);
  });
  test.afterEach(async ({ page }, testInfo) => {
    const problems = pageProblems.get(page) ?? [];
    await testInfo.attach('i1-browser-problems', { body: JSON.stringify(problems, null, 2), contentType: 'application/json' });
    if (testInfo.status !== testInfo.expectedStatus) await page.screenshot({ path: testInfo.outputPath('i1-failure.png'), fullPage: true });
    expect(problems).toEqual([]);
  });

  test('preserves selected cells and rows and selects outside targets before rendering', async ({ page }) => {
    const original = (await state(page)).document;
    await cell(page, 'target', 3);
    await cell(page, 'second', 4, { modifier: 'Control' });
    await cell(page, 'target', 3, { right: true });
    await expect(menu(page)).toBeVisible();
    expect((await state(page)).cells).toEqual([{ rowId: 'target', frame: 3 }, { rowId: 'second', frame: 4 }]);
    await page.keyboard.press('Escape');
    await cell(page, 'target', 7, { right: true });
    expect((await state(page)).cells).toEqual([{ rowId: 'target', frame: 7 }]);
    await page.keyboard.press('Escape');
    await row(page, 'target').click();
    await row(page, 'second').click({ modifiers: ['Control'] });
    await row(page, 'target').click({ button: 'right' });
    expect((await state(page)).layers).toEqual(['target', 'second']);
    await page.keyboard.press('Escape');
    await row(page, 'last').click({ button: 'right' });
    expect((await state(page)).layers).toEqual(['last']);
    expect(await state(page)).toMatchObject({ document: original, canUndo: false });
  });

  test('inserts F6/F7 keyframes with matching menu actions and actual stage undo/redo', async ({ page }) => {
    const original = (await state(page)).document;
    await cell(page, 'target', 3);
    await page.keyboard.press('F6');
    expect((await layer(page, 'target')).spans.map((span) => span.start)).toContain(3);
    await undo(page);
    await cell(page, 'target', 5, { right: true });
    await action(page, 'Insérer une image clé vide').click();
    expect((await layer(page, 'target')).spans.find((span) => span.start === 5)?.kind).toBe('blank');
    await cell(page, 'target', 5);
    await expect.poll(() => page.locator('#target-object').evaluate((element) => getComputedStyle(element).visibility)).toBe('hidden');
    await undo(page);
    expect((await state(page)).document).toEqual(original);
    await expect(page.locator('#target-object')).toBeVisible();
    await redo(page);
    await expect.poll(() => page.locator('#target-object').evaluate((element) => getComputedStyle(element).visibility)).toBe('hidden');
    await undo(page);
    await cell(page, 'target', 4);
    await page.keyboard.press('F7');
    expect((await layer(page, 'target')).spans.find((span) => span.start === 4)?.kind).toBe('blank');
  });

  test('creates motion tween, renders interpolation and removes it through shared delete routing', async ({ page }) => {
    const original = (await state(page)).document;
    await cell(page, 'target', 1);
    await cell(page, 'target', 9, { modifier: 'Control' });
    await cell(page, 'target', 1, { right: true });
    await action(page, 'Créer une interpolation de mouvement').click();
    expect((await layer(page, 'target')).spans[0].kind).toBe('tween');
    await cell(page, 'target', 3);
    // W1 interpolates the first span from frame 1 through frame 8.
    const expected = 120 * (3 - 1) / (8 - 1);
    await expect.poll(async () => (await state(page)).sample?.x).toBeCloseTo(expected, 4);
    await expect.poll(() => page.locator('#target-object').evaluate((element) => new DOMMatrixReadOnly(getComputedStyle(element).transform).m41)).toBeCloseTo(expected, 4);
    await cell(page, 'target', 3, { right: true });
    await action(page, "Supprimer l'interpolation").click();
    expect((await layer(page, 'target')).spans[0].kind).toBe('static');
    await undo(page);
    expect((await layer(page, 'target')).spans[0].kind).toBe('tween');
    await undo(page);
    expect((await state(page)).document).toEqual(original);
  });

  test('opens optional easing from the clicked tween, applies the preset and restores exact history', async ({ page }) => {
    await cell(page, 'target', 1);
    await cell(page, 'target', 9, { modifier: 'Control' });
    await cell(page, 'target', 1, { right: true });
    await action(page, 'Créer une interpolation de mouvement').click();
    await cell(page, 'target', 3);
    await cell(page, 'second', 3, { modifier: 'Control' });
    const before = await state(page);
    const originalTween = await layer(page, 'target');
    await cell(page, 'target', 3, { right: true });
    await action(page, 'Modifier l’accélération').click();
    await expect(menu(page)).toHaveCount(0);
    const dialog = page.getByRole('dialog', { name: 'Accélération de l’interpolation' });
    const preset = dialog.getByRole('combobox', { name: 'Préréglage' });
    await expect(preset).toBeFocused();
    expect((await state(page)).cells).toEqual(before.cells);
    await preset.selectOption('ease-in');
    await dialog.getByRole('button', { name: 'Appliquer', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('#primary .JsTimeLine')).toBeFocused();
    const changed = await state(page);
    expect((await layer(page, 'target')).spans[0].easing).toBe('ease-in');
    expect((await layer(page, 'target')).spans[0].tracks).toEqual(originalTween.spans[0].tracks);
    expect(changed.document.layers.slice(1)).toEqual(before.document.layers.slice(1));
    await expect.poll(async () => (await state(page)).sample?.x).toBeLessThan(Number(before.sample?.x));
    await expect.poll(() => page.locator('#target-object').evaluate((element) => new DOMMatrixReadOnly(getComputedStyle(element).transform).m41)).toBeCloseTo(Number(changed.sample?.x), 4);
    await undo(page);
    expect((await state(page)).document).toEqual(before.document);
    await redo(page);
    expect((await state(page)).document).toEqual(changed.document);
    await cell(page, 'target', 3, { right: true });
    await action(page, 'Modifier l’accélération').click();
    await preset.selectOption('ease-out');
    await dialog.getByRole('button', { name: 'Annuler', exact: true }).click();
    expect((await state(page)).document).toEqual(changed.document);
    await cell(page, 'target', 3, { right: true });
    await action(page, 'Modifier l’accélération').click();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    expect((await state(page)).document).toEqual(changed.document);
  });

  test('finds the preserved demo supports from the runtime index', async ({ page }) => {
    await page.goto(RUNTIME_DEMO_URL);
    for (const [name, href] of [
      ['API de propriétés', './fixtures/property-api.html'],
      ['clés de propriété et losanges', './fixtures/property-keyframes.html'],
      ['accélération des interpolations', './fixtures/easing.html'],
      ['menus contextuels', './fixtures/context-menu.html']
    ]) await expect(page.getByRole('link', { name, exact: true })).toHaveAttribute('href', href);
    await page.getByRole('link', { name: 'menus contextuels', exact: true }).click();
    await expect(page.locator('#primary .jt-grid')).toBeVisible();
    await page.waitForFunction(() => window.contextMenuReview?.ready === true);
    await row(page, 'target').click({ button: 'right' });
    await expect(menu(page)).toBeVisible();
  });

  test('distinguishes property, mixed and whole tween deletion with one-step undo', async ({ page }) => {
    const original = (await state(page)).document;
    await cell(page, 'motion', 6, { right: true });
    await action(page, "Supprimer l'image clé de propriété").click();
    expect((await layer(page, 'motion')).spans[0].tracks?.x?.map((keyframe) => keyframe.frame)).toEqual([1, 24]);
    expect((await layer(page, 'motion')).spans[0].kind).toBe('tween');
    await undo(page);
    expect((await state(page)).document).toEqual(original);
    await cell(page, 'motion', 6);
    await cell(page, 'second', 9, { modifier: 'Control' });
    await cell(page, 'motion', 6, { right: true });
    await action(page, "Supprimer l'image clé").click();
    expect((await layer(page, 'motion')).spans[0].tracks?.x?.map((keyframe) => keyframe.frame)).toEqual([1, 24]);
    expect((await layer(page, 'second')).spans).toHaveLength(1);
    await undo(page);
    expect((await state(page)).document).toEqual(original);
    await cell(page, 'motion', 3, { right: true });
    await action(page, "Supprimer l'interpolation").click();
    expect((await layer(page, 'motion')).spans[0].kind).toBe('static');
    await undo(page);
    expect((await state(page)).document).toEqual(original);
  });

  test('copies and pastes using the existing memory clipboard and undoes', async ({ page }) => {
    const original = (await state(page)).document;
    await cell(page, 'target', 1, { right: true });
    await expect(action(page, 'Coller les images')).toHaveAttribute('aria-disabled', 'true');
    await action(page, 'Copier les images').click();
    expect((await state(page)).clipboard).toBe(true);
    await cell(page, 'target', 5, { right: true });
    await action(page, 'Coller les images').click();
    expect((await layer(page, 'target')).spans.map((span) => span.start)).toContain(5);
    await undo(page);
    expect((await state(page)).document).toEqual(original);
  });

  test('creates, groups, renames and deletes layers through menus with undo', async ({ page }) => {
    const original = (await state(page)).document;
    await row(page, 'target').click({ button: 'right' });
    await action(page, 'Nouveau calque').click();
    expect((await state(page)).document.layers).toHaveLength(7);
    await undo(page);
    await row(page, 'target').click({ button: 'right' });
    await action(page, 'Nouveau dossier').click();
    expect((await state(page)).document.layers[0].type).toBe('folder');
    await undo(page);
    await row(page, 'target').click();
    await row(page, 'second').click({ modifiers: ['Control'] });
    await row(page, 'target').click({ button: 'right' });
    await action(page, 'Grouper la sélection').click();
    expect((await state(page)).document.layers[0]).toMatchObject({ type: 'folder', children: [{ id: 'target' }, { id: 'second' }] });
    await undo(page);
    await row(page, 'locked').click({ button: 'right' });
    await action(page, 'Renommer le calque').click();
    const input = page.locator('#primary').getByRole('textbox', { name: 'Nom du calque' });
    await expect(input).toBeFocused();
    await input.fill('Calque renommé');
    await input.press('Enter');
    await expect(row(page, 'locked')).toHaveText('Calque renommé');
    await row(page, 'locked').click({ button: 'right' });
    await action(page, 'Supprimer les calques sélectionnés').click();
    expect((await state(page)).document.layers.find((node) => node.id === 'locked')).toBeUndefined();
    await undo(page);
    await undo(page);
    expect((await state(page)).document).toEqual(original);
  });

  test('blocks image mutation on layer and ancestor locks without history', async ({ page }) => {
    const original = (await state(page)).document;
    for (const id of ['locked', 'child']) {
      await cell(page, id, 3, { right: true });
      const insert = action(page, 'Insérer une image clé');
      await expect(insert).toHaveAttribute('aria-disabled', 'true');
      await expect(insert).toHaveAttribute('aria-description', /verrouillé/);
      await insert.focus();
      await page.keyboard.press('Enter');
      await expect(menu(page)).toBeVisible();
      await page.keyboard.press('Escape');
      await page.keyboard.press('F6');
      expect(await state(page)).toMatchObject({ document: original, canUndo: false });
    }
  });

  test('changes other-layer visibility and locks as one undo entry per batch', async ({ page }) => {
    const original = (await state(page)).document;
    await row(page, 'target').click({ button: 'right' });
    await action(page, 'Masquer les autres calques').click();
    expect((await layer(page, 'second')).visible).toBe(false);
    expect((await layer(page, 'target')).visible).not.toBe(false);
    await undo(page);
    expect(await state(page)).toMatchObject({ document: original, canUndo: false });
    await row(page, 'target').click({ button: 'right' });
    await action(page, 'Verrouiller les autres calques').click();
    expect((await layer(page, 'second')).locked).toBe(true);
    await undo(page);
    expect(await state(page)).toMatchObject({ document: original, canUndo: false });
    await row(page, 'target').click({ button: 'right' });
    await action(page, 'Afficher les autres calques').click();
    expect((await layer(page, 'last')).visible).toBe(true);
    await undo(page);
    expect(await state(page)).toMatchObject({ document: original, canUndo: false });
  });

  test('protects a selected child and folder subtree from other-layer flags with exact undo', async ({ page }) => {
    const initial = (await state(page)).document;
    await row(page, 'folder').click({ button: 'right' });
    await action(page, 'Déverrouiller le calque').click();
    const before = (await state(page)).document;
    const folderBefore = before.layers.find((node) => node.id === 'folder');
    for (const selected of ['child', 'folder']) {
      for (const label of ['Masquer les autres calques', 'Verrouiller les autres calques']) {
        await row(page, selected).click({ button: 'right' });
        await action(page, label).click();
        expect((await state(page)).document.layers.find((node) => node.id === 'folder')).toEqual(folderBefore);
        await expect(page.locator('#child-object')).toBeVisible();
        const flag = label.startsWith('Masquer') ? 'visible' : 'locked';
        expect((await layer(page, 'second'))[flag]).toBe(flag === 'locked');
        if (selected === 'child') {
          await cell(page, 'child', 3, { right: true });
          await expect(action(page, 'Insérer une image clé')).not.toHaveAttribute('aria-disabled', 'true');
          await action(page, 'Insérer une image clé').click();
          const folderAfter = (await state(page)).document.layers.find((node) => node.id === 'folder');
          expect(folderAfter).toMatchObject({ children: [{ id: 'child', spans: expect.arrayContaining([expect.objectContaining({ start: 3 })]) }] });
          await undo(page);
        }
        await undo(page); // Each other-layer flag batch is exactly one entry.
        expect((await state(page)).document).toEqual(before);
      }
    }
    await undo(page); // Only the explicit initial unlock remains.
    expect(await state(page)).toMatchObject({ document: initial, canUndo: false });
  });

  test('keeps native input menus and keyboard focus, then dismisses outside and on scroll', async ({ page }) => {
    await row(page, 'target').click({ button: 'right' });
    await action(page, 'Renommer le calque').click();
    const input = page.locator('#primary').getByRole('textbox', { name: 'Nom du calque' });
    await input.click({ button: 'right' });
    await expect(menu(page)).toHaveCount(0);
    await input.press('Escape');
    await row(page, 'target').click();
    await page.keyboard.press('Shift+F10');
    await expect(menu(page)).toBeVisible();
    await expect(action(page, 'Nouveau calque')).toBeFocused();
    await page.keyboard.press('End');
    await expect(action(page, 'Verrouiller les autres calques')).toBeFocused();
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowDown');
    await expect(action(page, 'Nouveau dossier')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('#primary .jt-layer-row[data-row-id="target"]')).toBeFocused();
    await row(page, 'target').click({ button: 'right' });
    await page.locator('#native-input').click();
    await expect(menu(page)).toHaveCount(0);
    await expect(page.locator('#native-input')).toBeFocused();
    await cell(page, 'target', 4);
    await page.keyboard.press('Shift+F10');
    await expect(menu(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#primary .JsTimeLine')).toBeFocused();
    await row(page, 'target').click({ button: 'right' });
    await page.mouse.wheel(0, 120);
    await expect(menu(page)).toHaveCount(0);
  });

  test('isolates two editors and tears down an open menu when its editor is destroyed', async ({ page }) => {
    const secondaryOriginal = (await state(page, 'secondary')).document;
    await row(page, 'target').click({ button: 'right' });
    await expect(action(page, 'Insérer une image clé')).toHaveCount(0);
    await row(page, 'second', 'secondary').click({ button: 'right' });
    await expect(menu(page)).toHaveCount(1);
    await action(page, 'Nouveau calque').click();
    expect((await state(page, 'secondary')).document.layers).toHaveLength(7);
    expect((await state(page)).document).toEqual(secondaryOriginal);
    await row(page, 'target').click({ button: 'right' });
    await page.locator('#destroy').click();
    await expect(menu(page)).toHaveCount(0);
    await expect(page.locator('#primary .JsTimeLine')).toHaveCount(0);
    await page.locator('#outside').click();
    await expect(page.locator('#outside')).toBeFocused();
  });

  for (const width of [320, 768, 1024, 1440]) {
    test(`keeps the menu inside the ${width}px viewport`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await row(page, 'target').click({ button: 'right', position: { x: 3, y: 3 } });
      await expect(menu(page)).toBeVisible();
      let rect = await menu(page).boundingBox();
      expect(rect).not.toBeNull();
      expect(rect!.x).toBeGreaterThanOrEqual(0);
      expect(rect!.x + rect!.width).toBeLessThanOrEqual(width);
      expect(rect!.y + rect!.height).toBeLessThanOrEqual(900);
      await page.screenshot({ path: test.info().outputPath(`i1-menu-${width}.png`) });
      await expect(menu(page)).toBeVisible();
      await page.keyboard.press('Escape');
      if (width >= 768) {
        // A supported cell near the bottom/right edge exercises both clamps.
        await cell(page, 'last', 24, { right: true });
        rect = await menu(page).boundingBox();
        expect(rect).not.toBeNull();
        expect(rect!.x + rect!.width).toBeLessThanOrEqual(width);
        expect(rect!.y + rect!.height).toBeLessThanOrEqual(900);
      }
    });
  }
});
