// tools/conventions/src/__tests__/collectFiles.test.ts
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { collectTsFiles } from '../collectFiles';

describe('collectTsFiles', () => {
  let root: string;

  function touch(rel: string): void {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, '');
  }

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'conv-'));
  });
  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('collects .ts and .d.ts under packages/*/src, tools and e2e only', () => {
    touch('packages/a/src/x.ts');
    touch('packages/a/src/sub/y.d.ts');
    touch('packages/a/src/readme.md');
    touch('packages/a/other/z.ts');
    touch('packages/a/src/node_modules/m.ts');
    touch('tools/t/src/dist/skip.ts');
    touch('tools/t/node_modules/skip.ts');
    touch('tools/t/src/ok.ts');
    touch('tools/t/coverage/skip.ts');
    touch('e2e/spec.ts');
    touch('dist-demo/skip.ts');
    expect(collectTsFiles(root)).toEqual([
      'e2e/spec.ts',
      'packages/a/src/sub/y.d.ts',
      'packages/a/src/x.ts',
      'tools/t/src/ok.ts'
    ]);
  });

  it('also collects demo/*/src/**/*.ts and demo/*/*.ts, like ESLint, skipping dist* and node_modules', () => {
    touch('demo/runtime/vite.config.ts');
    touch('demo/runtime/src/main.ts');
    touch('demo/runtime/src/objectStage/stage.ts');
    touch('demo/runtime/src/vite-env.d.ts');
    touch('demo/runtime/dist/assets/skip.ts');
    touch('demo/runtime/src/dist-demo/skip.ts');
    touch('demo/runtime/node_modules/pkg/skip.ts');
    touch('demo/runtime/other/skip.ts');
    touch('demo/readme.ts');
    touch('demo/editor/src/app.ts');
    touch('demo/node_modules/pkg/src/skip.ts');
    touch('demo/dist-x/src/skip.ts');
    expect(collectTsFiles(root)).toEqual([
      'demo/editor/src/app.ts',
      'demo/runtime/src/main.ts',
      'demo/runtime/src/objectStage/stage.ts',
      'demo/runtime/src/vite-env.d.ts',
      'demo/runtime/vite.config.ts'
    ]);
  });

  it('returns an empty list when nothing exists', () => {
    expect(collectTsFiles(root)).toEqual([]);
  });
});
