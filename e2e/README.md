# e2e

Playwright (Chromium) end-to-end tests, run against the BUILT demo pages.

## Layout

Specs live in `e2e/<area>/*.spec.ts` (`testDir` is `./`, `testMatch` is `**/*.spec.ts`).
Current area: `demo/`. Planned areas: `runtime/`, `editor/`, `export-css/`.
Every `.ts` file starts with its repo-relative path comment.

## Running

```bash
npm ci
npx playwright install chromium        # once (add --with-deps on Linux)
npm run build:demo                     # REQUIRED: tests serve packages/editor/dist-demo
npm run test:e2e
```

The web server (`npm run preview:demo --workspace packages/editor`, port 9000) is started
by Playwright and reused locally when already running. Reports go to `e2e/playwright-report/`.
The workspace has no `test` script on purpose so the root `npm test` does not run it.
