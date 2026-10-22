// tools/conventions/src/__tests__/repo.test.ts
import * as fs from 'fs';
import * as path from 'path';
import { checkRepo, formatViolations } from '../checkRepo';

/** Remonte depuis __dirname jusqu'au dossier contenant packages/ et tools/conventions. */
function findRepoRoot(start: string): string {
  let dir = start;
  for (;;) {
    if (
      fs.existsSync(path.join(dir, 'packages')) &&
      fs.existsSync(path.join(dir, 'tools', 'conventions'))
    ) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error('Racine du dépôt introuvable');
    dir = parent;
  }
}

describe('repository conventions', () => {
  it('has no path-header or plugin-header violation', () => {
    const violations = checkRepo(findRepoRoot(__dirname));
    expect(formatViolations(violations)).toBe('');
  });
});
