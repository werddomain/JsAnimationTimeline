// tools/conventions/src/collectFiles.ts
import * as fs from 'fs';
import * as path from 'path';

const IGNORED_DIRS = new Set(['node_modules', 'coverage']);

function isIgnoredDir(name: string): boolean {
  return IGNORED_DIRS.has(name) || name.startsWith('dist');
}

function walk(absDir: string, relDir: string, out: string[]): void {
  if (!fs.existsSync(absDir)) return;
  for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
    const rel = `${relDir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (!isIgnoredDir(entry.name)) walk(path.join(absDir, entry.name), rel, out);
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      out.push(rel);
    }
  }
}

/**
 * Liste les fichiers .ts (y compris .d.ts) de packages/<pkg>/src, tools et e2e,
 * en chemins relatifs à la racine, séparateur « / », triés.
 */
export function collectTsFiles(repoRoot: string): string[] {
  const out: string[] = [];
  const packagesDir = path.join(repoRoot, 'packages');
  if (fs.existsSync(packagesDir)) {
    for (const pkg of fs.readdirSync(packagesDir, { withFileTypes: true })) {
      if (pkg.isDirectory()) {
        walk(path.join(packagesDir, pkg.name, 'src'), `packages/${pkg.name}/src`, out);
      }
    }
  }
  walk(path.join(repoRoot, 'tools'), 'tools', out);
  walk(path.join(repoRoot, 'e2e'), 'e2e', out);
  return out.sort();
}
