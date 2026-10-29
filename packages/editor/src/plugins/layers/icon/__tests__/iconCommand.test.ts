// packages/editor/src/plugins/layers/icon/__tests__/iconCommand.test.ts
import { findNodeById } from '@kazo-ca/timeline-runtime';
import { BUILTIN_LAYER_ICONS } from '../../list/layerIcon';
import { doc, folder, layer } from '../../list/__tests__/fixtures';
import { iconChoices } from '../iconChoices';
import { LAYER_ICON_COMMAND_LABEL, LAYER_ICON_ERRORS, createSetIconCommand, validateLayerIcon } from '../iconCommand';

describe('validateLayerIcon', () => {
  it('accepts built-in names, classes and URLs (trimmed)', () => {
    expect(validateLayerIcon(' audio ')).toEqual({ ok: true, icon: 'audio' });
    expect(validateLayerIcon('fa fa-star')).toEqual({ ok: true, icon: 'fa fa-star' });
    expect(validateLayerIcon('https://x.test/i.png')).toEqual({ ok: true, icon: 'https://x.test/i.png' });
  });

  it('refuses empty and invalid values with a French message', () => {
    expect(validateLayerIcon('   ')).toEqual({ ok: false, message: LAYER_ICON_ERRORS.empty });
    expect(validateLayerIcon('jt-secret')).toEqual({ ok: false, message: LAYER_ICON_ERRORS.invalid });
    expect(validateLayerIcon('javascript:alert(1)')).toEqual({ ok: false, message: LAYER_ICON_ERRORS.invalid });
  });
});

describe('createSetIconCommand', () => {
  const source = doc([layer('a'), layer('b', { icon: 'audio' }), folder('f', [layer('c')])]);

  it('executes, undoes and redoes, restoring an absent field', () => {
    const command = createSetIconCommand(source, 'a', 'camera');
    expect(command.label).toBe(LAYER_ICON_COMMAND_LABEL);
    const done = command.do(source);
    expect(findNodeById(done.layers, 'a')).toMatchObject({ icon: 'camera' });
    const undone = command.undo(done);
    expect(findNodeById(undone.layers, 'a')).toStrictEqual(findNodeById(source.layers, 'a'));
    expect('icon' in (findNodeById(undone.layers, 'a') ?? {})).toBe(false);
    expect(findNodeById(command.do(undone).layers, 'a')).toMatchObject({ icon: 'camera' });
  });

  it('removes the icon with undefined and undo restores it', () => {
    const command = createSetIconCommand(source, 'b', undefined);
    const done = command.do(source);
    expect('icon' in (findNodeById(done.layers, 'b') ?? {})).toBe(false);
    expect(findNodeById(command.undo(done).layers, 'b')).toStrictEqual(findNodeById(source.layers, 'b'));
  });

  it('works on nested layers', () => {
    const done = createSetIconCommand(source, 'c', 'my-class').do(source);
    expect(findNodeById(done.layers, 'c')).toMatchObject({ icon: 'my-class' });
  });

  it('returns the same document for a folder or an unchanged value', () => {
    expect(createSetIconCommand(source, 'f', 'audio').do(source)).toBe(source);
    expect(createSetIconCommand(source, 'b', 'audio').do(source)).toBe(source);
    expect(createSetIconCommand(source, 'a', undefined).do(source)).toBe(source);
    expect(createSetIconCommand(source, 'a', 'audio').undo(source)).toBe(source);
  });

  it('throws on an unknown node or a refused icon', () => {
    expect(() => createSetIconCommand(source, 'zzz', 'audio')).toThrow(/introuvable/);
    expect(() => createSetIconCommand(source, 'a', 'jt-x')).toThrow(/refusée|Valeur/);
  });
});

describe('iconChoices', () => {
  it('lists default, every built-in icon and custom, marking the current one', () => {
    const names = Object.keys(BUILTIN_LAYER_ICONS);
    const choices = iconChoices('audio');
    expect(choices).toHaveLength(names.length + 2);
    expect(choices[0]).toEqual({ kind: 'default', current: false });
    expect(choices.filter((c) => c.current)).toEqual([expect.objectContaining({ kind: 'builtin', icon: 'audio' })]);
  });

  it('marks default when absent and custom for a class or URL', () => {
    expect(iconChoices(undefined)[0]).toEqual({ kind: 'default', current: true });
    const custom = iconChoices('fa fa-star').find((c) => c.current);
    expect(custom?.kind).toBe('custom');
  });
});
