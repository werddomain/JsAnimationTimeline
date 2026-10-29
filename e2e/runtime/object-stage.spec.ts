// e2e/runtime/object-stage.spec.ts
/**
 * Scénario Playwright 11b : le `runtime` joue une scène sans HTML animé
 * (demo/runtime/object-stage.html) : un sprite canvas et un volume audio
 * (deux `createObjectStage`) avec un calque HTML, sur une horloge manuelle.
 * Les valeurs reçues par les scènes à l'image N (entière ou fractionnaire)
 * doivent égaler `evaluateDocument` sur le même document, et le sprite et la
 * piste audio (ce que `apply` a réellement posé) aussi.
 */

import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { RUNTIME_DEMO_URL } from './demoUrl';

const TOLERANCE = 1e-6;

/** The part of `window.__objectStageDemo` (see demo/runtime/src/objectStage/hook.ts) used here. */
interface IDemoHook {
  advanceToFrame(frame: number): void;
  expected(frame: number): Record<string, Record<string, number>>;
  readonly received: Record<string, IReceivedSnapshot[]>;
  readonly player: { readonly missingTargets: readonly string[] };
  readonly clock: object | null;
  readonly sprite: ISpriteSnapshot;
  readonly track: { readonly volume: number };
}

interface ISpriteSnapshot {
  readonly visible: boolean;
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly frame: number;
}

declare global {
  interface Window {
    __objectStageDemo?: IDemoHook;
  }
}

interface IReceivedSnapshot {
  readonly frame: number;
  readonly layers: ReadonlyArray<{ layerId: string; active: boolean; values: Record<string, number> }>;
}

interface IFrameCheck {
  readonly canvas: IReceivedSnapshot | null;
  readonly audio: IReceivedSnapshot | null;
  readonly expected: Record<string, Record<string, number>>;
  readonly missingTargets: readonly string[];
  readonly sprite: ISpriteSnapshot;
  readonly trackVolume: number;
  readonly volumeText: string;
}

/** Advances the manual clock to `frame`, then reads what the stages received and the expected values. */
async function renderFrame(page: Page, frame: number): Promise<IFrameCheck> {
  return page.evaluate((target) => {
    const hook = window.__objectStageDemo;
    if (hook === undefined) {
      throw new Error('window.__objectStageDemo is missing.');
    }
    hook.advanceToFrame(target);
    const last = (id: string): IReceivedSnapshot | null => hook.received[id][hook.received[id].length - 1] ?? null;
    return {
      canvas: last('canvas'),
      audio: last('audio'),
      expected: hook.expected(target),
      missingTargets: hook.player.missingTargets,
      sprite: { ...hook.sprite },
      trackVolume: hook.track.volume,
      volumeText: document.getElementById('volume')?.textContent ?? ''
    };
  }, frame);
}

function layerValues(snapshot: IReceivedSnapshot | null, layerId: string): Record<string, number> {
  const layer = snapshot?.layers.find((candidate) => candidate.layerId === layerId);
  if (layer === undefined) {
    throw new Error(`Layer ${layerId} was not rendered.`);
  }
  return layer.values;
}

function expectValues(received: Record<string, number>, expected: Record<string, number>): void {
  Object.entries(expected).forEach(([name, value]) => {
    expect(Math.abs(received[name] - value)).toBeLessThan(TOLERANCE);
  });
}

test.describe('runtime object stages (scenario 11b)', () => {
  let problems: string[];

  test.beforeEach(async ({ page }) => {
    problems = [];
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(`console: ${message.text()}`);
    });
    page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
    await page.goto(`${RUNTIME_DEMO_URL}/object-stage.html?clock=manual`);
    await expect(page.locator('#frame')).toHaveText('Image 1 / 48');
  });

  test.afterEach(() => {
    expect(problems).toEqual([]);
  });

  for (const frame of [1, 10, 10.5, 24, 33.25, 40]) {
    test(`canvas and audio stages receive the evaluated values at frame ${frame}`, async ({ page }) => {
      const check = await renderFrame(page, frame);

      expect(check.missingTargets).toEqual([]);
      expect(check.canvas?.frame).toBeCloseTo(frame, 6);
      expect(check.audio?.frame).toBeCloseTo(frame, 6);
      expectValues(layerValues(check.canvas, 'hero'), check.expected.hero);
      expectValues(layerValues(check.audio, 'music'), check.expected.music);
      // What apply really set on the sprite, the track and the readout.
      const hero = check.expected.hero;
      expect(check.sprite.visible).toBe(true);
      expect(check.sprite.x).toBeCloseTo(hero.x, 6);
      expect(check.sprite.y).toBeCloseTo(hero.y, 6);
      expect(check.sprite.angle).toBeCloseTo(hero.rotation, 6);
      expect(check.sprite.frame).toBe(hero.frameIndex);
      expect(check.trackVolume).toBeCloseTo(check.expected.music.volume, 6);
      expect(check.volumeText).toBe(check.expected.music.volume.toFixed(2).replace('.', ','));
      // Each stage only receives its own layers.
      expect(check.canvas?.layers.map((layer) => layer.layerId)).toEqual(['hero']);
      expect(check.audio?.layers.map((layer) => layer.layerId)).toEqual(['music']);
    });
  }

  for (const frame of [44, 48]) {
    test(`the blank span of the music gives the audio stage its default volume at frame ${frame}`, async ({ page }) => {
      const check = await renderFrame(page, frame);
      const music = check.audio?.layers.find((layer) => layer.layerId === 'music');
      expect(music?.active).toBe(false);
      // No reset on the audio stage: an inactive layer receives the registry default (volume 1).
      expect(music?.values.volume).toBe(1);
      // The track itself is silent: the audio stage ignores the default volume of an inactive layer.
      expect(check.trackVolume).toBe(0);
      expect(check.volumeText).toBe('0,00');
      expectValues(layerValues(check.canvas, 'hero'), check.expected.hero);
      expect(check.missingTargets).toEqual([]);
    });
  }

  test('the value properties are what the document says (floor frame index, volume 0..1)', async ({ page }) => {
    const check = await renderFrame(page, 33.25);
    const hero = layerValues(check.canvas, 'hero');
    expect(Number.isInteger(hero.frameIndex)).toBe(true);
    expect(hero.frameIndex).toBe(Math.floor((32.25 / 47) * 11));
    const volume = layerValues(check.audio, 'music').volume;
    expect(volume).toBeGreaterThanOrEqual(0);
    expect(volume).toBeLessThanOrEqual(1);
  });

  test('the canvas is drawn where the sprite is', async ({ page }) => {
    await renderFrame(page, 24);
    const alpha = await page.locator('#sprite-canvas').evaluate((element) => {
      const canvas = element as HTMLCanvasElement;
      const hero = window.__objectStageDemo?.expected(24).hero;
      if (hero === undefined) throw new Error('No expected values.');
      const data = canvas.getContext('2d')?.getImageData(Math.round(40 + hero.x), Math.round(100 + hero.y), 1, 1).data;
      return data === undefined ? 0 : data[3];
    });
    expect(alpha).toBe(255);
  });

  test('the HTML layer of the default stage is styled at the same frame', async ({ page }) => {
    for (const frame of [12, 30]) {
      const check = await renderFrame(page, frame);
      const banner = await page.locator('#banner').evaluate((element) => {
        const style = getComputedStyle(element);
        const matrix = new DOMMatrix(style.transform === 'none' ? undefined : style.transform);
        return { opacity: Number(style.opacity), tx: matrix.m41 };
      });
      expect(banner.opacity).toBeCloseTo(check.expected.banner.opacity, 3);
      expect(banner.tx).toBeCloseTo(check.expected.banner.x, 2);
    }
    expect((await page.locator('#banner').evaluate((element) => Number(getComputedStyle(element).opacity)))).toBe(1);
  });

  test('plays with the browser clock too, then pauses', async ({ page }) => {
    await page.goto(`${RUNTIME_DEMO_URL}/object-stage.html`);
    await expect(page.locator('#step')).toBeHidden();
    await page.locator('#play').click();
    await expect(page.locator('body')).toHaveAttribute('data-playing', 'true');
    await expect
      .poll(() => page.evaluate(() => window.__objectStageDemo?.received.canvas.length ?? 0))
      .toBeGreaterThan(2);
    await page.locator('#pause').click();
    await expect(page.locator('body')).toHaveAttribute('data-playing', 'false');
    const check = await page.evaluate(() => {
      const hook = window.__objectStageDemo;
      return { missing: hook?.player.missingTargets ?? ['no hook'], clock: hook?.clock ?? null };
    });
    expect(check.missing).toEqual([]);
    expect(check.clock).toBeNull();
  });

  test('the loop checkbox drives player.loop', async ({ page }) => {
    const loop = (): Promise<boolean | undefined> => page.evaluate(() => (window.__objectStageDemo?.player as { loop?: boolean } | undefined)?.loop);
    expect(await loop()).toBe(false);
    await page.locator('#loop').check();
    expect(await loop()).toBe(true);
    await page.locator('#loop').uncheck();
    expect(await loop()).toBe(false);
  });

  test('says the sound needs Play while paused, then follows the playback', async ({ page }) => {
    await expect(page.locator('#sound-state')).toHaveText('Son désactivé.');
    await page.locator('#sound').click();
    await expect(page.locator('#sound-state')).toHaveText('Son activé : appuyez sur Lecture pour l’entendre');
    await page.locator('#play').click();
    await expect(page.locator('#sound-state')).toHaveText('Son activé : le volume suit la piste « Musique ».');
    await page.locator('#pause').click();
    await expect(page.locator('#sound-state')).toHaveText('Son activé : appuyez sur Lecture pour l’entendre');
  });

  test('links to the other runtime demo and back', async ({ page }) => {
    await page.getByRole('link', { name: /Démo du lecteur runtime/ }).click();
    await expect(page).toHaveURL(/index[.]html$/);
    await page.getByRole('link', { name: /scène sans HTML animé/ }).click();
    await expect(page).toHaveURL(/object-stage[.]html$/);
  });

  test('steps one frame at a time with the manual clock', async ({ page }) => {
    await page.locator('#step').click();
    await page.locator('#step').click();
    await expect(page.locator('#frame')).toHaveText('Image 3 / 48');
    const last = await page.evaluate(() => (window.__objectStageDemo?.received.canvas ?? []).reduce((_, item) => item.frame, 0));
    expect(last).toBeCloseTo(3, 6);
  });
});
