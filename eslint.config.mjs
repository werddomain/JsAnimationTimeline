// eslint.config.mjs
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

const LEGACY = ['packages/editor/src/legacy/**/*.ts'];

/** Passe toutes les règles « error » d'un jeu de règles en « warn ». */
function downgradeToWarn(rules) {
  return Object.fromEntries(
    Object.entries(rules).map(([name, setting]) => {
      const level = Array.isArray(setting) ? setting[0] : setting;
      const isError = level === 'error' || level === 2;
      if (!isError) return [name, setting];
      return [name, Array.isArray(setting) ? ['warn', ...setting.slice(1)] : 'warn'];
    })
  );
}

const recommendedTs = tseslint.configs.recommended;
const tsRules = Object.assign({}, ...recommendedTs.map((c) => c.rules ?? {}));

export default tseslint.config(
  { ignores: ['**/dist/**', '**/dist-demo/**', '**/coverage/**', '**/node_modules/**'] },
  {
    files: ['packages/*/src/**/*.ts', 'tools/**/*.ts', 'e2e/**/*.ts'],
    extends: [js.configs.recommended, ...recommendedTs],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: { '@typescript-eslint/no-explicit-any': 'error' }
  },
  {
    // Code v1 : non modifiable, donc les règles en erreur sont rétrogradées en avertissement.
    files: LEGACY,
    rules: {
      ...downgradeToWarn(js.configs.recommended.rules),
      ...downgradeToWarn(tsRules),
      '@typescript-eslint/no-explicit-any': 'warn'
    }
  }
);
