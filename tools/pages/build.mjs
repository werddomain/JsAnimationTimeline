// tools/pages/build.mjs
import { cp, lstat, mkdir, realpath, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = await realpath(fileURLToPath(new URL('../../', import.meta.url)));
const dist = path.join(root, 'dist');
const output = path.join(dist, 'pages');
await mkdir(dist, { recursive: true });
if ((await lstat(dist)).isSymbolicLink() || await realpath(dist) !== dist) {
  throw new Error('The dist directory must not be a link or reparse point');
}
try {
  if ((await lstat(output)).isSymbolicLink() || await realpath(output) !== output) {
    throw new Error('The Pages output must not be a link or reparse point');
  }
  await rm(output, { recursive: true });
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}
await mkdir(output);
await cp(new URL('index.html', import.meta.url), path.join(output, 'index.html'));
for (const demo of ['editor', 'runtime']) {
  await cp(new URL(`../../demo/${demo}/dist/`, import.meta.url), path.join(output, demo), { recursive: true });
}
