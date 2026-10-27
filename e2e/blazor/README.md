<!-- e2e/blazor/README.md -->
# Blazor editor browser tests

Build the npm packages first (`npm run build`). Run the isolated host and Chromium tests with:

```powershell
$env:CI = '1'
$env:E2E_BLAZOR_PORT = '9137' # choose a free port for each worktree
npx playwright test --config e2e/blazor/playwright.config.ts
```

The configuration always starts its own process and never reuses an existing server. It stops the host when Playwright exits. The host is a test fixture, not an example application. Its import map resolves the editor's external runtime module; both are served by the Razor class library. The dedicated configuration avoids starting the demo servers or publishing an application.
