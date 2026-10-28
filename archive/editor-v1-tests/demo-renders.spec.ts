// e2e/demo/demo-renders.spec.ts
import { expect, test } from '@playwright/test';

test.describe('demo page', () => {
  test('renders the timeline without console or page errors', async ({ page }) => {
    const problems: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(`console: ${message.text()}`);
    });
    page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));

    await page.goto('/');

    const timeline = page.locator('#timeline-container .JsTimeLine, #timeline-container.JsTimeLine');
    await expect(timeline).toBeVisible();

    const layerNames = timeline.locator('.layer-name');
    for (const name of ['Background', 'Character', 'Head', 'Body', 'Foreground']) {
      await expect(layerNames.getByText(name, { exact: true })).toBeVisible();
    }

    await expect(timeline.locator('.timeline-ruler')).toBeVisible();
    await expect(timeline.locator('.timeline-ruler .ruler-tick').first()).toBeAttached();
    await expect(timeline.locator('.timeline-playhead')).toBeAttached();

    expect(problems).toEqual([]);
  });
});
