// packages/editor/src/model/propertyTimelines/__tests__/guardedCommand.test.ts
import { defaultPropertyRegistry } from '@kazo-ca/timeline-runtime';
import { PropertyTimelineCommand } from '../PropertyTimelineCommand';
import { createDoc, layer } from '../../spans/__tests__/fixtures';

it('rejects an edit when a metadata callback invalidates its UI context', () => {
  let current = true;
  const data = createDoc([layer('logo', [], { target: { ref: 'logo' } })], 100);
  const command = new PropertyTimelineCommand({ kind: 'set', layerId: 'logo', property: 'x',
    frame: 10, value: { kind: 'number', value: 30 }, initialValue: { kind: 'number', value: 0 } }, {
    registry: defaultPropertyRegistry,
    describe: () => { current = false; return undefined; }
  }, () => current);
  expect(() => command.do(data)).toThrow(/contexte/i);
  expect(data.layers[0]).not.toHaveProperty('propertyTimelines');
});

it('guards the initial execution but permits redo after UI selection changes', () => {
  let current = true;
  const data = createDoc([layer('logo', [])], 100);
  const command = new PropertyTimelineCommand({ kind: 'set', layerId: 'logo', property: 'x',
    frame: 10, value: { kind: 'number', value: 30 }, initialValue: { kind: 'number', value: 0 } }, {
    registry: defaultPropertyRegistry
  }, () => current);
  const changed = command.do(data);
  expect(changed).not.toEqual(data);
  expect(command.undo(changed)).toEqual(data);
  current = false;
  expect(command.do(data)).toEqual(changed);
});
