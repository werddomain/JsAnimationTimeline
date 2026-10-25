// e2e/validation/phase7.spec.ts
/** Permanent browser checks preserved from the phase-7 validation demo. */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { IPhase7Snapshot } from '../../demo/runtime/src/validation/phase7Types';
import { RUNTIME_DEMO_URL } from '../runtime/demoUrl';

const URL = `${RUNTIME_DEMO_URL}/validation-phase7.html`;
const SELECTORS = ['#logo', '#logo-mark', '#ball'] as const;

async function seek(page: Page, frame: number): Promise<IPhase7Snapshot> {
  return page.evaluate(async (requestedFrame) => {
    const review = window.phase7Review;
    if (review?.ready !== true) throw new Error('Phase-7 comparison is not ready.');
    await review.seek(requestedFrame);
    return review.snapshot();
  }, frame);
}

test.describe('preserved phase-7 validation demo', () => {
  let problems: string[];

  test.beforeEach(async ({ page }) => {
    problems = [];
    page.on('pageerror', (error) => problems.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') problems.push(message.text()); });
    await page.goto(URL);
    await page.waitForFunction(() => window.phase7Review?.ready === true);
  });

  test.afterEach(async ({ page }, testInfo) => {
    await page.screenshot({ path: testInfo.outputPath('phase7-demo.png'), fullPage: true });
    expect(problems).toEqual([]);
  });

  test('loads the preserved phase-7 comparison without warnings', async ({ page }) => {
    const metadata = await page.evaluate(() => {
      const review = window.phase7Review;
      if (review?.ready !== true) throw new Error('Phase-7 comparison is not ready.');
      return { warnings: review.warnings, animations: review.animationCount };
    });
    expect(metadata).toEqual({ warnings: [], animations: 3 });
    await expect(page.getByRole('heading', { name: 'Du document animé au CSS exporté' })).toBeVisible();
  });

  test('matches all 48 integer frames across the three rendered targets', async ({ page }) => {
    for (let frame = 1; frame <= 48; frame += 1) {
      const rendered = await seek(page, frame);
      expect(rendered.frame).toBe(frame);
      for (const selector of SELECTORS) {
        const expected = rendered.runtime[selector];
        const actual = rendered.css[selector];
        expect(actual.visibility, `frame ${frame} ${selector} visibility`).toBe(expected.visibility);
        expect(actual.tx, `frame ${frame} ${selector} tx`).toBeCloseTo(expected.tx, 2);
        expect(actual.ty, `frame ${frame} ${selector} ty`).toBeCloseTo(expected.ty, 2);
        actual.linear.forEach((value, index) => expect(value, `frame ${frame} ${selector} matrix[${index}]`).toBeCloseTo(expected.linear[index], 3));
        expect(actual.opacity, `frame ${frame} ${selector} opacity`).toBeCloseTo(expected.opacity, 3);
      }
      expect(rendered.css['#ball'].visibility === 'hidden', `blank span at frame ${frame}`).toBe(frame >= 25 && frame <= 32);
    }
    await test.info().attach('48-frame-comparison.json', {
      body: Buffer.from(JSON.stringify({ integerFrames: 48, targets: SELECTORS, status: 'passed' })),
      contentType: 'application/json'
    });
  });

  test('inspects the blank-span boundaries and the frame slider', async ({ page }) => {
    for (const frame of [24, 25, 32, 33]) {
      await page.getByRole('button', { name: `Image ${frame}`, exact: true }).click();
      await expect(page.locator('#frame-label')).toHaveText(`Image ${frame} / 48`);
      const snapshot = await page.evaluate(() => {
        const review = window.phase7Review;
        if (review?.ready !== true) throw new Error('Phase-7 comparison is not ready.');
        return review.snapshot();
      });
      expect(snapshot.frame).toBe(frame);
    }
    await page.locator('#frame-slider').fill('12');
    await expect(page.locator('#frame-label')).toHaveText('Image 12 / 48');
  });

  test('preserves actual ref, unknown-property and value-property warnings', async ({ page }) => {
    const warnings = await page.evaluate(() => {
      const review = window.phase7Review;
      if (review?.ready !== true) throw new Error('Phase-7 comparison is not ready.');
      return review.warningExamples;
    });
    expect(warnings.map((warning) => warning.code)).toEqual(['unsupported-target', 'unknown-property', 'non-css-property']);
    expect(warnings.find((warning) => warning.code === 'unknown-property')?.property).toBe('mystery');
    expect(warnings.find((warning) => warning.code === 'non-css-property')?.property).toBe('volume');
    await expect(page.locator('#warning-list li')).toHaveCount(3);
  });

  test('downloads the same CSS text as the readonly output', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Télécharger le CSS', exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('timeline-phase7.css');
    const stream = await download.createReadStream();
    if (stream === null) throw new Error('The CSS download stream is unavailable.');
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    expect(Buffer.concat(chunks).toString('utf8')).toBe(await page.locator('#css-output').inputValue());
  });
});
