// e2e/validation/property-editing.spec.ts
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { IPropertyEditingFixture } from '../../demo/editor/src/propertyTimelinesTypes';

async function snapshot(page: Page): Promise<string> {
  return page.evaluate(() => JSON.stringify(window.propertyEditingFixture?.editor.document));
}
async function samples(page: Page, property = 'opacity'): Promise<readonly (number | undefined)[]> {
  return page.evaluate((name) => {
    const { editor } = window.propertyEditingFixture as IPropertyEditingFixture;
    return Array.from({ length: 199 }, (_, index) => {
      const value = editor.sample(1 + index / 2).layer('object')?.propertyValues?.[name];
      return value?.kind === 'number' ? value.value : undefined;
    });
  }, property);
}
async function seek(page: Page, frame: number): Promise<void> {
  await page.getByRole('spinbutton', { name: 'Image courante', exact: true }).fill(String(frame));
}

test.describe('property editing through the public editor API', () => {
  let problems: string[];
  test.beforeEach(async ({ page }) => {
    const errors: string[] = []; problems = errors;
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto('/property-timelines.html');
    await expect(page.getByRole('heading', { name: 'Une propriété. Une courbe.', exact: true })).toBeVisible();
    await page.waitForFunction(() => window.propertyEditingFixture?.ready === true);
  });
  test.afterEach(async ({ page }, testInfo) => {
    await page.screenshot({ path: testInfo.outputPath('property-editing.png'), fullPage: true });
    expect(problems).toEqual([]);
  });

  test('edits X at frame 50 without changing the opacity tween, then undoes the new property', async ({ page }) => {
    const opacity = await samples(page);
    const before = await snapshot(page);
    await seek(page, 50);
    await page.getByRole('combobox', { name: 'Propriété à modifier', exact: true }).selectOption('x');
    await page.getByRole('spinbutton', { name: 'Nouvelle valeur', exact: true }).fill('30');
    await page.getByRole('button', { name: 'Appliquer la valeur', exact: true }).click();
    await expect(page.locator('#value-x')).toHaveText('30.00');
    expect(await samples(page)).toEqual(opacity);
    const x = await samples(page, 'x');
    expect(x[96]).toBe(0); // frame 49
    expect(x[98]).toBe(30); // frame 50
    expect(x[198]).toBe(30);
    await expect(page.locator('#track-x')).toContainText('50');
    await page.getByRole('button', { name: 'Annuler', exact: true }).click();
    expect(await snapshot(page)).toBe(before);
  });

  test('captures a key inside the nonlinear tween without changing any fractional sample', async ({ page }) => {
    const before = await snapshot(page);
    const opacity = await samples(page);
    await seek(page, 50);
    await page.getByRole('button', { name: 'Capturer une clé', exact: true }).click();
    expect(await samples(page)).toEqual(opacity);
    await expect(page.getByRole('combobox', { name: 'Transition à modifier', exact: true }).locator('option')).toHaveCount(2);
    await expect(page.locator('#track-opacity')).toContainText('50');
    await expect(page.locator('#last-change')).toContainText('opacity');
    await page.getByRole('button', { name: 'Annuler', exact: true }).click();
    expect(await snapshot(page)).toBe(before);
  });

  test('applies parameterized easing and Bezier through undoable transition commands', async ({ page }) => {
    const before = await snapshot(page);
    const opacity = await samples(page);
    const effect = page.getByRole('combobox', { name: 'Courbe ou effet', exact: true });
    await expect(effect.locator('option')).toHaveCount(13);
    await effect.selectOption('power');
    await page.getByRole('spinbutton', { name: 'Puissance', exact: true }).fill('3');
    await page.getByRole('combobox', { name: 'Accélération', exact: true }).selectOption('in');
    await page.getByRole('button', { name: 'Appliquer l’effet', exact: true }).click();
    expect((await samples(page))[98]).toBeCloseTo(0.2 + 0.8 * (49 / 99) ** 3, 12);
    expect(await samples(page)).not.toEqual(opacity);
    await page.getByRole('button', { name: 'Annuler', exact: true }).click();
    expect(await snapshot(page)).toBe(before);
    await effect.selectOption('bezier');
    await page.getByRole('spinbutton', { name: 'Y1', exact: true }).fill('0');
    await page.getByRole('spinbutton', { name: 'Y2', exact: true }).fill('0');
    await page.getByRole('button', { name: 'Appliquer l’effet', exact: true }).click();
    expect(await snapshot(page)).toContain('"kind":"bezier"');
    await expect(page.locator('#curve-line')).toHaveAttribute('d', /^M .+ L /);
    await page.getByRole('button', { name: 'Annuler', exact: true }).click();
    expect(await snapshot(page)).toBe(before);
  });

  test('cancels an X/Y gesture with Escape without losing redo, and commits it as one undo entry', async ({ page }) => {
    await page.getByRole('combobox', { name: 'Propriété à modifier', exact: true }).selectOption('x');
    await page.getByRole('spinbutton', { name: 'Nouvelle valeur', exact: true }).fill('10');
    await page.getByRole('button', { name: 'Appliquer la valeur', exact: true }).click();
    const keyed = await snapshot(page);
    await page.getByRole('button', { name: 'Annuler', exact: true }).click();
    const before = await snapshot(page);
    await page.getByRole('button', { name: 'Commencer un déplacement', exact: true }).click();
    await page.getByRole('spinbutton', { name: 'Déplacement X', exact: true }).fill('40');
    await page.getByRole('spinbutton', { name: 'Déplacement Y', exact: true }).fill('20');
    await page.getByRole('button', { name: 'Prévisualiser X/Y', exact: true }).click();
    await expect(page.locator('#value-y')).toHaveText('20.00');
    await page.keyboard.press('Escape');
    expect(await snapshot(page)).toBe(before);
    await expect(page.getByRole('button', { name: 'Rétablir', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Rétablir', exact: true }).click();
    expect(await snapshot(page)).toBe(keyed);
    await page.getByRole('button', { name: 'Commencer un déplacement', exact: true }).click();
    await page.getByRole('spinbutton', { name: 'Déplacement X', exact: true }).fill('40');
    await page.getByRole('spinbutton', { name: 'Déplacement Y', exact: true }).fill('20');
    await page.getByRole('button', { name: 'Prévisualiser X/Y', exact: true }).click();
    await page.getByRole('button', { name: 'Valider le déplacement', exact: true }).click();
    await page.getByRole('button', { name: 'Annuler', exact: true }).click();
    expect(await snapshot(page)).toBe(keyed);
  });

  test('removes and recreates a tween, while invalid selections leave document and history unchanged', async ({ page }) => {
    const before = await snapshot(page);
    await page.getByRole('button', { name: 'Supprimer la transition', exact: true }).click();
    const held = await samples(page);
    expect(held[98]).toBe(0.2);
    await page.getByRole('textbox', { name: 'Clés de la transition', exact: true }).fill('1, 50, 100');
    const noTween = await snapshot(page);
    await page.getByRole('button', { name: 'Créer la transition', exact: true }).click();
    await expect(page.getByRole('status', { name: 'Résultat de la commande', exact: true })).toContainText(/deux|2/);
    expect(await snapshot(page)).toBe(noTween);
    await page.getByRole('textbox', { name: 'Clés de la transition', exact: true }).fill('1, 100');
    await page.getByRole('button', { name: 'Créer la transition', exact: true }).click();
    expect((await samples(page))[98]).toBeGreaterThan(0.2);
    await page.getByRole('button', { name: 'Annuler', exact: true }).click();
    expect(await snapshot(page)).toBe(noTween);
    await page.getByRole('button', { name: 'Annuler', exact: true }).click();
    expect(await snapshot(page)).toBe(before);
  });

  for (const width of [320, 768, 1440]) test(`keeps controls and timeline readable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const effect = page.getByRole('combobox', { name: 'Courbe ou effet', exact: true });
    await effect.selectOption('elastic');
    await expect(page.getByRole('spinbutton', { name: 'Oscillations', exact: true })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Valeur évaluée de l’opacité', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const geometry = await effect.evaluate((node) => {
      const style = getComputedStyle(node);
      return { height: node.getBoundingClientRect().height, font: parseFloat(style.fontSize), top: parseFloat(style.paddingTop), bottom: parseFloat(style.paddingBottom) };
    });
    expect(geometry.height - geometry.top - geometry.bottom).toBeGreaterThanOrEqual(geometry.font);
  });
});
