// e2e/validation/property-keyframes.spec.ts
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import type { IPropertyKeyframesFixture } from '../../demo/runtime/src/fixtures/propertyKeyframesTypes';
import { RUNTIME_DEMO_URL } from '../runtime/demoUrl';

const URL = `${RUNTIME_DEMO_URL}/fixtures/property-keyframes.html`;

function diamond(page: Page, layerId: string, frame: number): Locator {
  return page.locator(`#keyframes-editor .jt-grid__row[data-row-id="${layerId}"] .jt-grid__mark--propertyKeyframe[data-frame="${frame}"]`);
}

async function seek(page: Page, frame: number): Promise<void> {
  await page.evaluate(async (requested) => {
    if (window.propertyKeyframes === undefined) throw new Error('Fixture de clés de propriété indisponible.');
    await window.propertyKeyframes.seek(requested);
  }, frame);
}

test.describe('property keyframes through the public API and headless service', () => {
  let problems: string[];
  test.beforeEach(async ({ page }) => {
    const pageProblems: string[] = [];
    problems = pageProblems;
    page.on('pageerror', (error) => pageProblems.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') pageProblems.push(message.text() + ' ' + message.location().url);
    });
    page.on('requestfailed', (request) => pageProblems.push(request.url() + ' ' + request.failure()?.errorText));
    await page.goto(URL);
    await page.waitForFunction(() => window.propertyKeyframes?.ready === true);
  });
  test.afterEach(async ({ page }, testInfo) => {
    await page.screenshot({ path: testInfo.outputPath('property-keyframes.png'), fullPage: true });
    expect(problems).toEqual([]);
  });

  test('renders one real diamond for two property keys at the same frame and restores it with undo/redo', async ({ page }) => {
    const before = await page.evaluate(() => window.propertyKeyframes?.metrics.htmlRenders ?? 0);
    await expect(diamond(page, 'logo', 6)).toHaveCount(0);
    await page.getByRole('button', { name: 'Écrire via le service', exact: true }).click();
    await expect(page.locator('#keyframes-status')).toHaveText('Propriété enregistrée.');
    await expect(diamond(page, 'logo', 6)).toBeVisible();
    const paint = await diamond(page, 'logo', 6).evaluate((node) => {
      const style = getComputedStyle(node, '::before');
      const matrix = new DOMMatrix(style.transform);
      return { width: style.width, height: style.height, a: matrix.a, b: matrix.b, background: style.backgroundColor };
    });
    expect(paint.width).toBe('6px');
    expect(paint.height).toBe('6px');
    expect(paint.a).toBeCloseTo(Math.SQRT1_2);
    expect(paint.b).toBeCloseTo(Math.SQRT1_2);
    expect(paint.background).not.toBe('rgba(0, 0, 0, 0)');
    const edited = await page.evaluate(() => {
      const { editor } = window.propertyKeyframes as IPropertyKeyframesFixture;
      const previous = editor.document.layers[0];
      if (previous.type !== 'layer') throw new Error('Calque absent.');
      const changed = editor.setProperty('logo', 'y', 20, { frame: 6 });
      const current = editor.document.layers[0];
      if (current.type !== 'layer') throw new Error('Calque absent.');
      return { changed, sameX: current.spans[0].tracks?.x === previous.spans[0].tracks?.x,
        spans: current.spans.map(({ id, kind, start, end, easing }) => ({ id, kind, start, end, easing })),
        keys: current.spans[0].tracks, totalFrames: editor.document.settings.totalFrames };
    });
    expect(edited).toEqual({ changed: true, sameX: true, totalFrames: 20,
      spans: [
        { id: 'motion', kind: 'tween', start: 1, end: 11, easing: 'linear' },
        { id: 'blank', kind: 'blank', start: 12, end: 14, easing: undefined },
        { id: 'last', kind: 'static', start: 15, end: 20, easing: undefined }
      ],
      keys: { x: [{ frame: 1, value: 0 }, { frame: 6, value: 75 }, { frame: 11, value: 100 }],
        y: [{ frame: 1, value: 0 }, { frame: 6, value: 20 }, { frame: 11, value: 10 }] }
    });
    await expect(diamond(page, 'logo', 6)).toHaveCount(1);
    await seek(page, 6);
    const rendered = await page.locator('#keyframes-logo').evaluate((node) => {
      const matrix = new DOMMatrix(getComputedStyle(node).transform);
      return { x: matrix.m41, y: matrix.m42 };
    });
    expect(rendered).toEqual({ x: 75, y: 20 });
    expect(await page.evaluate(() => window.propertyKeyframes?.metrics.htmlRenders ?? 0)).toBeGreaterThan(before);
    expect(await page.evaluate(() => window.propertyKeyframes?.editor.undo())).toBe(true);
    await expect(diamond(page, 'logo', 6)).toHaveCount(1);
    expect(await page.evaluate(() => window.propertyKeyframes?.editor.undo())).toBe(true);
    await expect(diamond(page, 'logo', 6)).toHaveCount(0);
    expect(await page.evaluate(() => window.propertyKeyframes?.editor.redo())).toBe(true);
    expect(await page.evaluate(() => window.propertyKeyframes?.editor.redo())).toBe(true);
    await expect(diamond(page, 'logo', 6)).toHaveCount(1);
    expect(await page.evaluate(() => window.propertyKeyframes?.editor.sample(6).layer('logo')?.values)).toEqual({ x: 75, y: 20 });
  });

  test('leaves identical-key history unchanged and keeps static content static', async ({ page }) => {
    await page.getByRole('button', { name: 'Écrire via le service', exact: true }).click();
    await page.getByRole('button', { name: 'Écrire via le service', exact: true }).click();
    await expect(page.locator('#keyframes-status')).toHaveText('Valeur identique : aucune modification.');
    expect(await page.evaluate(() => window.propertyKeyframes?.changes)).toEqual(['execute']);
    await page.getByRole('combobox', { name: 'Calque', exact: true }).selectOption('still');
    await page.getByRole('spinbutton', { name: 'Valeur', exact: true }).fill('42');
    await page.getByRole('spinbutton', { name: 'Image', exact: true }).fill('8');
    await page.getByRole('button', { name: 'Écrire via l’API', exact: true }).click();
    const spans = await page.evaluate(() => {
      const node = window.propertyKeyframes?.editor.document.layers[1];
      return node?.type === 'layer' ? node.spans : [];
    });
    expect(spans).toEqual([{ id: 'still-span', kind: 'static', start: 1, end: 20, tracks: { x: [{ frame: 1, value: 42 }] } }]);
    await expect(diamond(page, 'still', 8)).toHaveCount(0);
    await seek(page, 8);
    expect(await page.locator('#keyframes-still').evaluate((node) => new DOMMatrix(getComputedStyle(node).transform).m41)).toBe(42);
  });

  test('rereads routed permissions, renders the real object and keeps refused redo retryable', async ({ page }) => {
    const result = await page.evaluate(() => {
      const fixture = window.propertyKeyframes as IPropertyKeyframesFixture;
      const { editor, service } = fixture;
      const properties = service.propertiesFor('object').map(({ name }) => name);
      const denied = service.setProperty('object', 'x', 10, { frame: 6 });
      const allowed = service.setProperty('object', 'volume', 0.7, { frame: 6 });
      const undo = editor.undo();
      const before = editor.document;
      fixture.setObjectProperties([]);
      const empty = service.propertiesFor('object');
      const refusedRedo = editor.redo();
      const atomic = editor.document === before && editor.canRedo && !editor.canUndo;
      fixture.setObjectProperties(['volume']);
      const redo = editor.redo();
      return { properties, denied, allowed, undo, empty, refusedRedo, atomic, redo };
    });
    expect(result).toEqual({ properties: ['volume'], denied: false, allowed: true, undo: true, empty: [], refusedRedo: false, atomic: true, redo: true });
    await seek(page, 6);
    await expect(diamond(page, 'object', 6)).toBeVisible();
    await expect(page.locator('#keyframes-volume')).toHaveText('0.7');
    expect(await page.evaluate(() => window.propertyKeyframes?.object.volume)).toBe(0.7);
    expect(await page.evaluate(() => window.propertyKeyframes?.metrics.objectRenders ?? 0)).toBeGreaterThan(0);
  });

  test('refuses ancestor locks, blank content and invalid input without new diamonds or history', async ({ page }) => {
    await page.getByRole('combobox', { name: 'Calque', exact: true }).selectOption('locked');
    await page.getByRole('button', { name: 'Écrire via le service', exact: true }).click();
    await expect(page.locator('#keyframes-status')).toContainText('verrouillé');
    const result = await page.evaluate(() => {
      const { editor, service, refusals } = window.propertyKeyframes as IPropertyKeyframesFixture;
      const before = editor.document;
      const results = [
        service.setProperty('logo', 'x', 10, { frame: 12 }),
        editor.setProperty('logo', 'x', 10, { frame: 21 }),
        service.setProperty('logo', 'x', Infinity, { frame: 6 })
      ];
      return { results, unchanged: before === editor.document, canUndo: editor.canUndo, refusals: refusals.length };
    });
    expect(result).toEqual({ results: [false, false, false], unchanged: true, canUndo: false, refusals: 4 });
    await expect(diamond(page, 'logo', 6)).toHaveCount(0);
    await expect(diamond(page, 'locked', 6)).toHaveCount(0);
  });

  test('supports keyboard activation and the real editor undo/redo shortcuts', async ({ page }) => {
    const api = page.getByRole('button', { name: 'Écrire via l’API', exact: true });
    await api.focus();
    await expect(api).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(diamond(page, 'logo', 6)).toBeVisible();
    const head = page.getByRole('slider', { name: 'Tête de lecture', exact: true });
    await head.focus();
    await page.keyboard.press('Control+z');
    await expect(diamond(page, 'logo', 6)).toHaveCount(0);
    await page.keyboard.press('Control+y');
    await expect(diamond(page, 'logo', 6)).toBeVisible();
    await expect(head).toBeFocused();
  });

  test('keeps persisted pages active and rejects retained service handles after final pagehide', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { editor, service } = window.propertyKeyframes as IPropertyKeyframesFixture;
      window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
      const persistedEdit = service.setProperty('logo', 'x', 75, { frame: 6 });
      window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false }));
      let queryRefused = false;
      let editRefused = false;
      try { service.propertiesFor('logo'); } catch { queryRefused = true; }
      try { service.setProperty('logo', 'x', 5); } catch { editRefused = true; }
      return { persistedEdit, destroyed: editor.isDestroyed, queryRefused, editRefused };
    });
    expect(result).toEqual({ persistedEdit: true, destroyed: true, queryRefused: true, editRefused: true });
  });
});
