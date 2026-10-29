// tools/conventions/src/checkRepo.ts
import * as fs from 'fs';
import * as path from 'path';
import { collectTsFiles } from './collectFiles';
import { checkPathHeader } from './pathHeader';
import { checkPluginHeader } from './pluginHeader';
import type { Violation } from './types';

/** Vérifie toutes les règles sur les fichiers d'un dépôt réel. */
export function checkRepo(repoRoot: string): Violation[] {
  const violations: Violation[] = [];
  for (const rel of collectTsFiles(repoRoot)) {
    const content = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
    violations.push(...checkPathHeader(rel, content), ...checkPluginHeader(rel, content));
  }
  return violations;
}

/** Met en forme les violations, une par ligne. */
export function formatViolations(violations: readonly Violation[]): string {
  return violations.map((v) => `${v.file} [${v.rule}] ${v.message}`).join('\n');
}
