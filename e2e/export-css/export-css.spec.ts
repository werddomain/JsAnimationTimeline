// e2e/export-css/export-css.spec.ts
/**
 * Scénario Playwright 12 : le CSS produit par `export-css` donne, à l'image N,
 * le même rendu que le `runtime`. Dans la démo du runtime (demo/runtime), on
 * lit les styles calculés après `seek(N)`, puis on annule les animations du
 * lecteur, on injecte le CSS exporté du même document et on place ses
 * animations CSS au temps de l'image N.
 */

import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { exportCss } from '@werddomain/timeline-export-css';
import { DEMO_ANIMATION } from '../../demo/runtime/src/animation';
import { RUNTIME_DEMO_URL } from '../runtime/demoUrl';

const TARGETS = ['#logo', '#logo-mark', '#ball'] as const;
const { fps, totalFrames } = DEMO_ANIMATION.settings;
/** Frames inside eased segments, at the blank span's edges and at the end. */
const FRAMES = [1, 12, 24, 25, 30, 32, 33, 40, 48];

/** Rendered state of one element, read from its computed style. */
interface IRenderedState {
  readonly tx: number;
  readonly ty: number;
  readonly rotation: number;
  readonly opacity: number;
  readonly visibility: string;
}

async function renderedStates(page: Page): Promise<Record<string, IRenderedState>> {
  return page.evaluate((selectors) => {
    const states: Record<string, IRenderedState> = {};
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element === null) {
        throw new Error(`Missing element ${selector}`);
      }
      const style = getComputedStyle(element);
      const matrix = new DOMMatrix(style.transform === 'none' ? undefined : style.transform);
      states[selector] = {
        tx: matrix.m41,
        ty: matrix.m42,
        rotation: (Math.atan2(matrix.m12, matrix.m11) * 180) / Math.PI,
        opacity: Number(style.opacity),
        visibility: style.visibility
      };
    }
    return states;
  }, TARGETS);
}

async function seek(page: Page, frame: number): Promise<void> {
  await page.locator('#seek').fill(String(frame));
  await expect(page.locator('#frame')).toHaveText(`Image ${frame} / ${totalFrames}`);
}

/** Replaces the player's animations by the exported CSS, paused at `timeMs`. Returns the number of CSS animations. */
async function applyExportedCss(page: Page, css: string, timeMs: number): Promise<number> {
  return page.evaluate(
    ({ sheet, time }) => {
      document.getAnimations().forEach((animation) => animation.cancel());
      const style = document.createElement('style');
      style.textContent = sheet;
      document.head.appendChild(style);
      const cssAnimations = document.getAnimations().filter((animation) => animation instanceof CSSAnimation);
      cssAnimations.forEach((animation) => {
        animation.pause();
        animation.currentTime = time;
      });
      return cssAnimations.length;
    },
    { sheet: css, time: timeMs }
  );
}

test.describe('export CSS matches the runtime (scenario 12)', () => {
  const { css, warnings } = exportCss(DEMO_ANIMATION);
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

  test('exports every layer of the demo without warnings', () => {
    expect(warnings).toEqual([]);
    for (const selector of TARGETS) {
      expect(css).toContain(`\n${selector} {`);
    }
  });

  for (const frame of FRAMES) {
    test(`frame ${frame}: the exported CSS renders like the runtime`, async ({ page }) => {
      await seek(page, frame);
      const runtime = await renderedStates(page);

      expect(await applyExportedCss(page, css, ((frame - 1) * 1000) / fps)).toBe(TARGETS.length);
      const exported = await renderedStates(page);

      for (const selector of TARGETS) {
        const expected = runtime[selector];
        const actual = exported[selector];
        expect(actual.visibility, `${selector} visibility`).toBe(expected.visibility);
        expect(actual.tx, `${selector} tx`).toBeCloseTo(expected.tx, 2);
        expect(actual.ty, `${selector} ty`).toBeCloseTo(expected.ty, 2);
        expect(actual.rotation, `${selector} rotation`).toBeCloseTo(expected.rotation, 2);
        expect(actual.opacity, `${selector} opacity`).toBeCloseTo(expected.opacity, 3);
      }
    });
  }
});
