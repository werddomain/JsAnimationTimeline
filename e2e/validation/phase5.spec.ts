// e2e/validation/phase5.spec.ts
/** Focused phase-5 review using public state, actual HTML draws and browser gestures. */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type {} from '../../demo/runtime/src/validation/phase5Types';
import { RUNTIME_DEMO_URL } from '../runtime/demoUrl';

async function state(page: Page) {
  return page.evaluate(() => {
    const review = window.phase5Review;
    if (review?.ready !== true) throw new Error('Phase 5 demo is not ready.');
    const editor = review.editor;
    return {
      document: editor.document, canUndo: editor.canUndo, canRedo: editor.canRedo,
      frame: editor.playback.frame, playing: editor.playback.playing,
      speed: editor.playback.speed, loop: editor.playback.loop,
      cells: editor.getService('frames.selection')?.cells(),
      mode: editor.getService('playback.livePreview')?.mode,
      maxFps: editor.getService('playback.livePreview')?.maxFps,
      layers: editor.getService('layers.selection')?.selected(),
      clipboard: editor.getService('frames.clipboard')?.hasContent(),
      scrollLeft: editor.getService('layout.scrollSync')?.getScroll().scrollLeft,
      zoom: editor.getService('layout.zoom')?.zoom(),
      metrics: { ...review.metrics }
    };
  });
}

async function point(page: Page, frame: number, rowId?: string) {
  return page.evaluate(({ frame, rowId }) => {
    const review = window.phase5Review;
    if (review?.ready !== true) throw new Error('Phase 5 demo is not ready.');
    const editor = review.editor;
    const grid = editor.getService('frames.grid');
    const ruler = editor.getService('layout.ruler');
    const row = grid?.rows().find((candidate) => candidate.id === rowId);
    const surface = rowId === undefined ? editor.getService('layout.shell')?.zone('ruler') : grid?.element();
    const rect = surface?.getBoundingClientRect();
    if (rect === undefined || ruler === undefined || grid === undefined) throw new Error('Timeline surface missing.');
    const scroll = editor.getService('layout.scrollSync')?.getScroll().scrollLeft ?? 0;
    return { x: rect.left + ruler.frameLeft(frame) + ruler.frameWidth() / 2 - scroll,
      y: rect.top + (rowId === undefined ? rect.height / 2 : (row?.index ?? 0) * grid.rowHeight() + grid.rowHeight() / 2) };
  }, { frame, rowId });
}

async function cell(page: Page, rowId: string, frame: number, modifier?: 'Control' | 'Shift'): Promise<void> {
  const at = await point(page, frame, rowId);
  if (modifier !== undefined) await page.keyboard.down(modifier);
  try { await page.mouse.click(at.x, at.y); }
  finally { if (modifier !== undefined) await page.keyboard.up(modifier); }
  await page.clock.runFor(20);
}

async function seek(page: Page, frame: number): Promise<void> {
  await page.evaluate((frame) => {
    if (window.phase5Review?.ready) window.phase5Review.editor.playback.seek(frame);
  }, frame);
  await page.clock.runFor(20);
}

async function scene(page: Page) {
  return page.evaluate(() => {
    const target = document.getElementById('motion-object');
    const hidden = document.getElementById('locked-object');
    if (target === null || hidden === null) throw new Error('Scene missing.');
    return { x: new DOMMatrixReadOnly(getComputedStyle(target).transform).m41,
      hidden: getComputedStyle(hidden).visibility };
  });
}

async function dragStart(page: Page, frame: number): Promise<void> {
  const at = await point(page, frame);
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
}

async function dragMove(page: Page, frame: number): Promise<void> {
  const at = await point(page, frame);
  await page.mouse.move(at.x, at.y);
}

const action = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const undo = async (page: Page): Promise<void> => { await action(page, 'Annuler').click(); await page.clock.runFor(20); };
const redo = async (page: Page): Promise<void> => { await action(page, 'Rétablir').click(); await page.clock.runFor(20); };
const preview = (page: Page) => page.getByRole('combobox', { name: 'Aperçu pendant le glisser', exact: true });

function spans(document: Awaited<ReturnType<typeof state>>['document'], id: string) {
  const layer = document.layers.find((node) => node.id === id);
  if (layer?.type !== 'layer') throw new Error(`Missing fixture layer: ${id}`);
  return layer.spans;
}

test.describe('reusable phase 5 validation demo', () => {
  let problems: string[];
  test.beforeEach(async ({ page }) => {
    const pageProblems: string[] = [];
    problems = pageProblems;
    page.on('pageerror', (error) => pageProblems.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') pageProblems.push(message.text() + ' ' + message.location().url); });
    page.on('requestfailed', (request) => pageProblems.push(request.url() + ' ' + request.failure()?.errorText));
    await page.clock.install();
    await page.goto(`${RUNTIME_DEMO_URL}/validation-phase5.html`);
    await expect(page.locator('#editor-host .jt-shell')).toBeVisible();
    await page.waitForFunction(() => window.phase5Review?.ready === true);
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
    await page.clock.runFor(20);
  });
  test.afterEach(async ({ page }, testInfo) => {
    const screenshot = testInfo.outputPath('phase5-demo.png');
    await page.screenshot({ path: screenshot, fullPage: true });
    await testInfo.attach('phase5-demo', { path: screenshot, contentType: 'image/png' });
    expect(problems).toEqual([]);
  });

  test('loads the real toolbar groups and visible draw metrics', async ({ page }, testInfo) => {
    for (const name of ['Actions des images clés', 'Lecture', 'Zoom de la règle']) {
      await expect(page.getByRole('group', { name, exact: true })).toBeVisible();
    }
    await expect(page.getByRole('spinbutton', { name: /Cadence/ })).toHaveValue('12');
    await expect(page.getByRole('spinbutton', { name: /Durée/ })).toHaveValue('24');
    expect((await state(page)).metrics).toMatchObject({ drawnFrame: 1 });
    expect((await state(page)).metrics.drawCount).toBeGreaterThan(0);
    await expect(page.locator('#draw-status')).toContainText('dessinée 1');
    expect(await scene(page)).toEqual({ x: 0, hidden: 'hidden' });
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.clock.runFor(20);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const screenshot = testInfo.outputPath(`phase5-${width}.png`);
      await page.screenshot({ path: screenshot, fullPage: true });
      await testInfo.attach(`phase5-${width}`, { path: screenshot, contentType: 'image/png' });
    }
  });

  test('explains unavailable empty and locked actions without changing history', async ({ page }) => {
    const original = (await state(page)).document;
    const insert = action(page, 'Ajouter une image clé');
    await expect(insert).toHaveAttribute('aria-disabled', 'true');
    await expect(insert).toHaveAttribute('title', /Ajouter une image clé.*Sélectionnez une image ou un calque/);
    // aria-disabled controls intentionally remain focusable and reject actual pointer activation.
    const insertBox = await insert.boundingBox();
    if (insertBox === null) throw new Error('Insert button missing.');
    await page.mouse.click(insertBox.x + insertBox.width / 2, insertBox.y + insertBox.height / 2);
    await cell(page, 'locked', 5);
    await expect(insert).toHaveAttribute('aria-disabled', 'true');
    await expect(insert).toHaveAttribute('title', /Ajouter une image clé.*verrouillé/);
    await insert.focus();
    await page.keyboard.press('Enter');
    expect(await state(page)).toMatchObject({ document: original, canUndo: false });
  });

  test('inserts and edits a content key through toolbar buttons with history controls', async ({ page }) => {
    const original = (await state(page)).document;
    await cell(page, 'content', 5);
    await action(page, 'Ajouter une image clé').click();
    const edited = (await state(page)).document;
    expect(spans(edited, 'content').map((span) => span.start)).toEqual([1, 5, 13]);
    await action(page, "Modifier l'image clé").click();
    await expect(page.locator('#edit-status')).toContainText('content · image 5 · contenu');
    expect((await state(page)).document).toEqual(edited);
    await undo(page);
    expect(await state(page)).toMatchObject({ document: original, canUndo: false });
    await redo(page);
    expect((await state(page)).document).toEqual(edited);
    await page.locator('#editor-host').click({ position: { x: 5, y: 250 } });
    await page.keyboard.press('Control+z');
    expect((await state(page)).document).toEqual(original);
    await page.keyboard.press('Control+y');
    expect((await state(page)).document).toEqual(edited);
  });

  test('deletes only the property key with its exact contextual label and restores it', async ({ page }) => {
    const original = (await state(page)).document;
    await cell(page, 'motion', 17);
    await expect(action(page, "Supprimer l'image clé de propriété")).toBeEnabled();
    await action(page, "Modifier l'image clé").click();
    await expect(page.locator('#edit-status')).toContainText('motion · image 17 · interpolation');
    await action(page, "Supprimer l'image clé de propriété").click();
    const edited = (await state(page)).document;
    expect(spans(edited, 'motion')[1]).toMatchObject({ kind: 'tween', tracks: { x: [{ frame: 13, value: 0 }, { frame: 24, value: 180 }] } });
    await seek(page, 17);
    expect((await scene(page)).x).toBeCloseTo(180 * 4 / 11, 3);
    await undo(page);
    expect((await state(page)).document).toEqual(original);
    await redo(page);
    expect((await state(page)).document).toEqual(edited);
  });

  test('preserves the existing CS4 span merge for mixed property and tween-start deletion', async ({ page }) => {
    const original = (await state(page)).document;
    await cell(page, 'motion', 13);
    await cell(page, 'motion', 17, 'Shift');
    const remove = action(page, "Supprimer l'image clé");
    await expect(remove).toHaveAttribute('title', /^Supprimer l'image clé \(.*F6\)$/);
    await remove.click();
    const edited = (await state(page)).document;
    expect(spans(edited, 'motion')).toEqual([{ id: 'motion-hold', start: 1, end: 24, kind: 'static' }]);
    await undo(page);
    expect(await state(page)).toMatchObject({ document: original, canUndo: false });
    await redo(page);
    expect((await state(page)).document).toEqual(edited);
  });

  test('creates and removes motion through the toolbar with exact document undo and redo', async ({ page }) => {
    const original = (await state(page)).document;
    await cell(page, 'content', 1);
    await cell(page, 'content', 13, 'Control');
    await action(page, 'Créer une interpolation de mouvement').click();
    const created = (await state(page)).document;
    expect(spans(created, 'content')[0]).toMatchObject({ kind: 'tween', start: 1, end: 12 });
    await seek(page, 6);
    const rendered = await page.evaluate(() => {
      const review = window.phase5Review;
      const target = document.getElementById('content-object');
      if (review?.ready !== true || target === null) throw new Error('Content scene missing.');
      return { sampled: review.editor.sample().layer('content')?.values.x,
        drawn: new DOMMatrixReadOnly(getComputedStyle(target).transform).m41 };
    });
    expect(rendered.drawn).toBeGreaterThan(0);
    expect(rendered.drawn).toBeLessThan(180);
    expect(rendered.drawn).toBeCloseTo(Number(rendered.sampled), 3);
    await undo(page);
    expect((await state(page)).document).toEqual(original);
    await redo(page);
    expect((await state(page)).document).toEqual(created);
    await cell(page, 'content', 6);
    await action(page, "Supprimer l'interpolation").click();
    const removed = (await state(page)).document;
    expect(spans(removed, 'content')[0]?.kind).toBe('static');
    await undo(page);
    expect((await state(page)).document).toEqual(created);
    await redo(page);
    expect((await state(page)).document).toEqual(removed);
  });

  test('edits cadence and duration, rejects a truncated span and restores fields with Escape', async ({ page }) => {
    const original = (await state(page)).document;
    const fps = page.getByRole('spinbutton', { name: /Cadence/ });
    const duration = page.getByRole('spinbutton', { name: /Durée/ });
    await fps.fill('24'); await fps.press('Enter');
    expect(await state(page)).toMatchObject({ document: { settings: { fps: 24 } }, playing: false });
    await duration.fill('30'); await duration.press('Tab');
    expect((await state(page)).document.settings.totalFrames).toBe(30);
    await undo(page); await expect(duration).toHaveValue('24');
    await undo(page); await expect(fps).toHaveValue('12');
    expect((await state(page)).document).toEqual(original);
    await duration.fill('20'); await duration.press('Enter');
    await expect(duration).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('.jt-timeSettings__message')).not.toBeEmpty();
    expect(await state(page)).toMatchObject({ document: original, canUndo: false, playing: false });
    await duration.press('Escape');
    await expect(duration).toHaveValue('24');
    await expect(duration).not.toHaveAttribute('aria-invalid', 'true');
  });

  test('synchronizes preset, keyboard range and fit zoom without document history', async ({ page }) => {
    const original = (await state(page)).document;
    const select = page.getByRole('combobox', { name: 'Niveau de zoom', exact: true });
    const slider = page.getByRole('slider', { name: 'Zoom continu', exact: true });
    await select.selectOption('2'); expect((await state(page)).zoom).toBe(2);
    await slider.focus(); await slider.press('Home');
    const min = (await state(page)).zoom;
    await slider.press('ArrowRight'); expect((await state(page)).zoom).toBeGreaterThan(min ?? 0);
    await slider.press('End'); expect((await state(page)).zoom).toBeGreaterThan(2);
    await select.selectOption('fit'); await page.clock.runFor(20);
    const geometry = await page.evaluate(() => {
      if (!window.phase5Review?.ready) throw new Error('Not ready');
      const editor = window.phase5Review.editor;
      return { grid: editor.getService('frames.grid')?.frameWidth(), ruler: editor.getService('layout.ruler')?.frameWidth(),
        viewport: editor.getService('layout.scrollSync')?.getScroll().viewportWidth };
    });
    expect(geometry.grid).toBe(geometry.ruler);
    expect((geometry.ruler ?? 0) * 24).toBeCloseTo(geometry.viewport ?? 0, 0);
    expect(await state(page)).toMatchObject({ document: original, canUndo: false, canRedo: false });
  });

  test('plays, pauses, changes speed, loops and completes while drawing the actual scene', async ({ page }) => {
    const original = (await state(page)).document;
    await seek(page, 13);
    await action(page, 'Lire').click(); await page.clock.runFor(250);
    expect((await state(page)).frame).toBeGreaterThan(13);
    expect((await scene(page)).x).toBeGreaterThan(0);
    await action(page, 'Pause').click(); await page.clock.runFor(20);
    const paused = (await state(page)).frame;
    await page.clock.runFor(250); expect((await state(page)).frame).toBe(paused);
    await page.getByRole('combobox', { name: 'Vitesse de lecture', exact: true }).selectOption('2');
    await seek(page, 13);
    await page.getByRole('slider', { name: 'Tête de lecture', exact: true }).focus();
    await page.keyboard.press('Enter'); await page.clock.runFor(250);
    expect((await state(page)).frame).toBeGreaterThanOrEqual(19);
    await page.keyboard.press('Enter');
    await action(page, 'Boucle').click(); await seek(page, 23);
    await action(page, 'Lire').click(); await page.clock.runFor(250);
    expect(await state(page)).toMatchObject({ playing: true, loop: true, speed: 2 });
    expect((await state(page)).frame).toBeLessThan(13);
    await action(page, 'Pause').click(); await action(page, 'Boucle').click(); await seek(page, 23);
    await action(page, 'Lire').click(); await page.clock.runFor(250);
    expect(await state(page)).toMatchObject({ playing: false, frame: 24, document: original, canUndo: false });
    expect((await scene(page)).x).toBeCloseTo(180, 3);
  });

  test('draws live scrubbing and keeps the hidden fixture hidden', async ({ page }) => {
    await dragStart(page, 13); await page.clock.runFor(20);
    const before = (await state(page)).metrics.drawCount;
    await dragMove(page, 17); await page.clock.runFor(20);
    expect((await state(page)).metrics).toMatchObject({ drawnFrame: 17 });
    expect((await state(page)).metrics.drawCount).toBeGreaterThan(before);
    expect(await scene(page)).toEqual({ x: 60, hidden: 'hidden' });
    await page.mouse.up(); await page.clock.runFor(20);
  });

  test('holds onRelease until pointer-up, draws once and lets arrows draw immediately', async ({ page }) => {
    await preview(page).selectOption('onRelease');
    const before = (await state(page)).metrics.drawCount;
    await dragStart(page, 13); await page.clock.runFor(20);
    await dragMove(page, 17); await page.clock.runFor(20);
    expect(await state(page)).toMatchObject({ frame: 17, metrics: { drawCount: before, drawnFrame: 1 } });
    expect((await scene(page)).x).toBe(0);
    await expect(page.locator('#draw-status')).toContainText('demandée 17 · dessinée 1');
    await page.mouse.up(); await page.clock.runFor(20);
    expect((await state(page)).metrics).toEqual({ drawCount: before + 1, drawnFrame: 17 });
    expect(await scene(page)).toEqual({ x: 60, hidden: 'hidden' });
    await page.getByRole('slider', { name: 'Tête de lecture', exact: true }).press('ArrowRight');
    await page.clock.runFor(20);
    expect((await state(page)).metrics.drawnFrame).toBe(18);
  });

  test('throttles actual draws with a trailing final draw and handles release before queued display', async ({ page }) => {
    const original = (await state(page)).document;
    await preview(page).selectOption('throttled');
    // Observe the first display timestamp so the pending timer can become due
    // before the final RAF, with one Playwright clock controlling both queues.
    const firstDisplay = page.evaluate(() => {
      const review = window.phase5Review;
      if (review?.ready !== true) throw new Error('Not ready.');
      return new Promise<number>((resolve) => {
        review.editor.once('frame:render', () => resolve(review.editor.playback.now()));
      });
    });
    await dragStart(page, 13); await page.clock.runFor(20);
    const firstAt = await firstDisplay;
    const first = (await state(page)).metrics.drawCount;
    await dragMove(page, 15); await page.clock.runFor(20);
    await dragMove(page, 16); await page.clock.runFor(20);
    expect((await state(page)).metrics.drawCount).toBe(first);
    await page.clock.runFor(100);
    expect((await state(page)).metrics).toEqual({ drawCount: first + 1, drawnFrame: 16 });
    // This evaluation queues a new trailing timer at firstAt + 200 ms.
    await dragMove(page, 17); await page.clock.runFor(20);
    const now = await page.evaluate(() => window.phase5Review?.ready ? window.phase5Review.editor.playback.now() : 0);
    await page.clock.runFor(firstAt + 199 - now);
    // Release with frame 18 still waiting for its display evaluation.
    await dragMove(page, 18); await page.mouse.up();
    expect((await state(page)).metrics).toEqual({ drawCount: first + 1, drawnFrame: 16 });
    await page.clock.runFor(2);
    expect((await state(page)).metrics).toEqual({ drawCount: first + 1, drawnFrame: 16 });
    await page.clock.runFor(20);
    expect((await state(page)).metrics).toEqual({ drawCount: first + 2, drawnFrame: 18 });
    expect((await scene(page)).x).toBeCloseTo(60 + 120 / 7, 3);
    expect((await scene(page)).hidden).toBe('hidden');
    await page.clock.runFor(150);
    expect((await state(page)).metrics.drawCount).toBe(first + 2);
    expect(await state(page)).toMatchObject({ document: original, canUndo: false });
  });

  test('resets all review state and preserves the modeled persisted-page lifecycle', async ({ page }) => {
    const original = (await state(page)).document;
    await cell(page, 'content', 5);
    await page.keyboard.press('Control+c');
    expect((await state(page)).clipboard).toBe(true);
    await action(page, 'Ajouter une image clé').click();
    await action(page, "Modifier l'image clé").click();
    await expect(page.locator('#edit-status')).toContainText('content · image 5');
    await preview(page).selectOption('onRelease');
    await page.evaluate(() => {
      if (!window.phase5Review?.ready) throw new Error('Not ready.');
      const editor = window.phase5Review.editor;
      editor.getService('playback.livePreview')?.setMaxFps(20);
      editor.getService('layers.selection')?.select(['locked']);
    });
    await page.getByRole('combobox', { name: 'Niveau de zoom', exact: true }).selectOption('2');
    await page.getByRole('combobox', { name: 'Vitesse de lecture', exact: true }).selectOption('2');
    await action(page, 'Boucle').click();
    await page.locator('.checks input').first().check();
    await page.evaluate(() => {
      window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    });
    await undo(page); expect((await state(page)).document).toEqual(original);
    await action(page, 'Réinitialiser la validation').click(); await page.clock.runFor(20);
    expect(await state(page)).toMatchObject({ document: original, cells: [], canUndo: false, canRedo: false,
      frame: 1, playing: false, speed: 1, loop: false, mode: 'live', maxFps: 10, zoom: 1,
      layers: [], clipboard: false, scrollLeft: 0, metrics: { drawnFrame: 1, drawCount: 1 } });
    await expect(page.locator('.checks input').first()).not.toBeChecked();
    await expect(page.locator('#edit-status')).toContainText('Aucune demande');
    await cell(page, 'content', 5); await action(page, 'Ajouter une image clé').click();
    expect((await state(page)).canUndo).toBe(true);
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false })));
    await expect(page.locator('#editor-host .jt-shell')).toHaveCount(0);
  });
});
