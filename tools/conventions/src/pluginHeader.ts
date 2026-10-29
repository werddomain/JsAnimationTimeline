// tools/conventions/src/pluginHeader.ts
import type { Violation } from './types';

/** En-tête de plugin analysé (listes vides si la valeur est « — », « none », etc.). */
export interface PluginHeader {
  readonly plugin: string;
  readonly epic: string | null;
  readonly dependsOn: string[] | null;
  readonly listens: string[];
  readonly emits: string[];
}

type HeaderKey = 'plugin' | 'epic' | 'dependsOn' | 'listens' | 'emits';

const KEY_ALIASES: ReadonlyArray<readonly [HeaderKey, readonly string[]]> = [
  ['plugin', ['plugin']],
  ['epic', ['epic']],
  ['dependsOn', ['dépend de', 'depend de', 'depends on']],
  ['listens', ['écoute', 'ecoute', 'listens']],
  ['emits', ['émet', 'emet', 'emits']]
];

const EMPTY_MARKERS = new Set(['', '—', '-', 'aucune', 'aucun', 'none']);

function keyFor(rawKey: string): HeaderKey | null {
  const lower = rawKey.trim().toLowerCase();
  for (const [key, aliases] of KEY_ALIASES) {
    if (aliases.includes(lower)) return key;
  }
  return null;
}

/** Découpe une valeur « a, b » en liste ; les marqueurs « vide » donnent []. */
export function parseList(value: string): string[] {
  const trimmed = value.trim();
  if (EMPTY_MARKERS.has(trimmed.toLowerCase())) return [];
  return trimmed
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

/** Retourne le texte du bloc doc suivant la ligne de chemin, et la position de fin. */
function extractHeaderBlock(content: string): { text: string; end: number } | null {
  const afterFirstLine = content.indexOf('\n');
  if (afterFirstLine < 0) return null;
  const rest = content.slice(afterFirstLine + 1);
  const match = /^\s*\/\*\*([\s\S]*?)\*\//.exec(rest);
  if (!match) return null;
  return { text: match[1] ?? '', end: afterFirstLine + 1 + match[0].length };
}

/**
 * Analyse l'en-tête d'un fichier. Retourne null si le fichier n'est pas un
 * plugin (pas de bloc doc, ou pas de ligne « Plugin : »).
 */
export function parsePluginHeader(
  content: string
): { header: PluginHeader; bodyStart: number } | null {
  const block = extractHeaderBlock(content);
  if (!block) return null;
  const values: Partial<Record<HeaderKey, string>> = {};
  for (const line of block.text.split(/\r?\n/)) {
    const m = /^\s*\*?\s*([^:*]+?)\s*:\s*(.*?)\s*$/.exec(line);
    if (!m) continue;
    const key = keyFor(m[1] ?? '');
    if (key && values[key] === undefined) values[key] = m[2] ?? '';
  }
  if (values.plugin === undefined) return null;
  return {
    bodyStart: block.end,
    header: {
      plugin: values.plugin.trim(),
      epic: values.epic === undefined ? null : values.epic.trim(),
      dependsOn: values.dependsOn === undefined ? null : parseList(values.dependsOn),
      listens: parseList(values.listens ?? ''),
      emits: parseList(values.emits ?? '')
    }
  };
}

const ID_PATTERN = /\bid\s*(?::\s*string\s*)?[:=]\s*(['"`])([^'"`]*)\1/;
const DEPS_PATTERN =
  /\bdependencies\s*(?::\s*(?:readonly\s+)?[\w.<>]+(?:\[\s*\])?\s*=|[:=])\s*\[([^\]]*)\]/;

/** Extrait l'identifiant déclaré dans le code (`id = '...'` ou `id: '...'`). */
export function extractDeclaredId(body: string): string | null {
  return ID_PATTERN.exec(body)?.[2] ?? null;
}

/** Extrait le tableau `dependencies` ; `invalid` signale un élément non littéral. */
export function extractDeclaredDependencies(
  body: string
): { values: string[]; invalid: boolean } | null {
  const m = DEPS_PATTERN.exec(body);
  if (!m) return null;
  const inner = m[1] ?? '';
  const values: string[] = [];
  const literal = /(['"`])([^'"`]*)\1/g;
  let found: RegExpExecArray | null;
  while ((found = literal.exec(inner)) !== null) values.push(found[2] ?? '');
  const leftover = inner.replace(literal, '').replace(/[\s,]/g, '');
  return { values, invalid: leftover.length > 0 };
}

function sortedUnique(list: readonly string[]): string[] {
  return Array.from(new Set(list)).sort();
}

function fmt(list: readonly string[]): string {
  return `[${list.join(', ')}]`;
}

/** Règle B : cohérence entre l'en-tête de plugin et le code déclaré. */
export function checkPluginHeader(relPath: string, content: string): Violation[] {
  const parsed = parsePluginHeader(content);
  if (!parsed) return [];
  const { header, bodyStart } = parsed;
  const body = content.slice(bodyStart);
  const violations: Violation[] = [];
  const fail = (message: string): void => {
    violations.push({ file: relPath, rule: 'plugin-header', message });
  };

  if (header.plugin === '') fail('valeur "Plugin" vide dans l\'en-tête');
  if (header.dependsOn === null) fail('clé "Dépend de" (ou "Depends on") requise dans l\'en-tête');

  const id = extractDeclaredId(body);
  if (id === null) {
    fail(`id introuvable dans le code (attendu "${header.plugin}")`);
  } else if (id !== header.plugin) {
    fail(`id attendu "${header.plugin}" (en-tête), trouvé "${id}" (code)`);
  }

  const deps = extractDeclaredDependencies(body);
  if (deps === null) {
    fail('tableau littéral "dependencies" introuvable dans le code');
  } else if (deps.invalid) {
    fail('"dependencies" doit contenir uniquement des chaînes littérales');
  } else if (header.dependsOn !== null) {
    const expected = sortedUnique(header.dependsOn);
    const actual = sortedUnique(deps.values);
    if (fmt(expected) !== fmt(actual)) {
      fail(`dependencies attendu ${fmt(expected)} (en-tête), trouvé ${fmt(actual)} (code)`);
    }
  }
  return violations;
}
