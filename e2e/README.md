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

Playwright starts both demo servers itself (`npm run preview:demo` in `packages/editor`
and `demo/runtime`). Reports go to `e2e/playwright-report/`.

## Ports

The ports come from the environment, read by `tools/devPorts.ts` (the only place that knows
them, used by the Vite configs and by Playwright):

| Variable | Default | Server |
|---|---|---|
| `E2E_EDITOR_PORT` | 9000 | editor demo (`packages/editor`, `dev` and `preview:demo`) |
| `E2E_RUNTIME_PORT` | 9001 | runtime demo (`demo/runtime`, `dev` and `preview:demo`) |

Each worktree that runs the e2e tests at the same time as another one sets its own pair
(the two ports must differ):

```bash
# bash / zsh: for this command only
E2E_EDITOR_PORT=9100 E2E_RUNTIME_PORT=9101 npm run test:e2e   # worktree 1
E2E_EDITOR_PORT=9200 E2E_RUNTIME_PORT=9201 npm run test:e2e   # worktree 2
```

```powershell
# PowerShell: the variables last for the whole terminal session
$env:E2E_EDITOR_PORT='9100'; $env:E2E_RUNTIME_PORT='9101'; npm run test:e2e
```

```bat
:: cmd: the variables last for the whole terminal session (no space before &&)
set E2E_EDITOR_PORT=9100&& set E2E_RUNTIME_PORT=9101&& npm run test:e2e
```

Values must be plain digits from 1 to 65535 (`9e3`, `0x2328` or `9000.0` are refused).

The servers use `strictPort`, and Playwright does not reuse a server that is already running:
a busy port fails with "is already used" instead of silently testing another worktree's build.
To reuse your own running servers during local development, set `E2E_REUSE_SERVER=1`
(ignored in CI).
The workspace has no `test` script on purpose so the root `npm test` does not run it.
