// packages/editor/src/plugins/layers/color/__tests__/layerColor.test.ts
import { findNodeById } from '@kazo-ca/timeline-runtime';
import { LAYER_COLOR_COMMAND_LABEL, createSetColorCommand, normalizeLayerColor } from '../layerColor';
import { doc, folder, layer } from '../../list/__tests__/fixtures';

describe('normalizeLayerColor', () => {
  it('lower-cases #rrggbb', () => {
    expect(normalizeLayerColor('#AABBCC')).toBe('#aabbcc');
    expect(normalizeLayerColor(' #00ff00 ')).toBe('#00ff00');
  });

  it.each(['red', '#fff', '#12345', '#1234567', 'rgb(1,2,3)', '', '#gggggg', '#12345678'])('refuses %p', (value) => {
    expect(normalizeLayerColor(value)).toBeUndefined();
  });
});

describe('createSetColorCommand', () => {
  const source = doc([layer('a'), folder('f', [layer('b', { color: '#112233' })], { color: '#445566' })]);

  it('executes, undoes and redoes on a layer, restoring the absent field', () => {
    const command = createSetColorCommand(source, 'a', '#FF0000');
    expect(command.label).toBe(LAYER_COLOR_COMMAND_LABEL);
    const done = command.do(source);
    expect(findNodeById(done.layers, 'a')?.color).toBe('#ff0000');
    const undone = command.undo(done);
    expect(findNodeById(undone.layers, 'a')).toStrictEqual(findNodeById(source.layers, 'a'));
    expect('color' in (findNodeById(undone.layers, 'a') ?? {})).toBe(false);
    expect(findNodeById(command.do(undone).layers, 'a')?.color).toBe('#ff0000');
  });

  it('works on folders and nested layers, undo restores the original color', () => {
    const onFolder = createSetColorCommand(source, 'f', '#000000');
    expect(findNodeById(onFolder.do(source).layers, 'f')?.color).toBe('#000000');
    expect(findNodeById(onFolder.undo(onFolder.do(source)).layers, 'f')?.color).toBe('#445566');
    const nested = createSetColorCommand(source, 'b', '#abcdef');
    expect(findNodeById(nested.do(source).layers, 'b')?.color).toBe('#abcdef');
    expect(nested.undo(nested.do(source)).layers[1]).toStrictEqual(source.layers[1]);
  });

  it('clears the color with undefined and undo brings it back', () => {
    const command = createSetColorCommand(source, 'b', undefined);
    const done = command.do(source);
    expect('color' in (findNodeById(done.layers, 'b') ?? {})).toBe(false);
    expect(findNodeById(command.undo(done).layers, 'b')?.color).toBe('#112233');
  });

  it('returns the same document when nothing changes', () => {
    expect(createSetColorCommand(source, 'b', '#112233').do(source)).toBe(source);
    expect(createSetColorCommand(source, 'b', '#112233').undo(source)).toBe(source);
    expect(createSetColorCommand(source, 'a', undefined).do(source)).toBe(source);
  });

  it('throws on an unknown node or an invalid color', () => {
    expect(() => createSetColorCommand(source, 'zzz', '#000000')).toThrow(/introuvable/);
    expect(() => createSetColorCommand(source, 'a', 'red')).toThrow(/invalide/);
  });

  it('restores the absent field of a folder on undo and redoes', () => {
    const plain = doc([folder('f', [layer('b')])]);
    const command = createSetColorCommand(plain, 'f', '#123456');
    const undone = command.undo(command.do(plain));
    expect(findNodeById(undone.layers, 'f')).toStrictEqual(findNodeById(plain.layers, 'f'));
    expect(findNodeById(command.do(undone).layers, 'f')?.color).toBe('#123456');
  });
});
