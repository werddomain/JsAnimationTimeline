// e2e/validation/property-api.spec.ts
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { IPropertyApiFixture } from '../../demo/runtime/src/fixtures/propertyApiTypes';
import { RUNTIME_DEMO_URL } from '../runtime/demoUrl';

const URL = `${RUNTIME_DEMO_URL}/fixtures/property-api.html`;

async function seek(page: Page, frame: number): Promise<void> {
  await page.evaluate(async (requested) => {
    if (window.propertyApi === undefined) throw new Error('Fixture de propriétés indisponible.');
    await window.propertyApi.seek(requested);
  }, frame);
}

test.describe('public setProperty contract without default plugins', () => {
  let problems: string[];
  test.beforeEach(async ({ page }) => {
    const pageProblems: string[] = [];
    problems = pageProblems;
    page.on('pageerror', (error) => pageProblems.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') pageProblems.push(message.text() + ' ' + message.location().url); });
    page.on('requestfailed', (request) => pageProblems.push(request.url() + ' ' + request.failure()?.errorText));
    await page.goto(URL);
    await page.waitForFunction(() => window.propertyApi?.ready === true);
  });
  test.afterEach(async ({ page }, testInfo) => {
    await page.screenshot({ path: testInfo.outputPath('property-api.png'), fullPage: true });
    expect(problems).toEqual([]);
  });

  test('inserts a single property key and renders public undo and redo on the real HTML stage', async ({ page }) => {
    const edited = await page.evaluate(() => {
      const { editor } = window.propertyApi as IPropertyApiFixture;
      const before = editor.document;
      const changed = editor.setProperty('logo', 'x', 75, { frame: 6 });
      const layer = editor.document.layers[0];
      const original = before.layers[0];
      if (layer.type !== 'layer' || original.type !== 'layer') throw new Error('Calque absent.');
      return {
        changed, spans: layer.spans.length, easing: layer.spans[0].easing,
        keys: layer.spans[0].tracks?.x, yUnchanged: layer.spans[0].tracks?.y === original.spans[0].tracks?.y,
        x: editor.sample(6).layer('logo')?.values.x,
        properties: editor.stage.describe({ selector: '#property-logo' })?.properties,
        frozen: Object.isFrozen(layer.spans[0].tracks?.x)
      };
    });
    expect(edited).toEqual({
      changed: true, spans: 3, easing: 'linear', yUnchanged: true, x: 75, properties: undefined, frozen: true,
      keys: [{ frame: 1, value: 0 }, { frame: 6, value: 75 }, { frame: 11, value: 100 }]
    });
    await seek(page, 6);
    const translation = (): Promise<number> => page.locator('#property-logo').evaluate((node) => new DOMMatrix(getComputedStyle(node).transform).m41);
    expect(await translation()).toBeCloseTo(75);
    expect(await page.evaluate(() => window.propertyApi?.editor.undo())).toBe(true);
    await seek(page, 6);
    expect(await translation()).toBeCloseTo(50);
    expect(await page.evaluate(() => window.propertyApi?.editor.sample(6).layer('logo')?.values.x)).toBe(50);
    expect(await page.evaluate(() => window.propertyApi?.editor.redo())).toBe(true);
    await seek(page, 6);
    expect(await translation()).toBeCloseTo(75);
  });

  test('uses the current integer frame, preserves identical-key history and writes static content at its start', async ({ page }) => {
    await seek(page, 6);
    const result = await page.evaluate(() => {
      const { editor, changes, refusals } = window.propertyApi as IPropertyApiFixture;
      const first = editor.setProperty('logo', 'x', 50);
      const changed = editor.document;
      const identical = editor.setProperty('logo', 'x', 50);
      const sameDocument = editor.document === changed;
      const still = editor.setProperty('still', 'x', 42, { frame: 8 });
      const layer = editor.document.layers[1];
      if (layer.type !== 'layer') throw new Error('Calque absent.');
      return { first, identical, sameDocument, still, spans: layer.spans, changes, refusals };
    });
    expect(result).toEqual({
      first: true, identical: false, sameDocument: true, still: true, changes: ['execute', 'execute'], refusals: [],
      spans: [{ id: 'still-content', start: 1, end: 20, kind: 'static', tracks: { x: [{ frame: 1, value: 42 }] } }]
    });
    await seek(page, 8);
    expect(await page.locator('#property-still').evaluate((node) => new DOMMatrix(getComputedStyle(node).transform).m41)).toBeCloseTo(42);
  });

  test('refuses invalid edits and inherited locks without changing document or history', async ({ page }) => {
    const result = await page.evaluate(() => {
      const { editor, refusals } = window.propertyApi as IPropertyApiFixture;
      const before = editor.document;
      const results = [
        editor.setProperty('logo', 'x', 3, { frame: 12 }),
        editor.setProperty('locked', 'x', 3), editor.setProperty('locked-folder', 'x', 3),
        editor.setProperty('missing', 'x', 3), editor.setProperty('logo', 'mystery', 3),
        editor.setProperty('logo', 'x', NaN), editor.setProperty('logo', 'x', 3, { frame: 21 }),
        editor.setProperty('logo', 'x', 3, { frame: 1.5 })
      ];
      return { results, refused: refusals.length, same: before === editor.document, canUndo: editor.canUndo };
    });
    expect(result).toEqual({ results: Array(8).fill(false), refused: 8, same: true, canUndo: false });
  });

  test('supports custom names without a stage and routed list metadata for an unscoped object on redo', async ({ page }) => {
    const result = await page.evaluate(() => {
      const fixture = window.propertyApi as IPropertyApiFixture;
      const { stageFree, objectEditor } = fixture;
      const inherited = stageFree.setProperty('object', 'toString', 7);
      const volume = stageFree.setProperty('object', 'volume', 0.4);
      const denied = objectEditor.setProperty('object', 'x', 10);
      const allowed = objectEditor.setProperty('object', 'volume', 0.7);
      const undo = objectEditor.undo();
      const before = objectEditor.document;
      fixture.setObjectProperties([]);
      const refusedRedo = objectEditor.redo();
      const atomic = before === objectEditor.document && objectEditor.canRedo;
      fixture.setObjectProperties(['volume']);
      const redo = objectEditor.redo();
      return {
        inherited, volume, denied, allowed, undo, refusedRedo, atomic, redo,
        values: stageFree.sample(1).layer('object')?.values
      };
    });
    expect(result).toEqual({
      inherited: true, volume: true, denied: false, allowed: true, undo: true, refusedRedo: false, atomic: true, redo: true,
      values: { toString: 7, volume: 0.4 }
    });
    await expect(page.locator('#property-volume')).toHaveText('0.7');
    expect(await page.evaluate(() => window.propertyApi?.object.volume)).toBe(0.7);
  });

  test('preserves a document and nested history loaded during stage metadata', async ({ page }) => {
    const result = await page.evaluate(() => {
      const fixture = window.propertyApi as IPropertyApiFixture;
      const { objectEditor } = fixture;
      const current = objectEditor.document;
      const loaded = { ...structuredClone(current), settings: { ...current.settings, fps: 12 } };
      const refusals: string[] = [];
      const changes: string[] = [];
      objectEditor.on('command:refused', ({ reason }) => refusals.push(reason));
      objectEditor.on('document:changed', ({ cause }) => changes.push(cause));
      fixture.loadObjectOnMetadata(loaded);
      const outer = objectEditor.setProperty('object', 'volume', 0.9);
      const after = objectEditor.document;
      const fps = after.settings.fps;
      const nestedValue = objectEditor.sample(1).layer('object')?.values.volume;
      const undo = objectEditor.undo();
      const restoredLoaded = JSON.stringify(objectEditor.document) === JSON.stringify(loaded);
      const extraUndo = objectEditor.undo();
      const redo = objectEditor.redo();
      const redoneValue = objectEditor.sample(1).layer('object')?.values.volume;
      return { outer, fps, nestedValue, undo, restoredLoaded, extraUndo, redo, redoneValue,
        refusals: refusals.length, changes };
    });
    expect(result).toEqual({ outer: false, fps: 12, nestedValue: 0.4, undo: true,
      restoredLoaded: true, extraUndo: false, redo: true, redoneValue: 0.4,
      refusals: 1, changes: ['execute', 'undo', 'redo'] });
  });

  test('keeps all fixture editors active across modeled persisted transitions and cleans up on final departure', async ({ page }) => {
    const result = await page.evaluate(() => {
      const fixture = window.propertyApi as IPropertyApiFixture;
      const original = fixture.editor.document;
      window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
      const changed = fixture.editor.setProperty('logo', 'x', 77, { frame: 6 });
      const undone = fixture.editor.undo();
      const restored = JSON.stringify(fixture.editor.document) === JSON.stringify(original);
      const stageFreeChanged = fixture.stageFree.setProperty('object', 'volume', 0.2);
      const objectChanged = fixture.objectEditor.setProperty('object', 'volume', 0.4);
      return { changed, undone, restored, stageFreeChanged, objectChanged };
    });
    expect(result).toEqual({ changed: true, undone: true, restored: true, stageFreeChanged: true, objectChanged: true });
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false })));
    for (const id of ['property-editor', 'property-stage-free', 'property-object-editor']) {
      await expect(page.locator(`#${id} > .JsTimeLine`)).toHaveCount(0);
    }
  });

});
