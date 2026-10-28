<!-- README.md -->
# JsAnimationTimeline

JsAnimationTimeline is a TypeScript monorepo for creating and playing frame-based animations. Version 2 includes a plugin-based timeline editor, a runtime player, and CSS export. The editor package also retains the legacy v1 API during migration.

The official [GitHub Pages demo](https://kazo-ca.github.io/JsAnimationTimeline/) is the intended public address; it becomes available after the Pages workflow has successfully deployed. The demos currently use French labels.

## Try the demos locally

Use Node.js 22 and npm from the repository root:

```sh
npm ci
npm run build:demo
node tools/pages/build.mjs
npx playwright test --config e2e/pages/playwright.config.ts
```

The assembled static site is in `dist/pages`. Serve that directory with a static HTTP server to open its landing page. It links to the v2 editor, an editor canvas/audio scene, the runtime player, and an object-stage example. The build also includes the runtime validation pages and fixtures. The Pages test serves the assembled site at both a domain root and a repository subpath.

For development, run `npm run dev --workspace demo/editor` or `npm run dev --workspace demo/runtime`. See [the editor demo](demo/editor/README.md) and [browser tests](e2e/README.md) for ports and further instructions.

## Using v2

The workspaces are `packages/runtime`, `packages/editor`, and `packages/export-css`. The demos consume their source via Vite aliases; package publishing is not implied by this repository setup. Use a bundler configured to resolve the workspace packages. For example, an editor host can create an editor and release it when finished:

```ts
import { createEditor, createPropertiesPanelPlugin } from '@werddomain/timeline-editor';

const host = document.getElementById('editor-host');
if (!host) throw new Error('Editor host missing');
const editor = createEditor(host, { plugins: [createPropertiesPanelPlugin()] });
// Use editor.toJSON(), editor.load(document), or editor.playback as needed.
// Call editor.destroy() when the host is removed.
```

To play a v2 document without the editor, use `createPlayer(document, { root })` from `@werddomain/timeline-runtime`; the player exposes methods such as `play()`, `pause()`, and `seek(frame)`. See [the runtime demo](demo/runtime/src/main.ts) and [its example document](demo/runtime/src/animation.ts) for a working integration. The [editor demo](demo/editor/src/main.ts) shows an editor with sample data, and [the scene demo](demo/editor/src/scene.ts) shows canvas and audio integration. `@werddomain/timeline-export-css` exports `exportCss` for generating CSS from supported document properties.

## Development and checks

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run build:demo
npm run test:e2e
```

The repository also contains a .NET/Blazor integration in `dotnet/`. See its project files and tests for usage. GitHub Actions deploys the static demo on pushes to `main` or a manual workflow dispatch; a successful deployment is required before the public URL reflects a change.

## License

[MIT](LICENSE)
