// eslint.config.mjs
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

const recommendedTs = tseslint.configs.recommended;

export default tseslint.config(
  { ignores: ['**/dist/**', '**/dist-demo/**', '**/coverage/**', '**/node_modules/**', 'dotnet/**/bin/**', 'dotnet/**/obj/**', 'dotnet/**/wwwroot/js/**'] },
  {
    files: ['packages/*/src/**/*.ts', 'tools/**/*.ts', 'e2e/**/*.ts', 'demo/*/src/**/*.ts', 'demo/*/*.ts', 'dotnet/*.JsTests/src/**/*.ts'],
    extends: [js.configs.recommended, ...recommendedTs],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: { '@typescript-eslint/no-explicit-any': 'error' }
  },
  {
    // Modules JavaScript livrés par la bibliothèque Blazor (pas de TypeScript dans dotnet/).
    files: ['dotnet/**/*.js'],
    ignores: ['dotnet/**/jest.config.js'],
    extends: [js.configs.recommended],
    languageOptions: { sourceType: 'module', globals: { ...globals.browser } }
  },
);
