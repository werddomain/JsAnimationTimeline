<!-- e2e/blazor-sample/README.md -->
# Tests navigateur de l’exemple Blazor

Construire d’abord les paquets npm (`npm run build`), puis lancer l’application et Chromium avec :

```powershell
$env:CI = '1'
$env:E2E_BLAZOR_SAMPLE_PORT = '9138' # port libre propre à ce worktree
npx playwright test --config e2e/blazor-sample/playwright.config.ts
```

La configuration démarre son propre serveur et ne réutilise jamais un serveur existant. Playwright l’arrête à la fin du test.
