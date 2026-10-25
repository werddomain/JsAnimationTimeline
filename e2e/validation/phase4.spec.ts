// e2e/validation/phase4.spec.ts
/** Reusable phase-4 review through public editor services and real browser gestures. */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type {} from '../../demo/runtime/src/validation/phase4Types';
import { RUNTIME_DEMO_URL } from '../runtime/demoUrl';

async function state(page: Page) {
  return page.evaluate(() => {
    const review = window.phase4Review;
    if (review?.ready !== true) throw new Error('Phase 4 demo is not ready.');
    const editor = review.editor;
    return {
      document: editor.document,
      cells: editor.getService('frames.selection')?.cells(),
      clipboard: editor.getService('frames.clipboard')?.hasContent(),
      canUndo: editor.canUndo,
      canRedo: editor.canRedo
    };
  });
}

async function cellPoint(page: Page, rowId: string, frame: number) {
  return page.evaluate(({ rowId, frame }) => {
    const review = window.phase4Review;
    if (review?.ready !== true) throw new Error('Phase 4 demo is not ready.');
    const grid = review.editor.getService('frames.grid');
    const ruler = review.editor.getService('layout.ruler');
    const rect = grid?.element()?.getBoundingClientRect();
    const row = grid?.rows().find((candidate) => candidate.id === rowId);
    if (grid === undefined || ruler === undefined || rect === undefined || row === undefined) throw new Error('Grid is missing.');
    return { x: rect.left + ruler.frameLeft(frame) + grid.frameWidth() / 2, y: rect.top + row.index * grid.rowHeight() + grid.rowHeight() / 2 };
  }, { rowId, frame });
}

async function clickCell(page: Page, rowId: string, frame: number, modifier?: 'Control' | 'Shift'): Promise<void> {
  const point = await cellPoint(page, rowId, frame);
  if (modifier !== undefined) await page.keyboard.down(modifier);
  try { await page.mouse.click(point.x, point.y); }
  finally { if (modifier !== undefined) await page.keyboard.up(modifier); }
}

const undo = (page: Page): Promise<void> => page.getByRole('button', { name: 'Annuler', exact: true }).click();
const redo = (page: Page): Promise<void> => page.getByRole('button', { name: 'Rétablir', exact: true }).click();

async function targetSpans(page: Page) {
  const target = (await state(page)).document.layers.find((node) => node.id === 'target');
  if (target?.type !== 'layer') throw new Error('Target layer is missing.');
  return target.spans;
}

async function renderedTarget(page: Page, frame: number) {
  await page.evaluate((frame) => {
    const review = window.phase4Review;
    if (review?.ready !== true) throw new Error('Phase 4 demo is not ready.');
    review.editor.playback.seek(frame);
  }, frame);
  await expect.poll(() => page.evaluate(() => window.phase4Review?.ready ? window.phase4Review.editor.sample().time.integerFrame : 0)).toBe(frame);
  return page.evaluate(() => {
    const review = window.phase4Review;
    const target = document.getElementById('target-object');
    if (review?.ready !== true || target === null) throw new Error('Scene is missing.');
    const style = getComputedStyle(target);
    const sampled = review.editor.sample().layer('target');
    return { active: sampled?.active, x: sampled?.values.x, visibility: style.visibility, renderedX: new DOMMatrixReadOnly(style.transform).m41 };
  });
}

async function expectTarget(page: Page, frame: number, active: boolean, x?: number): Promise<void> {
  await expect.poll(async () => {
    const result = await renderedTarget(page, frame);
    return { active: result.active, visibility: result.visibility, ...(x === undefined ? {} : { x: result.x, renderedX: result.renderedX }) };
  }).toEqual({ active, visibility: active ? 'visible' : 'hidden', ...(x === undefined ? {} : { x, renderedX: x }) });
}

test.describe('preserved phase 4 validation demo', () => {
  let problems: string[];

  test.beforeEach(async ({ page }) => {
    problems = [];
    page.on('pageerror', (error) => problems.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') problems.push(message.text()); });
    await page.goto(`${RUNTIME_DEMO_URL}/validation-phase4.html`);
    await expect(page.locator('#editor-host .jt-shell')).toBeVisible();
    await page.waitForFunction(() => window.phase4Review?.ready === true);
  });

  test.afterEach(async ({ page }, testInfo) => {
    const screenshot = testInfo.outputPath('phase4-demo.png');
    await page.screenshot({ path: screenshot, fullPage: true });
    await testInfo.attach('phase4-demo', { path: screenshot, contentType: 'image/png' });
    expect(problems).toEqual([]);
  });

  test('selects with plain, Control and Shift clicks without adding history', async ({ page }) => {
    const original = (await state(page)).document;
    await clickCell(page, 'target', 2);
    expect((await state(page)).cells).toEqual([{ rowId: 'target', frame: 2 }]);
    await clickCell(page, 'target', 4, 'Control');
    expect((await state(page)).cells).toEqual([{ rowId: 'target', frame: 2 }, { rowId: 'target', frame: 4 }]);
    await clickCell(page, 'target', 6, 'Shift');
    expect((await state(page)).cells).toEqual([4, 5, 6].map((frame) => ({ rowId: 'target', frame })));
    expect(await state(page)).toMatchObject({ document: original, canUndo: false, canRedo: false });
    await expect(page.locator('#selection-status')).toContainText('3 images');
  });

  test('extends the document with F5 without reloading and undoes once', async ({ page }) => {
    const original = (await state(page)).document;
    let navigations = 0;
    page.on('framenavigated', (frame) => { if (frame === page.mainFrame()) navigations += 1; });
    await clickCell(page, 'target', 24);
    await page.keyboard.press('F5');
    expect((await state(page)).document.settings.totalFrames).toBe(25);
    const spans = await targetSpans(page);
    expect(spans[spans.length - 1]?.end).toBe(25);
    expect(navigations).toBe(0);
    await undo(page);
    expect((await state(page)).document).toEqual(original);
    expect((await state(page)).canUndo).toBe(false);
  });

  test('inserts a content keyframe with F6 and undoes once', async ({ page }) => {
    const original = (await state(page)).document;
    await clickCell(page, 'target', 11);
    await page.keyboard.press('F6');
    expect((await targetSpans(page)).find((span) => span.start === 11)).toMatchObject({ kind: 'static', end: 24 });
    await expectTarget(page, 11, true, 100);
    await undo(page);
    expect((await state(page)).document).toEqual(original);
    expect((await state(page)).canUndo).toBe(false);
  });

  test('inserts a blank with F7, hides the scene and restores it with undo', async ({ page }) => {
    const original = (await state(page)).document;
    await clickCell(page, 'target', 11);
    await page.keyboard.press('F7');
    expect((await targetSpans(page)).find((span) => span.start === 11)).toMatchObject({ kind: 'blank', end: 24 });
    await expectTarget(page, 11, false);
    await undo(page);
    expect((await state(page)).document).toEqual(original);
    await expectTarget(page, 11, true, 100);
  });

  test('drags an interior content keyframe horizontally and undoes once', async ({ page }) => {
    const original = (await state(page)).document;
    await clickCell(page, 'target', 5);
    const from = await cellPoint(page, 'target', 5);
    const to = await cellPoint(page, 'target', 7);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 6 });
    await page.mouse.up();
    expect((await targetSpans(page)).map((span) => span.start)).toEqual([1, 7, 9]);
    expect((await state(page)).cells).toEqual([{ rowId: 'target', frame: 7 }]);
    await expectTarget(page, 7, true, 100);
    await undo(page);
    expect((await state(page)).document).toEqual(original);
    expect((await state(page)).canUndo).toBe(false);
  });

  test('pastes blank frames with Control C/V while preserving the outgoing carried value', async ({ page }) => {
    const original = (await state(page)).document;
    await expectTarget(page, 1, true, 0);
    await expectTarget(page, 5, true, 100);
    await expectTarget(page, 9, true, 100);
    await clickCell(page, 'blank-source', 1);
    await clickCell(page, 'blank-source', 4, 'Shift');
    await page.keyboard.press('Control+c');
    expect((await state(page)).clipboard).toBe(true);
    expect((await state(page)).canUndo).toBe(false);
    await clickCell(page, 'target', 5);
    await page.keyboard.press('Control+v');
    const pasted = (await state(page)).document;
    expect((await targetSpans(page)).find((span) => span.start === 5)).toMatchObject({ kind: 'blank', end: 8 });
    for (const frame of [5, 8]) await expectTarget(page, frame, false);
    for (const frame of [9, 16, 24]) await expectTarget(page, frame, true, 100);
    await undo(page);
    expect((await state(page)).document).toEqual(original);
    expect((await state(page)).canUndo).toBe(false);
    await expectTarget(page, 5, true, 100);
    await redo(page);
    expect((await state(page)).document).toEqual(pasted);
    await expectTarget(page, 5, false);
    await expectTarget(page, 9, true, 100);
  });

  test('creates and removes a motion tween using demo buttons with undo and redo', async ({ page }) => {
    const original = (await state(page)).document;
    await clickCell(page, 'motion', 1);
    await clickCell(page, 'motion', 13, 'Control');
    await page.getByRole('button', { name: 'Créer l’interpolation', exact: true }).click();
    const created = (await state(page)).document;
    const motion = created.layers.find((node) => node.id === 'motion');
    expect(motion?.type === 'layer' ? motion.spans[0] : undefined).toMatchObject({ kind: 'tween', start: 1, end: 12 });
    expect(await page.evaluate(() => window.phase4Review?.ready ? window.phase4Review.editor.sample(6).layer('motion')?.values.x : undefined)).toBeGreaterThan(0);
    await undo(page);
    expect((await state(page)).document).toEqual(original);
    await redo(page);
    expect((await state(page)).document).toEqual(created);
    await page.getByRole('button', { name: 'Supprimer l’interpolation', exact: true }).click();
    const removed = (await state(page)).document;
    const removedMotion = removed.layers.find((node) => node.id === 'motion');
    expect(removedMotion?.type === 'layer' ? removedMotion.spans[0]?.kind : undefined).toBe('static');
    await undo(page);
    expect((await state(page)).document).toEqual(created);
    await redo(page);
    expect((await state(page)).document).toEqual(removed);
  });

  test('resets the document, selection, history, clipboard and review checklist', async ({ page }) => {
    const original = (await state(page)).document;
    await clickCell(page, 'target', 5);
    await page.keyboard.press('Control+c');
    await page.keyboard.press('F7');
    await page.locator('.checks input').first().check();
    await page.getByRole('button', { name: 'Réinitialiser le document', exact: true }).click();
    expect(await state(page)).toEqual({ document: original, cells: [], clipboard: false, canUndo: false, canRedo: false });
    await expect(page.locator('.checks input').first()).not.toBeChecked();
    await expectTarget(page, 1, true, 0);
  });
});
