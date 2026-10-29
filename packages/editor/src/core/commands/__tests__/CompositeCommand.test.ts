// packages/editor/src/core/commands/__tests__/CompositeCommand.test.ts
/**
 * Tests de CompositeCommand : ordre d'application, ordre inverse à
 * l'annulation, copie des sous-commandes, propagation d'un refus et test
 * d'annulation sur des entrées figées.
 */

import type { ITimelineDocument } from '@kazo-ca/timeline-runtime';
import { CommandRefusedError } from '../CommandRefusedError';
import { CompositeCommand } from '../CompositeCommand';
import { createCommand } from '../createCommand';
import type { ICommand } from '../ICommand';
import { createDocument, layerName, renameLayer, renameUnlessLocked, setFps } from './fixtures';

function tracing(name: string, calls: string[]): ICommand {
  return createCommand(
    name,
    (doc: ITimelineDocument) => {
      calls.push(`do ${name}`);
      return doc;
    },
    (doc: ITimelineDocument) => {
      calls.push(`undo ${name}`);
      return doc;
    }
  );
}

describe('CompositeCommand', () => {
  it('applies do in order and undo in reverse order', () => {
    // Arrange
    const calls: string[] = [];
    const composite = new CompositeCommand('Groupe', [tracing('a', calls), tracing('b', calls)]);
    const doc = createDocument();

    // Act
    composite.undo(composite.do(doc));

    // Assert
    expect(calls).toEqual(['do a', 'do b', 'undo b', 'undo a']);
  });

  it('keeps its label and a frozen copy of the commands', () => {
    // Arrange
    const commands = [setFps(30, 24)];

    // Act
    const composite = new CompositeCommand('Groupe', commands);
    commands.push(setFps(60, 30));

    // Assert
    expect(composite.label).toBe('Groupe');
    expect(composite.commands).toHaveLength(1);
    expect(Object.isFrozen(composite.commands)).toBe(true);
  });

  it('returns the same document when it has no command', () => {
    // Arrange
    const doc = createDocument();
    const composite = new CompositeCommand('Vide', []);

    // Act / Assert
    expect(composite.do(doc)).toBe(doc);
    expect(composite.undo(doc)).toBe(doc);
  });

  it('chains the documents and undoes back to a deep-equal document without mutating the input', () => {
    // Arrange
    const original = createDocument(24);
    const composite = new CompositeCommand('Groupe', [setFps(30, 24), renameLayer('l1', 'Titre', 'Logo'), setFps(60, 30)]);

    // Act
    const done = composite.do(original);
    const undone = composite.undo(done);

    // Assert
    expect(done.settings.fps).toBe(60);
    expect(layerName(done, 'l1')).toBe('Titre');
    expect(undone).toEqual(original);
    expect(original).toEqual(createDocument(24));
  });

  it('propagates the refusal of a sub-command', () => {
    // Arrange
    const composite = new CompositeCommand('Groupe', [setFps(30, 24), renameUnlessLocked('l2', 'X', 'Fond')]);

    // Act / Assert
    expect(() => composite.do(createDocument())).toThrow(CommandRefusedError);
  });
});
