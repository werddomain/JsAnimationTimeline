// e2e/validation/phase3.spec.ts
/** Preserved phase-3 review checks: existing layout/layer behavior, including command undo. */
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import type {} from '../../demo/runtime/src/validation/phase3Types';
import { RUNTIME_DEMO_URL } from '../runtime/demoUrl';

const row = (page: Page, id: string): Locator => page.locator(`#editor-host .jt-layer-row[data-row-id="${id}"]`);
const undo = (page: Page): Promise<void> => page.getByRole('button', { name: 'Annuler', exact: true }).click();
const redo = (page: Page): Promise<void> => page.getByRole('button', { name: 'Rétablir', exact: true }).click();

async function heroState(page: Page): Promise<{ name: string; color: string | undefined; selector: string | undefined }> {
  return page.evaluate(() => {
    const review = window.phase3Review;
    if (review?.ready !== true) throw new Error('Phase 3 demo is not ready.');
    const folder = review.editor.document.layers[0];
    if (folder?.type !== 'folder') throw new Error('Characters folder is missing.');
    const hero = folder.children.find((node) => node.id === 'hero');
    if (hero?.type !== 'layer') throw new Error('Hero layer is missing.');
    return { name: hero.name, color: hero.color, selector: hero.target !== undefined && 'selector' in hero.target ? hero.target.selector : undefined };
  });
}

async function openRename(page: Page, name: string): Promise<Locator> {
  await row(page, 'hero').locator('.jt-layer-row__name').dblclick();
  const input = row(page, 'hero').locator('.jt-layer-row__name-input');
  await input.fill(name);
  return input;
}

test.describe('preserved phase 3 validation demo', () => {
  let problems: string[];

  test.beforeEach(async ({ page }) => {
    problems = [];
    page.on('pageerror', (error) => problems.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') problems.push(message.text()); });
    await page.goto(`${RUNTIME_DEMO_URL}/validation-phase3.html`);
    await expect(page.locator('#editor-host .jt-shell')).toBeVisible();
    await page.waitForFunction(() => window.phase3Review?.ready === true);
  });

  test.afterEach(async ({ page }, testInfo) => {
    const screenshot = testInfo.outputPath('phase3-demo.png');
    await page.screenshot({ path: screenshot, fullPage: true });
    await testInfo.attach('phase3-demo', { path: screenshot, contentType: 'image/png' });
    expect(problems).toEqual([]);
  });

  test('loads the editor and visible layer tree', async ({ page }) => {
    await expect(row(page, 'hero')).toBeVisible();
    await expect(page.locator('#editor-host .jt-layer-row')).toHaveCount(25);
    await page.reload();
    await page.waitForFunction(() => window.phase3Review?.ready === true);
    await expect(page.locator('#editor-host .jt-shell')).toBeVisible();
  });

  test('collapses and expands a folder', async ({ page }) => {
    await row(page, 'characters').getByRole('button', { name: 'Replier le dossier', exact: true }).click();
    await expect(row(page, 'hero')).toHaveCount(0);
    await row(page, 'characters').getByRole('button', { name: 'Déplier le dossier', exact: true }).click();
    await expect(row(page, 'hero')).toBeVisible();
  });

  test('renames a layer with undo and redo', async ({ page }) => {
    await (await openRename(page, 'Héros de la revue')).press('Enter');
    expect((await heroState(page)).name).toBe('Héros de la revue');
    await undo(page);
    expect((await heroState(page)).name).toBe('Héros');
    await redo(page);
    expect((await heroState(page)).name).toBe('Héros de la revue');
    await undo(page);
    expect((await heroState(page)).name).toBe('Héros');
  });

  test('preserves the renamed row after modeled document focus loss', async ({ page }) => {
    await openRename(page, 'Héros après changement de fenêtre');
    await page.evaluate(() => {
      const descriptor = Object.getOwnPropertyDescriptor(document, 'hasFocus');
      Object.defineProperty(document, 'hasFocus', { configurable: true, value: () => false });
      try { document.querySelector<HTMLInputElement>('.jt-layer-row__name-input')?.blur(); }
      finally {
        if (descriptor === undefined) Reflect.deleteProperty(document, 'hasFocus');
        else Object.defineProperty(document, 'hasFocus', descriptor);
      }
    });
    await expect(row(page, 'hero')).toBeFocused();
    expect((await heroState(page)).name).toBe('Héros après changement de fenêtre');
    await undo(page);
    expect((await heroState(page)).name).toBe('Héros');
  });

  test('keeps focus outside the list after an actual iframe click', async ({ page }) => {
    await openRename(page, 'Héros après sortie vers iframe');
    await page.frameLocator('#focus-iframe').getByRole('button').click();
    expect((await heroState(page)).name).toBe('Héros après sortie vers iframe');
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('focus-iframe');
    expect(await page.evaluate(() => document.hasFocus())).toBe(true);
    await undo(page);
    expect((await heroState(page)).name).toBe('Héros');
  });

  test('changes visibility and lock with undo', async ({ page }) => {
    const visibility = row(page, 'hero').locator('.jt-layer-flag--visibility');
    await visibility.click();
    await expect(visibility).toHaveAttribute('aria-pressed', 'false');
    await undo(page);
    await expect(visibility).toHaveAttribute('aria-pressed', 'true');
    const lock = row(page, 'hero').locator('.jt-layer-flag--lock');
    await lock.click();
    await expect(lock).toHaveAttribute('aria-pressed', 'true');
    await undo(page);
    await expect(lock).toHaveAttribute('aria-pressed', 'false');
  });

  test('changes layer color with undo', async ({ page }) => {
    const original = (await heroState(page)).color;
    await row(page, 'hero').locator('input[type="color"]').evaluate((input: HTMLInputElement) => {
      input.value = '#248f78';
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect((await heroState(page)).color).toBe('#248f78');
    await undo(page);
    expect((await heroState(page)).color).toBe(original);
  });

  test('applies a typed target with undo', async ({ page }) => {
    await row(page, 'hero').locator('.jt-layer-target').click();
    const popup = page.locator('.jt-target-popup');
    await popup.locator('.jt-target-popup__text').fill('#orb-object');
    await popup.locator('.jt-target-popup__apply').click();
    expect((await heroState(page)).selector).toBe('#orb-object');
    await undo(page);
    expect((await heroState(page)).selector).toBe('#hero-object');
  });

  test('reorders a layer by keyboard with undo', async ({ page }) => {
    await row(page, 'hero').locator('.jt-layer-row__name').click();
    await row(page, 'hero').press('Control+Alt+ArrowDown');
    const characterIds = (): Promise<string[]> => page.evaluate(() => {
      const review = window.phase3Review;
      if (review?.ready !== true) throw new Error('Phase 3 demo is not ready.');
      const folder = review.editor.document.layers[0];
      if (folder?.type !== 'folder') throw new Error('Characters folder is missing.');
      return folder.children.map((node) => node.id);
    });
    expect(await characterIds()).toEqual(['orb', 'hero']);
    await undo(page);
    expect(await characterIds()).toEqual(['hero', 'orb']);
  });

  test('zooms and synchronizes horizontal and vertical scrolling', async ({ page }) => {
    await page.getByRole('combobox', { name: 'Niveau de zoom', exact: true }).selectOption('2');
    expect(await page.evaluate(() => window.phase3Review?.ready ? window.phase3Review.editor.getService('layout.zoom')?.zoom() : undefined)).toBe(2);
    await page.locator('.jt-zone--frames').evaluate((zone) => zone.scrollTo({ left: 410, top: 150 }));
    await expect.poll(() => page.evaluate(() => {
      const frames = document.querySelector('.jt-zone--frames');
      const ruler = document.querySelector('.jt-zone--ruler');
      const layers = document.querySelector('.jt-zone--layers');
      if (frames === null || ruler === null || layers === null) return null;
      return Math.abs(frames.scrollLeft - ruler.scrollLeft) + Math.abs(frames.scrollTop - layers.scrollTop);
    })).toBe(0);
    expect(await page.locator('.jt-zone--frames').evaluate((zone) => zone.scrollLeft)).toBeGreaterThan(0);
    expect(await page.locator('.jt-zone--frames').evaluate((zone) => zone.scrollTop)).toBeGreaterThan(0);
  });

  test('seeks by ruler and moves the playhead by keyboard', async ({ page }) => {
    await page.locator('.jt-zone--ruler').click({ position: { x: 160, y: 12 } });
    expect(await page.evaluate(() => window.phase3Review?.ready ? window.phase3Review.editor.playback.frame : 0)).toBeGreaterThan(1);
    const playhead = page.getByRole('slider', { name: 'Tête de lecture', exact: true });
    await playhead.focus();
    const previous = await page.evaluate(() => window.phase3Review?.ready ? window.phase3Review.editor.playback.frame : 0);
    await playhead.press('ArrowRight');
    expect(await page.evaluate(() => window.phase3Review?.ready ? window.phase3Review.editor.playback.frame : 0)).toBe(previous + 1);
  });
});
