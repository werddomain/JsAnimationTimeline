// tools/devPorts.ts
/**
 * Ports des serveurs de démo (dev et preview), seule source pour les
 * configurations Vite et pour Playwright.
 *
 * Chaque dossier de travail qui lance les tests e2e en parallèle choisit sa
 * paire de ports par l'environnement, par exemple :
 *
 * ```bash
 * E2E_EDITOR_PORT=9100 E2E_RUNTIME_PORT=9101 npm run test:e2e
 * ```
 *
 * Sans variable, les ports par défaut restent 9000 (démo de l'éditeur) et
 * 9001 (démo du runtime). Les serveurs démarrent avec `strictPort` : un port
 * déjà pris fait échouer le démarrage au lieu d'en choisir un autre.
 */

/** Port par défaut de la démo de l'éditeur (packages/editor). */
export const DEFAULT_EDITOR_PORT = 9000;

/** Port par défaut de la démo du runtime (demo/runtime). */
export const DEFAULT_RUNTIME_PORT = 9001;

/** Variable d'environnement du port de la démo de l'éditeur. */
export const EDITOR_PORT_ENV = 'E2E_EDITOR_PORT';

/** Variable d'environnement du port de la démo du runtime. */
export const RUNTIME_PORT_ENV = 'E2E_RUNTIME_PORT';

/** Variables d'environnement lues (par défaut, celles du processus). */
type Env = Record<string, string | undefined>;

/**
 * Port lu dans `env[name]`, ou `fallback` si la variable est absente ou vide.
 *
 * @throws Error si la valeur n'est pas un entier de 1 à 65535.
 */
export function portFromEnv(name: string, fallback: number, env: Env = process.env): number {
  const raw = env[name]?.trim();
  if (raw === undefined || raw === '') return fallback;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${name} doit être un port entier de 1 à 65535 (reçu : « ${raw} »).`);
  }
  return port;
}

/** Port de la démo de l'éditeur (`E2E_EDITOR_PORT`, 9000 par défaut). */
export function editorPort(env: Env = process.env): number {
  return portFromEnv(EDITOR_PORT_ENV, DEFAULT_EDITOR_PORT, env);
}

/** Port de la démo du runtime (`E2E_RUNTIME_PORT`, 9001 par défaut). */
export function runtimePort(env: Env = process.env): number {
  return portFromEnv(RUNTIME_PORT_ENV, DEFAULT_RUNTIME_PORT, env);
}
