// e2e/pages/pages.test.ts
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const site = path.resolve(__dirname, '../../dist/pages');
let server: Server;
let origin: string;

test.beforeAll(async () => {
  server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const relative = url.pathname.replace(/^\/JsAnimationTimeline(?=\/)/, '').replace(/^\//, '');
    const filename = path.resolve(site, relative.endsWith('/') || !relative ? `${relative}index.html` : relative);
    if (!filename.startsWith(`${site}${path.sep}`)) { response.writeHead(403).end(); return; }
    try {
      const body = await readFile(filename);
      const contentType = filename.endsWith('.html') ? 'text/html' : filename.endsWith('.js') ? 'text/javascript' : filename.endsWith('.css') ? 'text/css' : 'application/octet-stream';
      response.writeHead(200, { 'Content-Type': contentType }).end(body);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Server did not start');
  origin = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); });

for (const prefix of ['', '/JsAnimationTimeline']) {
  test(`built site works under ${prefix || 'domain root'}`, async ({ page }) => {
    const failures: string[] = [];
    page.on('pageerror', (error) => failures.push(error.message));
    page.on('response', (response) => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`); });
    await page.goto(`${origin}${prefix}/`);
    await expect(page.getByRole('heading', { name: 'JsAnimationTimeline' })).toBeVisible();
    await page.getByRole('link', { name: 'Démo de l’éditeur', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Éditeur de timeline' })).toBeVisible();
    await expect(page.locator('.jt-shell')).toBeVisible();
    await page.goto(`${origin}${prefix}/`);
    await page.getByRole('link', { name: 'Démo du lecteur', exact: true }).click();
    await expect(page.locator('#frame')).toHaveText('Image 1 / 48');
    await page.locator('#seek').fill('25');
    await expect(page.locator('#frame')).toHaveText('Image 25 / 48');
    await expect.poll(() => page.locator('#logo').evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41)).toBeCloseTo(300 * 24 / 47, 2);
    for (const pagePath of ['editor/scene.html', 'runtime/object-stage.html', 'runtime/validation-phase3.html', 'runtime/validation-phase4.html', 'runtime/validation-phase5.html', 'runtime/validation-phase7.html', 'runtime/fixtures/context-menu.html', 'runtime/fixtures/easing.html', 'runtime/fixtures/property-api.html', 'runtime/fixtures/property-keyframes.html', 'runtime/fixtures/properties-panel.html']) {
      const response = await page.goto(`${origin}${prefix}/${pagePath}`);
      expect(response?.status(), pagePath).toBe(200);
      await page.waitForLoadState('networkidle');
    }
    expect(failures).toEqual([]);
  });
}
