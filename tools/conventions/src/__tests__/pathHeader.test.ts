// tools/conventions/src/__tests__/pathHeader.test.ts
import { checkPathHeader } from '../pathHeader';

describe('checkPathHeader', () => {
  const rel = 'packages/runtime/src/a.ts';

  it('accepts a correct first line', () => {
    expect(checkPathHeader(rel, `// ${rel}\nexport {};\n`)).toEqual([]);
  });

  it('accepts CRLF line endings', () => {
    expect(checkPathHeader(rel, `// ${rel}\r\nexport {};\r\n`)).toEqual([]);
  });

  it('rejects a missing header', () => {
    const v = checkPathHeader(rel, 'export {};\n');
    expect(v).toHaveLength(1);
    expect(v[0]?.message).toContain(`// ${rel}`);
  });

  it('rejects a wrong path', () => {
    expect(checkPathHeader(rel, '// packages/runtime/src/b.ts\n')).toHaveLength(1);
  });

  it('rejects a header that is not on the first line', () => {
    expect(checkPathHeader(rel, `\n// ${rel}\n`)).toHaveLength(1);
  });

  it('rejects an empty file', () => {
    expect(checkPathHeader(rel, '')).toHaveLength(1);
  });

  it('exempts legacy files', () => {
    expect(checkPathHeader('packages/editor/src/legacy/x.ts', 'export {};')).toEqual([]);
  });
});
