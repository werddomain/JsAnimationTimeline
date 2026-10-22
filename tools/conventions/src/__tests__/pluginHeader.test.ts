// tools/conventions/src/__tests__/pluginHeader.test.ts
import { checkPluginHeader, parseList, parsePluginHeader } from '../pluginHeader';

const REL = 'packages/editor/src/plugins/layers/color/LayerColorPlugin.ts';

function plugin(header: string, body: string): string {
  return `// ${REL}\n/**\n${header}\n */\n${body}\n`;
}

const GOOD_HEADER = [
  ' * Plugin : layers.color',
  ' * Epic : layers',
  ' * Dépend de : core, layers.list',
  ' * Écoute : layer:added, layer:selected',
  ' * Émet : layer:colorChanged'
].join('\n');

const GOOD_BODY = `export class P {
  readonly id = 'layers.color';
  readonly dependencies = ['layers.list', 'core'];
}`;

describe('parseList', () => {
  it.each(['', '—', '-', 'aucune', 'None', '  '])('treats %j as empty', (v) => {
    expect(parseList(v)).toEqual([]);
  });
  it('splits on commas', () => {
    expect(parseList('a, b ,c')).toEqual(['a', 'b', 'c']);
  });
});

describe('parsePluginHeader', () => {
  it('returns null for a non-plugin file', () => {
    expect(parsePluginHeader(`// ${REL}\n/** Simple doc. */\nexport {};`)).toBeNull();
    expect(parsePluginHeader(`// ${REL}\nexport {};`)).toBeNull();
  });

  it('parses French keys', () => {
    const parsed = parsePluginHeader(plugin(GOOD_HEADER, ''));
    expect(parsed?.header).toEqual({
      plugin: 'layers.color',
      epic: 'layers',
      dependsOn: ['core', 'layers.list'],
      listens: ['layer:added', 'layer:selected'],
      emits: ['layer:colorChanged']
    });
  });

  it('accepts English aliases and optional space before the colon', () => {
    const header = ' * Plugin: a.b\n * Depends on: core\n * Listens : x\n * Emits: none';
    const parsed = parsePluginHeader(plugin(header, ''));
    expect(parsed?.header.dependsOn).toEqual(['core']);
    expect(parsed?.header.listens).toEqual(['x']);
    expect(parsed?.header.emits).toEqual([]);
  });
});

describe('checkPluginHeader', () => {
  it('ignores non-plugin files', () => {
    expect(checkPluginHeader(REL, `// ${REL}\nexport {};`)).toEqual([]);
  });

  it('accepts a consistent plugin (order-insensitive)', () => {
    expect(checkPluginHeader(REL, plugin(GOOD_HEADER, GOOD_BODY))).toEqual([]);
  });

  it('accepts typed field declarations and object-literal style', () => {
    const body = `const p = { id: 'layers.color', dependencies: ['core', 'layers.list'] };`;
    expect(checkPluginHeader(REL, plugin(GOOD_HEADER, body))).toEqual([]);
    const typed =
      `class P { readonly id: string = 'layers.color'; ` +
      `readonly dependencies: string[] = ['core','layers.list']; }`;
    expect(checkPluginHeader(REL, plugin(GOOD_HEADER, typed))).toEqual([]);
  });

  it('accepts empty dependencies with a dash', () => {
    const header = ' * Plugin : core\n * Dépend de : —';
    const body = `class P { readonly id = 'core'; readonly dependencies: string[] = []; }`;
    expect(checkPluginHeader(REL, plugin(header, body))).toEqual([]);
  });

  it('reports an id mismatch with expected and actual', () => {
    const body = GOOD_BODY.replace("'layers.color'", "'layers.colour'");
    const v = checkPluginHeader(REL, plugin(GOOD_HEADER, body));
    expect(v).toHaveLength(1);
    expect(v[0]?.message).toContain('layers.color');
    expect(v[0]?.message).toContain('layers.colour');
  });

  it('reports a dependencies mismatch', () => {
    const body = GOOD_BODY.replace(", 'core'", '');
    const v = checkPluginHeader(REL, plugin(GOOD_HEADER, body));
    expect(v).toHaveLength(1);
    expect(v[0]?.message).toContain('[core, layers.list]');
    expect(v[0]?.message).toContain('[layers.list]');
  });

  it('reports missing id and dependencies', () => {
    expect(checkPluginHeader(REL, plugin(GOOD_HEADER, 'export {};'))).toHaveLength(2);
  });

  it('requires the "Dépend de" key', () => {
    const v = checkPluginHeader(REL, plugin(' * Plugin : layers.color', GOOD_BODY));
    expect(v.some((x) => x.message.includes('Dépend de'))).toBe(true);
  });

  it('rejects non-literal dependencies', () => {
    const body =
      `class P { readonly id = 'layers.color'; readonly dependencies = [CORE, 'layers.list']; }`;
    const v = checkPluginHeader(REL, plugin(GOOD_HEADER, body));
    expect(v.some((x) => x.message.includes('littérales'))).toBe(true);
  });
});
