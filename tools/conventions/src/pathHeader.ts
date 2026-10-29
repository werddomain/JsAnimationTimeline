// tools/conventions/src/pathHeader.ts
import type { Violation } from './types';

/** Règle A : la première ligne doit être exactement « // <chemin relatif> ». */
export function checkPathHeader(relPath: string, content: string): Violation[] {
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
