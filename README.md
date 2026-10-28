<!-- README.md -->
# JsAnimationTimeline

A TypeScript monorepo for animation timelines, with a runtime, a plugin-based editor and CSS export. The editor v2 replaces the former `JsTimeLine` control. Existing v1 documents can be imported through the v2 persistence plugin.

## Getting started

```sh
npm ci
npm run build
npm test
npm run dev
```

`npm run dev` serves the editor demo at http://localhost:9002. `npm run dev:validation` serves the runtime and validation demos at http://localhost:9001. Set `E2E_V2_EDITOR_PORT` and `E2E_RUNTIME_PORT` to use other distinct ports.

## Editor API

```ts
import { createEditor } from '@werddomain/timeline-editor';

const host = document.getElementById('editor-host');
if (!host) throw new Error('Editor host missing');
const editor = createEditor(host);

// Dispose when the host is no longer needed.
editor.destroy();
```

See `demo/editor/src/main.ts` for a document and optional properties plugin, and `demo/editor/src/scene.ts` for a scene example. The editor publishes its stylesheet as `@werddomain/timeline-editor/timeline-editor.css`.

## Demos and checks

```sh
npm run build:demo
npm run typecheck
npm run lint
npm run test:e2e
```

Playwright serves the built editor and runtime demos; install Chromium once with `npx playwright install chromium`. See [e2e/README.md](e2e/README.md) for ports and browser tests. Runtime validation pages and fixtures are in `demo/runtime`. Historical v1 tests and demo sources are preserved under `archive/`.

## Packages

- `packages/runtime`: animation evaluation and playback.
- `packages/editor`: timeline editor and plugins.
- `packages/export-css`: CSS animation export.
- `dotnet/JsTimeline.Blazor`: Blazor integration.

MIT licensed.
