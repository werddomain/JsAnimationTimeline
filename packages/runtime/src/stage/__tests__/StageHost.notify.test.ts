// packages/runtime/src/stage/__tests__/StageHost.notify.test.ts
/**
 * `onTargetsChanged` et `document` du `StageHost` : appelé après une
 * nouvelle tentative qui change les liaisons (`refresh`, `targets.subscribe`),
 * jamais par `load` ni sans changement ; `document` suit le document montré
 * par les scènes, y compris pendant le retour arrière d'un document refusé.
 */

import { defaultPropertyRegistry } from '../../properties/PropertyRegistry';
import { StageDocumentError } from '../reports';
import { StageHost } from '../StageHost';
import type { IStage } from '../types';
import { createFakeStage, docOf, refLayer, timeAt } from './fakeStage';

function hostWith(stages: readonly IStage[], onTargetsChanged: () => void, isEditorVisible?: (layerId: string) => boolean): StageHost {
  return new StageHost({
    stages,
    registry: defaultPropertyRegistry,
    onError: () => undefined,
    onTargetsChanged,
    isEditorVisible,
    now: () => ({ time: timeAt(1), state: { playing: false, speed: 1 } })
  });
}

describe('StageHost onTargetsChanged', () => {
  it('is called after refresh and subscribe resolve new objects, never by load', () => {
    // Arrange
    const fake = createFakeStage('canvas', { subscribe: true });
    const calls: string[] = [];
    const host = hostWith([fake.stage], () => calls.push([...host.missingTargets].join(',')));
    host.load(docOf([refLayer('a', 'a', 'canvas'), refLayer('b', 'b', 'canvas')]));
    const afterLoad = calls.length;

    // Act
    host.refresh();
    fake.objects.set('a', { name: 'a' });
    host.refresh();
    fake.objects.set('b', { name: 'b' });
    fake.notify();

    // Assert
    expect(afterLoad).toBe(0);
    expect(calls).toEqual(['b', '']);
  });
});

describe('StageHost document', () => {
  it('is null before the first load, then the document the stages show, also during a rollback', () => {
    // Arrange
    const fake = createFakeStage('canvas');
    fake.objects.set('a', { name: 'a' });
    const first = docOf([refLayer('a', 'a', 'canvas')]);
    const refused = docOf([{ ...refLayer('a', 'a', 'canvas'), name: 'refusé' }]);
    const seen: unknown[] = [];
    const host = hostWith([fake.stage], () => undefined, () => {
      seen.push(host.document);
      return true;
    });
    const before = host.document;
    host.load(first);
    const update = fake.stage.update?.bind(fake.stage);
    fake.stage.update = (doc, layers) => {
      update?.(doc, layers);
      if (doc === refused) throw new StageDocumentError('non');
    };

    // Act
    const act = (): void => host.load(refused);

    // Assert
    expect(before).toBeNull();
    expect(act).toThrow(StageDocumentError);
    expect(host.document).toBe(first);
    expect(seen.every((doc) => doc === first)).toBe(true);
    expect(seen.length).toBeGreaterThan(0);
  });
});
