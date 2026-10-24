// packages/editor/src/model/spans/__tests__/spanCommands.test.ts
/**
 * Tests des commandes de plage exécutées par la vraie pile (Store +
 * CommandStack) : effet, annulation, rétablissement et refus sur un calque
 * verrouillé (`command:refused` avec le message français).
 */

import type { ITimelineDocument } from '@werddomain/timeline-runtime';
import { CommandRefusedError } from '../../../core/commands/CommandRefusedError';
import type { ICommand } from '../../../core/commands/ICommand';
import { EventBus } from '../../../core/events/EventBus';
import { Store } from '../../../core/store/Store';
import { createSpanCommands, SpanCommandLabels } from '../spanCommands';
import type { ISpanCommands } from '../spanCommands';
import { createDoc, createRegistry, expectValid, layer, shapeOf, tweenDoc } from './fixtures';

function harness(doc: ITimelineDocument) {
  const bus = new EventBus({ onError: jest.fn() });
  const store = new Store(bus, doc);
  const stack = store.createCommandStack();
  const refused: string[] = [];
  bus.on('command:refused', ({ reason }) => refused.push(reason));
  return { store, stack, refused };
}

const commands: ISpanCommands = createSpanCommands(createRegistry());

/** Une commande par opération, chacune modifiant `tweenDoc()` (avec la durée attendue). */
const cases: ReadonlyArray<readonly [string, ICommand, readonly string[], number]> = [
  [SpanCommandLabels.INSERT_KEYFRAME, commands.insertKeyframe('l1', 15), ['tween 1-11', 'static 12-14', 'static 15-20'], 24],
  [SpanCommandLabels.INSERT_BLANK_KEYFRAME, commands.insertBlankKeyframe('l1', 6), ['tween 1-5', 'blank 6-11', 'static 12-20'], 24],
  [SpanCommandLabels.DELETE_KEYFRAME, commands.deleteKeyframe('l1', 12), ['tween 1-20'], 24],
  [SpanCommandLabels.INSERT_FRAME, commands.insertFrame('l1', 6), ['tween 1-12', 'static 13-21'], 24],
  [SpanCommandLabels.REMOVE_FRAME, commands.removeFrame('l1', 6), ['tween 1-10', 'static 11-19'], 24],
  [SpanCommandLabels.MOVE_KEYFRAME, commands.moveKeyframe('l1', 12, 8), ['tween 1-7', 'static 8-20'], 24]
];

describe('createSpanCommands', () => {
  it.each(cases)('« %s » s’applique, s’annule et se rétablit', (label, command, shape, totalFrames) => {
    const doc = tweenDoc();
    const { store, stack } = harness(doc);
    expect(command.label).toBe(label);

    expect(stack.execute(command)).toBe(true);
    expect(shapeOf(store.document, 'l1')).toEqual(shape);
    expect(store.document.settings.totalFrames).toBe(totalFrames);
    expectValid(store.document);
    const done = store.document;

    expect(stack.undo()).toBe(true);
    expect(store.document).toEqual(doc);

    expect(stack.redo()).toBe(true);
    expect(store.document).toEqual(done);
  });

  it('annule aussi la durée du document agrandie par une insertion', () => {
    const doc = createDoc([layer('l1', [{ id: 's1', start: 1, end: 24, kind: 'static' }]), layer('l2', [])]);
    const { store, stack } = harness(doc);
    stack.execute(commands.insertFrame('l1', 2));
    expect(store.document.settings.totalFrames).toBe(25);
    stack.undo();
    expect(store.document).toEqual(doc);
  });

  it('ne restaure que son calque : une commande sur un autre calque reste en place', () => {
    const doc = createDoc([layer('l1', [{ id: 'a', start: 1, end: 10, kind: 'static' }]), layer('l2', [{ id: 'b', start: 1, end: 10, kind: 'static' }])]);
    const { store, stack } = harness(doc);
    stack.execute(commands.insertKeyframe('l1', 5));
    stack.execute(commands.insertKeyframe('l2', 3));
    stack.undo();
    expect(shapeOf(store.document, 'l1')).toEqual(['static 1-4', 'static 5-10']);
    expect(shapeOf(store.document, 'l2')).toEqual(['static 1-10']);
    stack.undo();
    expect(store.document).toEqual(doc);
  });

  it('une commande sans effet ne crée pas d’entrée annulable', () => {
    const { stack } = harness(tweenDoc());
    expect(stack.execute(commands.insertKeyframe('l1', 12))).toBe(false);
    expect(stack.canUndo).toBe(false);
  });

  it('refuse toute opération sur un calque verrouillé, avec un message en français', () => {
    const doc = createDoc([layer('l1', [{ id: 'a', start: 1, end: 4, kind: 'static' }, { id: 'b', start: 5, end: 8, kind: 'tween' }], { name: 'Héros', locked: true })]);
    const { store, stack, refused } = harness(doc);
    const all = [
      commands.insertKeyframe('l1', 2),
      commands.insertBlankKeyframe('l1', 2),
      commands.deleteKeyframe('l1', 5),
      commands.insertFrame('l1', 2),
      commands.removeFrame('l1', 2),
      commands.moveKeyframe('l1', 5, 6)
    ];
    all.forEach((command) => expect(stack.execute(command)).toBe(false));
    expect(refused).toEqual(all.map(() => 'Le calque « Héros » est verrouillé.'));
    expect(store.document).toBe(doc);
    expect(stack.canUndo).toBe(false);
  });

  it('refait le calcul à chaque do : refuse si le calque est verrouillé entre-temps', () => {
    const command = commands.insertKeyframe('l1', 5);
    const doc = createDoc([layer('l1', [{ id: 'a', start: 1, end: 10, kind: 'static' }])]);
    const done = command.do(doc);
    expect(command.undo(done)).toEqual(doc);
    const locked = createDoc([layer('l1', [{ id: 'a', start: 1, end: 10, kind: 'static' }], { locked: true })]);
    expect(() => command.do(locked)).toThrow(CommandRefusedError);
  });

  it("transforme un échec d'évaluation en refus", () => {
    const throwing = createSpanCommands({ require: () => { throw new TypeError('registre cassé'); } } as unknown as ReturnType<typeof createRegistry>);
    const doc = createDoc([layer('l1', [{ id: 'a', start: 1, end: 10, kind: 'static', tracks: { x: [{ frame: 1, value: 1 }] } }])]);
    const { stack, refused } = harness(doc);
    expect(stack.execute(throwing.insertKeyframe('l1', 5))).toBe(false);
    expect(refused[0]).toContain('registre cassé');
  });
});
