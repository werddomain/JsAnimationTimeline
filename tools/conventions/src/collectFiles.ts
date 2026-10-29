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

/** Sous-dossiers de `dir` (aucun s'il n'existe pas). */
function subDirs(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !isIgnoredDir(entry.name))
    .map((entry) => entry.name);
}

/** Fichiers .ts posés directement dans `absDir` (sans descendre). */
function topLevelTs(absDir: string, relDir: string, out: string[]): void {
  for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.ts')) out.push(`${relDir}/${entry.name}`);
  }
}

/**
 * Liste les fichiers .ts (y compris .d.ts) de packages/<pkg>/src, tools, e2e
 * et des démos (demo/<démo>/src et les .ts posés dans demo/<démo>, comme les
 * globs d'ESLint), en chemins relatifs à la racine, séparateur « / », triés.
 * Les dossiers dist*, node_modules et coverage sont ignorés.
 */
export function collectTsFiles(repoRoot: string): string[] {
  const out: string[] = [];
  const packagesDir = path.join(repoRoot, 'packages');
  for (const pkg of subDirs(packagesDir)) {
    walk(path.join(packagesDir, pkg, 'src'), `packages/${pkg}/src`, out);
  }
  walk(path.join(repoRoot, 'tools'), 'tools', out);
  walk(path.join(repoRoot, 'e2e'), 'e2e', out);
  const demoDir = path.join(repoRoot, 'demo');
  for (const demo of subDirs(demoDir)) {
    topLevelTs(path.join(demoDir, demo), `demo/${demo}`, out);
    walk(path.join(demoDir, demo, 'src'), `demo/${demo}/src`, out);
  }
  return out.sort();
}
