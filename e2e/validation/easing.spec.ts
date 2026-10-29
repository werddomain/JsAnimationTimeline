// e2e/validation/easing.spec.ts
/** W3 browser evidence: real default plugins, commands, stage and keyboard dialog. */
import path from 'node:path';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { Easing } from '@kazo-ca/timeline-runtime';
import type {} from '../../demo/runtime/src/fixtures/easing';
import { RUNTIME_DEMO_URL } from '../runtime/demoUrl';

const problems = new WeakMap<Page, string[]>();
const artifacts = process.env.E2E_VALIDATION_ARTIFACT_DIR;
function artifactPath(name: string): string { return artifacts === undefined ? test.info().outputPath(name) : path.join(artifacts, name); }

test.beforeEach(async ({ page }) => {
  const collected: string[] = []; problems.set(page, collected);
  page.on('pageerror', (error) => collected.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error' || message.type() === 'warning') collected.push(`${message.type()}: ${message.text()}`); });
  page.on('requestfailed', (request) => collected.push(`requestfailed: ${request.url()} ${request.failure()?.errorText}`));
  await page.goto(`${RUNTIME_DEMO_URL}/fixtures/easing.html`);
  await page.waitForFunction(() => window.easingFixture?.ready === true);
});

test.afterEach(async ({ page }) => { expect(problems.get(page)).toEqual([]); });

async function snapshot(page: Page) {
  return page.evaluate(() => {
    const fixture = window.easingFixture;
    if (fixture === undefined) throw new Error('Missing W3 fixture');
    const editor = fixture.editor;
    const layer = editor.document.layers[0];
    if (layer.type !== 'layer') throw new Error('Missing animated layer');
    const object = document.getElementById('easing-object');
    if (object === null) throw new Error('Missing stage object');
    return { document: editor.document, easing: layer.spans[0].easing, tracks: layer.spans[0].tracks,
      values: [1, 6, 11].map((frame) => editor.sample(frame).layers[0].values),
      drawn: { x: new DOMMatrix(getComputedStyle(object).transform).m41, opacity: Number(getComputedStyle(object).opacity) },
      undo: editor.canUndo, redo: editor.canRedo };
  });
}

test('applies a keyboard preset, preserves tracks/endpoints and restores exact history', async ({ page }) => {
  const before = await snapshot(page);
  await page.getByRole('button', { name: 'Modifier l’accélération' }).click();
  const select = page.getByRole('combobox', { name: 'Préréglage' });
  await expect(select).toBeFocused();
  await page.keyboard.press('Home'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(async () => (await snapshot(page)).easing).toBe('ease-in');
  const after = await snapshot(page);
  await test.info().attach('w3-easing-samples.json', { body: Buffer.from(JSON.stringify({ before, after }, null, 2)), contentType: 'application/json' });
  expect(after.tracks).toEqual(before.tracks);
  expect(after.values[0]).toEqual(before.values[0]); expect(after.values[2]).toEqual(before.values[2]);
  expect(after.values[1].x).toBeLessThan(before.values[1].x);
  await expect.poll(async () => (await snapshot(page)).drawn.x).toBeCloseTo(after.values[1].x, 3);
  expect((await snapshot(page)).drawn.opacity).toBeCloseTo(after.values[1].opacity, 3);
  await page.getByRole('button', { name: 'Annuler la modification', exact: true }).click();
  expect((await snapshot(page)).document).toEqual(before.document);
  await page.getByRole('button', { name: 'Rétablir la modification', exact: true }).click();
  expect((await snapshot(page)).document).toEqual(after.document);
  await page.screenshot({ path: artifactPath('w3-applied.png'), fullPage: true });
});

test('cancel and Escape preserve the document and return focus', async ({ page }) => {
  const before = await snapshot(page);
  const trigger = page.getByRole('button', { name: 'Modifier l’accélération' });
  await trigger.click();
  await page.getByRole('combobox', { name: 'Préréglage' }).selectOption('ease-out');
  await page.getByRole('dialog').getByRole('button', { name: 'Annuler', exact: true }).click();
  await expect(trigger).toBeFocused(); expect((await snapshot(page)).document).toEqual(before.document);
  await trigger.click(); await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused(); expect((await snapshot(page)).undo).toBe(false);
});

test('revalidates a lock changed while open and refuses mutation', async ({ page }) => {
  await page.getByRole('button', { name: 'Modifier l’accélération' }).click();
  await page.getByRole('combobox', { name: 'Préréglage' }).selectOption('ease');
  await page.evaluate(() => window.easingFixture?.lock());
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await snapshot(page)).easing).toBeUndefined();
  const changed = await page.evaluate(() => window.easingFixture?.editor.getService('tweens.easing')?.setAt('easing-layer', 6, 'ease'));
  expect(changed).toBe(false);
});

for (const width of [320, 768, 1024, 1440]) {
  test(`accessible dialog fits ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole('button', { name: 'Modifier l’accélération' }).click();
    const dialog = page.getByRole('dialog', { name: 'Accélération de l’interpolation' });
    await expect(dialog).toBeVisible(); await expect(dialog).toHaveAttribute('aria-modal', 'true');
    const box = await dialog.boundingBox(); expect(box).not.toBeNull();
    if (box === null) throw new Error('Dialog has no bounds');
    expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(width);
    await page.keyboard.press('Shift+Tab'); await expect(page.getByRole('dialog').getByRole('button', { name: 'Annuler', exact: true })).toBeFocused();
    await page.keyboard.press('Tab'); await expect(page.getByRole('combobox', { name: 'Préréglage' })).toBeFocused();
    await page.screenshot({ path: artifactPath(`w3-dialog-${width}.png`), fullPage: true });
  });
}



test('preserves an imported custom curve until a preset is explicitly applied and supports exact undo', async ({ page }) => {
  const curve: Easing = 'cubic-bezier(0.2, 0.4, 0.6, 0.8)';
  await page.evaluate((easing: Easing) => {
    const fixture = window.easingFixture;
    if (fixture === undefined) throw new Error('Missing W3 fixture');
    const editor = fixture.editor;
    editor.load({ ...editor.document, layers: editor.document.layers.map((layer) => layer.type === 'layer'
      ? { ...layer, spans: layer.spans.map((span) => span.kind === 'tween' ? { ...span, easing } : span) }
      : layer) });
  }, curve);
  const before = await snapshot(page);
  const trigger = page.getByRole('button', { name: 'Modifier l’accélération' });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Accélération de l’interpolation' });
  const preset = dialog.getByRole('combobox', { name: 'Préréglage' });
  await expect(preset).toHaveValue('');
  await expect(dialog.getByText(`Courbe personnalisée : ${curve}`, { exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Appliquer', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  expect((await snapshot(page)).document).toEqual(before.document);
  expect((await snapshot(page)).undo).toBe(false);
  await trigger.click();
  await preset.selectOption('ease-out');
  await dialog.getByRole('button', { name: 'Appliquer', exact: true }).click();
  expect((await snapshot(page)).easing).toBe('ease-out');
  expect((await snapshot(page)).tracks).toEqual(before.tracks);
  await page.getByRole('button', { name: 'Annuler la modification', exact: true }).click();
  expect((await snapshot(page)).document).toEqual(before.document);
  expect((await snapshot(page)).easing).toBe(curve);
});

test('disposes a dialog invalidated by destruction during its initial browser focus', async ({ page }) => {
  const result = await page.evaluate(() => {
    const fixture = window.easingFixture;
    if (fixture === undefined) throw new Error('Missing W3 fixture');
    const { editor } = fixture;
    const service = editor.getService('tweens.easing');
    const trigger = document.getElementById('open-easing');
    if (service === undefined || trigger === null) throw new Error('Missing W3 controls');
    trigger.focus();
    let commands = 0;
    editor.on('command:before', () => { commands++; });
    const destroyOnFocus = (event: FocusEvent): void => {
      if (event.target instanceof HTMLSelectElement && event.target.closest('.jt-easing-dialog') !== null) editor.destroy();
    };
    document.addEventListener('focusin', destroyOnFocus);
    let opened: boolean;
    try { opened = service.openAt('easing-layer', 6); }
    finally { document.removeEventListener('focusin', destroyOnFocus); }
    return { opened, destroyed: editor.isDestroyed, commands,
      dialogs: document.querySelectorAll('.jt-easing-dialog').length,
      portals: document.querySelectorAll('.jt-easing-portal').length };
  });
  expect(result).toEqual({ opened: false, destroyed: true, commands: 0, dialogs: 0, portals: 0 });
  await expect(page.locator('#editor-host .JsTimeLine')).toHaveCount(0);
});

test('refuses a captured service while browser focus is restored during destruction', async ({ page }) => {
  const result = await page.evaluate(() => {
    const fixture = window.easingFixture;
    if (fixture === undefined) throw new Error('Missing W3 fixture');
    const { editor } = fixture;
    const service = editor.getService('tweens.easing');
    const trigger = document.getElementById('open-easing');
    if (service === undefined || trigger === null) throw new Error('Missing W3 controls');
    trigger.focus();
    const opened = service.openAt('easing-layer', 6);
    let commands = 0;
    let historyChanges = 0;
    let focusCalls = 0;
    let refusal: string | undefined;
    editor.on('command:before', () => { commands++; });
    editor.on('history:changed', () => { historyChanges++; });
    trigger.addEventListener('focus', () => {
      focusCalls++;
      try { service.openAt('easing-layer', 6); }
      catch (error) { refusal = error instanceof Error ? error.message : String(error); }
    }, { once: true });
    editor.destroy();
    return { opened, destroyed: editor.isDestroyed, commands, historyChanges, focusCalls, refusal,
      dialogs: document.querySelectorAll('.jt-easing-dialog').length,
      portals: document.querySelectorAll('.jt-easing-portal').length };
  });
  expect(result).toMatchObject({ opened: true, destroyed: true, commands: 0, historyChanges: 0, focusCalls: 1, dialogs: 0, portals: 0 });
  expect(result.refusal).toContain('tweens.easing: used before init or after destroy');
  await expect(page.locator('#editor-host .JsTimeLine')).toHaveCount(0);
});
