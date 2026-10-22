// tools/conventions/src/pathHeader.ts
import type { Violation } from './types';

/** Chemin exempté de la règle A (code v1 conservé tel quel). */
const LEGACY_PREFIX = 'packages/editor/src/legacy/';

/** Vrai si le fichier est exempté de la règle de l'en-tête de chemin. */
export function isPathHeaderExempt(relPath: string): boolean {
  return relPath.startsWith(LEGACY_PREFIX);
}

/** Règle A : la première ligne doit être exactement « // <chemin relatif> ». */
export function checkPathHeader(relPath: string, content: string): Violation[] {
  if (isPathHeaderExempt(relPath)) return [];
  const withoutBom = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
  const firstLine = withoutBom.split(/\r?\n/, 1)[0] ?? '';
  const expected = `// ${relPath}`;
  if (firstLine === expected) return [];
  return [
    {
      file: relPath,
      rule: 'path-header',
      message: `première ligne attendue "${expected}", trouvée "${firstLine}"`
    }
  ];
}
