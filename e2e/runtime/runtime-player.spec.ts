// e2e/runtime/runtime-player.spec.ts
/**
 * Scénario Playwright 11 : le `runtime` seul joue une animation JSON v2 dans
 * la page de démo (demo/runtime) : image par image, lecture, pause, boucle et
 * événement `complete`.
 */

import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { RUNTIME_DEMO_URL } from './demoUrl';

const TOTAL_FRAMES = 48;

async function currentFrame(page: Page): Promise<number> {
  const text = (await page.locator('#frame').textContent()) ?? '';
  const match = /Image (\d+) \/ (\d+)/.exec(text);
  if (match === null) {
    throw new Error(`Unexpected frame text "${text}"`);
  }
  return Number(match[1]);
}

/** Translation (px) and visible state of an element, from its computed style. */
async function computed(locator: Locator): Promise<{ tx: number; ty: number; opacity: number; visibility: string }> {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    const matrix = new DOMMatrix(style.transform === 'none' ? undefined : style.transform);
    return { tx: matrix.m41, ty: matrix.m42, opacity: Number(style.opacity), visibility: style.visibility };
  });
}

async function seek(page: Page, frame: number): Promise<void> {
  await page.locator('#seek').fill(String(frame));
  await expect(page.locator('#frame')).toHaveText(`Image ${frame} / ${TOTAL_FRAMES}`);
}

test.describe('runtime demo (scenario 11)', () => {
  let problems: string[];

  test.beforeEach(async ({ page }) => {
    problems = [];
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(`console: ${message.text()}`);
    });
    page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
    await page.goto(`${RUNTIME_DEMO_URL}/`);
  });

  test.afterEach(() => {
    expect(problems).toEqual([]);
  });

  test('shows frame 1 with the values of the JSON document', async ({ page }) => {
    await expect(page.locator('#frame')).toHaveText(`Image 1 / ${TOTAL_FRAMES}`);
    await expect(page.locator('#play')).toBeEnabled();
    await expect(page.locator('#pause')).toBeDisabled();
    const logo = await computed(page.locator('#logo'));
    expect(logo.tx).toBeCloseTo(0, 3);
    const ball = await computed(page.locator('#ball'));
    expect(ball.opacity).toBeCloseTo(0, 3);
    expect(ball.ty).toBeCloseTo(-40, 3);
  });

  test('applies the runtime values at the frame chosen with the slider', async ({ page }) => {
    await seek(page, 25);
    expect((await computed(page.locator('#logo'))).tx).toBeCloseTo((300 * 24) / 47, 2);
    expect((await computed(page.locator('#ball'))).visibility).toBe('hidden');

    await seek(page, 33);
    const ball = await computed(page.locator('#ball'));
    expect(ball.visibility).toBe('visible');
    expect(ball.ty).toBeCloseTo(40, 3);
    expect(ball.opacity).toBeCloseTo(1, 3);
  });

  test('plays, then pauses on a frame that no longer moves', async ({ page }) => {
    await page.locator('#play').click();
    await expect(page.locator('body')).toHaveAttribute('data-playing', 'true');
    await expect(page.locator('#events li[data-event="play"]')).toHaveCount(1);
    await expect.poll(() => currentFrame(page)).toBeGreaterThan(3);

    await page.locator('#pause').click();
    await expect(page.locator('body')).toHaveAttribute('data-playing', 'false');
    await expect(page.locator('#events li[data-event="pause"]')).toHaveCount(1);
    const frame = await currentFrame(page);
    const before = await computed(page.locator('#logo'));
    expect(frame).toBeLessThan(TOTAL_FRAMES);

    await page.waitForTimeout(400);
    expect(await currentFrame(page)).toBe(frame);
    expect((await computed(page.locator('#logo'))).tx).toBeCloseTo(before.tx, 3);
  });

  test('stops on the last frame and emits complete', async ({ page }) => {
    await page.locator('#speed').selectOption('4');
    await seek(page, 36);
    await page.locator('#play').click();

    await expect(page.locator('#events li[data-event="complete"]')).toHaveCount(1, { timeout: 5_000 });
    await expect(page.locator('#frame')).toHaveText(`Image ${TOTAL_FRAMES} / ${TOTAL_FRAMES}`);
    await expect(page.locator('body')).toHaveAttribute('data-playing', 'false');
    await expect(page.locator('#play')).toBeEnabled();
    expect((await computed(page.locator('#logo'))).tx).toBeCloseTo(300, 3);
  });

  test('loops back to frame 1 and keeps playing', async ({ page }) => {
    await page.locator('#loop').check();
    await page.locator('#speed').selectOption('4');
    await seek(page, 40);
    await page.locator('#play').click();

    await expect(page.locator('#events li[data-event="loop"]').first()).toBeAttached({ timeout: 5_000 });
    await expect(page.locator('body')).toHaveAttribute('data-playing', 'true');
    await expect.poll(() => currentFrame(page)).toBeLessThan(40);
    await expect(page.locator('#events li[data-event="complete"]')).toHaveCount(0);

    await page.locator('#pause').click();
  });
});
