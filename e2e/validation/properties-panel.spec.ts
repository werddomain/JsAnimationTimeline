// e2e/validation/properties-panel.spec.ts
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import type { IPropertiesPanelFixture } from '../../demo/runtime/src/fixtures/propertiesPanelTypes';
import { RUNTIME_DEMO_URL } from '../runtime/demoUrl';

const URL = RUNTIME_DEMO_URL + '/fixtures/properties-panel.html';
const errors = new WeakMap<Page, string[]>();
function panel(page: Page, host = 'panel-editor'): Locator { return page.locator('#' + host + ' .jt-properties-panel'); }
function field(page: Page, name = 'x', host = 'panel-editor'): Locator {
  return panel(page, host).locator('[data-property="' + name + '"] input');
}
function diamond(page: Page, layer = 'logo', frame = 6): Locator {
  return page.locator('#panel-editor .jt-grid__row[data-row-id="' + layer + '"] .jt-grid__mark--propertyKeyframe[data-frame="' + frame + '"]');
}
async function focus(page: Page, layer = 'logo', frame = 6): Promise<void> {
  expect(await page.evaluate(({ layer, frame }) => window.propertiesPanel?.service.focusAt(layer, frame), { layer, frame })).toBe(true);
}
async function seek(page: Page, frame: number): Promise<void> {
  await page.evaluate(async (frame) => { await window.propertiesPanel?.seek(frame); }, frame);
}

test.beforeEach(async ({ page }) => {
  const problems: string[] = [];
  errors.set(page, problems);
  page.on('pageerror', (error) => problems.push('pageerror: ' + error.message));
  page.on('console', (message) => {
    if (message.type() === 'warning' || message.type() === 'error') problems.push(message.type() + ': ' + message.text() + ' ' + message.location().url);
  });
  page.on('requestfailed', (request) => problems.push('requestfailed: ' + request.url() + ' ' + request.failure()?.errorText));
  await page.goto(URL);
  await page.waitForFunction(() => window.propertiesPanel?.ready === true);
});
test.afterEach(async ({ page }, info) => {
  await page.screenshot({ path: info.outputPath('properties-panel.png'), fullPage: true });
  expect(errors.get(page)).toEqual([]);
});

test('selects a real layer, samples the current frame, renders its edit and restores exact history', async ({ page }) => {
  await expect(panel(page)).toContainText('Sélectionnez un calque');
  await page.locator('#panel-editor .jt-layer-row[data-row-id="logo"] .jt-layer-row__name').click();
  await seek(page, 6);
  await expect(field(page)).toHaveValue('50');
  const before = await page.evaluate(() => window.propertiesPanel?.editor.toJSON());
  await field(page).fill('75');
  await panel(page).getByRole('button', { name: 'Appliquer Position X', exact: true }).click();
  await expect(diamond(page)).toBeVisible();
  await expect(field(page)).toHaveValue('75');
  await expect.poll(async () => page.locator('#panel-logo').evaluate((node) => new DOMMatrix(getComputedStyle(node).transform).m41)).toBe(75);
  const changed = await page.evaluate(() => window.propertiesPanel?.editor.toJSON());
  expect(await page.evaluate(() => window.propertiesPanel?.editor.undo())).toBe(true);
  await expect(diamond(page)).toHaveCount(0);
  expect(await page.evaluate(() => window.propertiesPanel?.editor.toJSON())).toEqual(before);
  expect(await page.evaluate(() => window.propertiesPanel?.editor.redo())).toBe(true);
  await expect(diamond(page)).toBeVisible();
  expect(await page.evaluate(() => window.propertiesPanel?.editor.toJSON())).toEqual(changed);
  expect(await page.evaluate(() => window.propertiesPanel?.metrics.htmlRenders)).toBeGreaterThan(0);
});

test('uses the actual toolbar target and frame while normal grid selection remains independent', async ({ page }) => {
  await focus(page, 'object', 6);
  await expect(field(page, 'volume')).toHaveValue('0.5');
  await page.evaluate(() => {
    window.propertiesPanel?.editor.getService('frames.selection')?.set([{ rowId: 'logo', frame: 11 }]);
  });
  await expect(panel(page)).toContainText('Objet audio · image 6');
  await page.locator('#panel-editor').getByRole('button', { name: "Modifier l'image clé", exact: true }).click();
  await expect(panel(page)).toContainText('Logo animé · image 11');
  await expect(field(page)).toHaveValue('100');
  await expect(field(page)).toBeFocused();
  expect(await page.evaluate(() => window.propertiesPanel?.editor.getService('layers.selection')?.selected())).toEqual(['logo']);
});

test('never writes on blur or untouched Enter; an explicit equal sample creates a key', async ({ page }) => {
  await focus(page);
  await field(page).press('Enter');
  await field(page).blur();
  expect(await page.evaluate(() => window.propertiesPanel?.editor.canUndo)).toBe(false);
  await field(page).fill('50');
  await field(page).blur();
  await expect(diamond(page)).toHaveCount(0);
  await field(page).press('Enter');
  await expect(diamond(page)).toBeVisible();
  expect(await page.evaluate(() => window.propertiesPanel?.changes)).toEqual(['execute']);
  await field(page).fill('50');
  await field(page).press('Enter');
  expect(await page.evaluate(() => window.propertiesPanel?.changes)).toEqual(['execute']);
  await field(page).fill('91');
  await field(page).press('Escape');
  await expect(field(page)).toHaveValue('50');
  await field(page).press('Enter');
  expect(await page.evaluate(() => window.propertiesPanel?.changes)).toEqual(['execute']);
});

test('filters custom object properties, uses defaults and rerenders real stage data', async ({ page }) => {
  await focus(page, 'object', 6);
  await expect(panel(page).locator('input')).toHaveCount(1);
  await expect(panel(page).getByLabel('Volume audio (dB)', { exact: true })).toHaveValue('0.5');
  await expect(panel(page)).toContainText('Valeur par défaut du registre');
  await field(page, 'volume').fill('0.75');
  await field(page, 'volume').press('Enter');
  await expect(diamond(page, 'object')).toBeVisible();
  await expect(page.locator('#panel-volume')).toHaveText('0.75');
  expect(await page.evaluate(() => window.propertiesPanel?.object.volume)).toBe(0.75);
  expect(await page.evaluate(() => window.propertiesPanel?.metrics.objectRenders)).toBeGreaterThan(0);
  await field(page, 'volume').fill('0.9');
  await page.evaluate(() => window.propertiesPanel?.setCapabilities([]));
  await expect(panel(page).locator('input')).toHaveCount(0);
  await expect(panel(page)).toContainText('Aucune propriété autorisée');
  await page.evaluate(() => window.propertiesPanel?.setCapabilities(['volume']));
  await expect(field(page, 'volume')).toHaveValue('0.75');
  await field(page, 'volume').press('Enter');
  expect(await page.evaluate(() => window.propertiesPanel?.changes)).toEqual(['execute']);
});

test('shows evaluated nonlinear values beside stored keys and never inverts easing', async ({ page }) => {
  await page.evaluate(() => window.propertiesPanel?.editor.getService('tweens.easing')?.setAt('logo', 6, 'ease-in'));
  await focus(page);
  const sampled = await page.evaluate(() => window.propertiesPanel?.editor.sample(6).layer('logo')?.values.x);
  expect(sampled).not.toBe(50);
  await expect(field(page)).toHaveValue(String(sampled));
  await field(page).fill('80');
  await field(page).press('Enter');
  const result = await page.evaluate(() => {
    const editor = (window.propertiesPanel as IPropertiesPanelFixture).editor;
    const layer = editor.document.layers[0];
    return { stored: layer.type === 'layer' ? layer.spans[0].tracks?.x[1].value : undefined,
      sample: editor.sample(6).layer('logo')?.values.x };
  });
  expect(result.stored).toBe(80);
  await expect(field(page)).toHaveValue(String(result.sample));
  await expect(panel(page)).toContainText('Clé enregistrée : 80.');
});

test('keeps static content static and rejects blank input without imposing numeric bounds', async ({ page }) => {
  await focus(page, 'still', 8);
  await field(page, 'opacity').fill('2');
  await field(page, 'opacity').press('Enter');
  const span = await page.evaluate(() => {
    const layer = window.propertiesPanel?.editor.document.layers[1];
    return layer?.type === 'layer' ? layer.spans[0] : undefined;
  });
  expect(span).toEqual({ id: 'still-span', kind: 'static', start: 1, end: 20,
    tracks: { x: [{ frame: 1, value: 5 }], opacity: [{ frame: 1, value: 2 }] } });
  await expect(field(page, 'opacity')).not.toHaveAttribute('min');
  await expect(field(page, 'opacity')).not.toHaveAttribute('max');
  await field(page).fill('');
  await field(page).press('Enter');
  await expect(field(page)).toHaveAttribute('aria-invalid', 'true');
  await expect(panel(page)).toContainText('nombre fini');
  expect(await page.evaluate(() => window.propertiesPanel?.changes)).toEqual(['execute']);
});

test('invalidates drafts on locks, selection, frame changes and document loads', async ({ page }) => {
  await focus(page);
  await field(page).fill('75');
  await seek(page, 7);
  await expect(field(page)).toHaveValue('60');
  await field(page).press('Enter');
  expect(await page.evaluate(() => window.propertiesPanel?.editor.canUndo)).toBe(false);
  await focus(page, 'locked', 6);
  await expect(field(page)).toBeDisabled();
  await expect(panel(page)).toContainText('verrouillé');
  await focus(page, 'logo', 12);
  await expect(field(page)).toBeDisabled();
  await expect(panel(page)).toContainText('Aucun contenu');
  await focus(page, 'logo', 20);
  await expect(field(page)).toBeDisabled();
  await focus(page);
  await field(page).fill('75');
  await page.evaluate(() => window.propertiesPanel?.editor.getService('layers.selection')?.select(['logo', 'still']));
  await expect(panel(page)).toContainText('un seul calque');
  await focus(page);
  await expect(field(page)).toHaveValue('50');
  await page.evaluate(() => {
    const editor = window.propertiesPanel?.editor;
    if (editor !== undefined) editor.load(JSON.parse(JSON.stringify(editor.toJSON())));
  });
  await expect(panel(page)).toContainText('Sélectionnez un calque');
  expect(await page.evaluate(() => window.propertiesPanel?.editor.canUndo)).toBe(false);
});

test('becomes readonly while playing and editable again on pause and natural completion', async ({ page }) => {
  await focus(page, 'still', 1);
  await page.evaluate(() => { const p = window.propertiesPanel?.editor.playback; if (p !== undefined) { p.speed = 0.01; p.play(); } });
  await expect(field(page)).toBeDisabled();
  await page.evaluate(() => window.propertiesPanel?.editor.playback.pause());
  await expect(field(page)).toBeEnabled();
  await page.evaluate(() => { const p = window.propertiesPanel?.editor.playback; if (p !== undefined) { p.seek(19); p.speed = 10; p.play(); } });
  await expect.poll(() => page.evaluate(() => window.propertiesPanel?.editor.playback.playing)).toBe(false);
  await expect(field(page)).toBeEnabled();
  await expect(panel(page)).toContainText('image 20');
});

test('supports real keyboard Apply and history shortcuts without losing focus on commit', async ({ page }) => {
  await focus(page);
  await expect(field(page)).toBeFocused();
  await field(page).fill('75');
  await page.keyboard.press('Tab');
  const apply = panel(page).getByRole('button', { name: 'Appliquer Position X', exact: true });
  await expect(apply).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(diamond(page)).toBeVisible();
  const head = page.locator('#panel-editor').getByRole('slider', { name: 'Tête de lecture', exact: true });
  await head.focus();
  await page.keyboard.press('Control+z');
  await expect(diamond(page)).toHaveCount(0);
  await page.keyboard.press('Control+y');
  await expect(diamond(page)).toBeVisible();
  await expect(head).toBeFocused();
  await field(page).focus();
  await field(page).fill('90');
  await field(page).press('Enter');
  await expect(field(page)).toBeFocused();
});

test('isolates editors and models persisted page transitions and final cleanup', async ({ page }) => {
  await focus(page);
  const result = await page.evaluate(() => {
    const fixture = window.propertiesPanel as IPropertiesPanelFixture;
    fixture.secondService.focusAt('logo', 8);
    const first = fixture.editor.container.querySelector<HTMLInputElement>('[data-property="x"] input');
    if (first === null) throw new Error('Missing field');
    first.value = '75'; first.dispatchEvent(new Event('input', { bubbles: true }));
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    const active = fixture.service.focusAt('logo', 7);
    fixture.editor.destroy();
    let refused = false;
    try { fixture.service.focusAt('logo', 6); } catch { refused = true; }
    const independent = fixture.secondService.focusAt('logo', 9);
    const unchanged = !fixture.secondary.canUndo;
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false }));
    let secondRefused = false;
    try { fixture.secondService.focusAt('logo', 6); } catch { secondRefused = true; }
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    return { active, refused, independent, unchanged, secondRefused,
      destroyed: fixture.editor.isDestroyed && fixture.secondary.isDestroyed };
  });
  expect(result).toEqual({ active: true, refused: true, independent: true, unchanged: true, secondRefused: true, destroyed: true });
});

for (const width of [320, 768, 1024, 1440]) {
  test('keeps the persistent panel visible and scrollable at ' + width + 'px', async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await focus(page);
    const geometry = await panel(page).evaluate((node) => {
      const root = node.parentElement;
      const shell = root?.querySelector('.jt-shell');
      const bounds = node.getBoundingClientRect();
      const shellBounds = shell?.getBoundingClientRect();
      return { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom,
        width: bounds.width, shellRight: shellBounds?.right ?? 0, shellBottom: shellBounds?.bottom ?? 0,
        clientHeight: node.clientHeight, scrollHeight: node.scrollHeight,
        pageWidth: document.documentElement.scrollWidth, viewportWidth: window.innerWidth };
    });
    expect(geometry.left).toBeGreaterThanOrEqual(0);
    expect(geometry.right).toBeLessThanOrEqual(width);
    expect(geometry.width).toBeGreaterThan(240);
    expect(geometry.pageWidth).toBeLessThanOrEqual(geometry.viewportWidth);
    if (width < 768) expect(geometry.top).toBeGreaterThanOrEqual(geometry.shellBottom - 1);
    else expect(geometry.left).toBeGreaterThanOrEqual(geometry.shellRight - 1);
    await page.screenshot({ path: info.outputPath('properties-panel-initial-' + width + '.png'), fullPage: true });
    await panel(page).locator('[data-property="opacity"] input').scrollIntoViewIfNeeded();
    await expect(field(page, 'opacity')).toBeVisible();
    await field(page, 'opacity').fill('0.6');
    await field(page, 'opacity').press('Enter');
    await expect(diamond(page)).toBeVisible();
    await page.screenshot({ path: info.outputPath('properties-panel-' + width + '.png'), fullPage: true });
  });
}

