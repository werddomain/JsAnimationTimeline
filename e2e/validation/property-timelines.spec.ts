// e2e/validation/property-timelines.spec.ts
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { IPropertyTimelinesFixture } from '../../demo/runtime/src/fixtures/property-timelines';
import { RUNTIME_DEMO_URL } from '../runtime/demoUrl';

async function seek(page: Page, frame: number): Promise<void> {
  await page.getByRole('spinbutton', { name: 'Image', exact: true }).fill(String(frame));
}

async function x(page: Page): Promise<number> {
  return Number(await page.locator('#sample-x').textContent());
}

test.describe('independent typed property timelines and parameterized easing', () => {
  let problems: string[];
  test.beforeEach(async ({ page }) => {
    const errors: string[] = []; problems = errors;
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`${RUNTIME_DEMO_URL}/fixtures/property-timelines.html`);
    await expect(page.getByRole('heading', { name: 'Courbes et pistes indépendantes', exact: true })).toBeVisible();
    await page.waitForFunction(() => window.propertyTimelinesFixture?.ready === true);
  });
  test.afterEach(async ({ page }, testInfo) => {
    await page.screenshot({ path: testInfo.outputPath('property-timelines.png'), fullPage: true });
    expect(problems).toEqual([]);
  });

  test('uses the real player and object stage for independent held values, initial states and fractional frames', async ({ page }) => {
    expect(await x(page)).toBeCloseTo(100 * (1 - Math.SQRT1_2), 3);
    await expect(page.locator('#sample-opacity')).toHaveText('75 %');
    await expect(page.locator('#sample-caption')).toHaveText('Arrivée');
    await expect(page.locator('#sample-color')).toHaveCSS('background-color', 'rgb(128, 51, 128)');
    expect(await page.evaluate(() => window.propertyTimelinesFixture?.player.missingTargets)).toEqual([]);

    await seek(page, 10);
    expect(await x(page)).toBe(-20);
    await expect(page.locator('#sample-opacity')).toHaveText('25 %');
    await expect(page.locator('#sample-caption')).toHaveText('Départ');
    await seek(page, 50.75);
    expect(await x(page)).toBeCloseTo(100 * (1 - Math.cos((50.75 - 21) / 80 * Math.PI / 2)), 3);
    await expect(page.locator('#sample-opacity')).toHaveText('25 %');
    await seek(page, 51);
    await expect(page.locator('#sample-opacity')).toHaveText('75 %');
    await expect(page.locator('#sample-caption')).toHaveText('Arrivée');
    await page.getByRole('button', { name: 'Revenir au début' }).click();
    await expect(page.getByRole('spinbutton', { name: 'Image', exact: true })).toHaveValue('1');
    expect(await x(page)).toBe(-20);
  });

  test('changes effect parameters and timing direction without modifying other property tracks', async ({ page }) => {
    const before = await page.evaluate(() => {
      const fixture = window.propertyTimelinesFixture as IPropertyTimelinesFixture;
      const layer = fixture.document().layers[0];
      return layer.type === 'layer' ? layer.propertyTimelines?.opacity : undefined;
    });
    await page.getByRole('combobox', { name: 'Courbe ou effet' }).selectOption('power');
    await page.getByRole('spinbutton', { name: 'Puissance', exact: true }).fill('3');
    expect(await x(page)).toBeCloseTo(12.5, 3);
    await page.getByRole('combobox', { name: 'Accélération', exact: true }).selectOption('out');
    expect(await x(page)).toBeCloseTo(87.5, 3);
    await page.getByRole('combobox', { name: 'Accélération', exact: true }).selectOption('in-out');
    expect(await x(page)).toBeCloseTo(50, 3);
    await expect(page.locator('#sample-opacity')).toHaveText('75 %');
    expect(await page.evaluate(() => {
      const fixture = window.propertyTimelinesFixture as IPropertyTimelinesFixture;
      const layer = fixture.document().layers[0];
      return layer.type === 'layer' ? layer.propertyTimelines?.opacity : undefined;
    })).toEqual(before);
  });

  test('plots overshoot instead of clipping it and supports all families plus editable Bezier coordinates', async ({ page }) => {
    const effects = page.getByRole('combobox', { name: 'Courbe ou effet' });
    await expect(effects.locator('option')).toHaveCount(13);
    for (const effect of ['linear', 'sine', 'circle', 'quadratic', 'cubic', 'quartic', 'quintic', 'power', 'exponential', 'bounce', 'elastic']) {
      await effects.selectOption(effect);
      expect(Number.isFinite(await x(page))).toBe(true);
      await expect(page.locator('#effect-status')).toBeEmpty();
    }
    await effects.selectOption('back');
    await page.getByRole('combobox', { name: 'Accélération', exact: true }).selectOption('out');
    await page.getByRole('spinbutton', { name: 'Amplitude', exact: true }).fill('2');
    await seek(page, 77);
    expect(await x(page)).toBeGreaterThan(100);
    expect(Number(await page.locator('#curve-max').textContent())).toBeGreaterThan(1);
    await expect(page.locator('#curve-line')).toHaveAttribute('d', /^M .+ L /);

    await effects.selectOption('bezier');
    await page.getByRole('spinbutton', { name: 'X1', exact: true }).fill(String(1 / 3));
    await page.getByRole('spinbutton', { name: 'Y1', exact: true }).fill('0');
    await page.getByRole('spinbutton', { name: 'X2', exact: true }).fill(String(2 / 3));
    await page.getByRole('spinbutton', { name: 'Y2', exact: true }).fill('0');
    await seek(page, 61);
    expect(await x(page)).toBeCloseTo(12.5, 3);
    await expect(page.getByRole('combobox', { name: 'Accélération', exact: true })).toBeHidden();
  });

  test('keeps the last valid configuration when a parameter is invalid', async ({ page }) => {
    await page.getByRole('combobox', { name: 'Courbe ou effet' }).selectOption('elastic');
    const previous = await x(page);
    await page.getByRole('spinbutton', { name: 'Oscillations', exact: true }).fill('100');
    await expect(page.getByRole('status', { name: 'Validation de l’effet' })).toContainText('paramètres valides');
    expect(await x(page)).toBe(previous);
    await page.getByRole('spinbutton', { name: 'Oscillations', exact: true }).fill('2');
    await expect(page.getByRole('status', { name: 'Validation de l’effet' })).toBeEmpty();
  });

  for (const width of [320, 768, 1440]) test(`keeps controls and graph readable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole('combobox', { name: 'Courbe ou effet' }).selectOption('elastic');
    await expect(page.getByRole('spinbutton', { name: 'Oscillations', exact: true })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Courbe d’accélération du déplacement', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const select = page.getByRole('combobox', { name: 'Courbe ou effet' });
    const geometry = await select.evaluate((node) => {
      const style = getComputedStyle(node);
      return { height: node.getBoundingClientRect().height, font: parseFloat(style.fontSize), top: parseFloat(style.paddingTop), bottom: parseFloat(style.paddingBottom) };
    });
    expect(geometry.height - geometry.top - geometry.bottom).toBeGreaterThanOrEqual(geometry.font);
  });
});
