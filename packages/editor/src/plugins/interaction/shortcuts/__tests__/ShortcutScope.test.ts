// packages/editor/src/plugins/interaction/shortcuts/__tests__/ShortcutScope.test.ts
/**
 * Portée des raccourcis : écouteurs par document, champs de saisie,
 * destruction idempotente.
 */

import { ShortcutScope, isEditableTarget } from '../ShortcutScope';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('ShortcutScope', () => {
  it('listens once per document, even with several elements', () => {
    // Arrange
    const root = document.body.appendChild(document.createElement('div'));
    const other = document.body.appendChild(document.createElement('div'));
    const add = jest.spyOn(document, 'addEventListener');
    const remove = jest.spyOn(document, 'removeEventListener');

    // Act
    const scope = new ShortcutScope(root, () => undefined);
    const removeOther = scope.add(other);
    removeOther();
    const addCalls = add.mock.calls.filter(([type]) => type === 'keydown').length;
    const removeCallsBefore = remove.mock.calls.filter(([type]) => type === 'keydown').length;
    scope.destroy();
    scope.destroy();

    // Assert
    expect(addCalls).toBe(1);
    expect(removeCallsBefore).toBe(0);
    expect(remove.mock.calls.filter(([type]) => type === 'keydown')).toHaveLength(1);
    add.mockRestore();
    remove.mockRestore();
  });

  it('listens on the document of an element from another document (iframe stage)', () => {
    // Arrange
    const root = document.body.appendChild(document.createElement('div'));
    const otherDoc = document.implementation.createHTMLDocument('stage');
    const stage = otherDoc.body.appendChild(otherDoc.createElement('canvas'));
    const listener = jest.fn();
    const scope = new ShortcutScope(root, listener);

    // Act
    scope.add(stage as unknown as HTMLElement);
    stage.dispatchEvent(new KeyboardEvent('keydown', { key: 'F6', bubbles: true }));
    scope.destroy();
    stage.dispatchEvent(new KeyboardEvent('keydown', { key: 'F6', bubbles: true }));

    // Assert
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('does not treat a non-element target as inside the scope', () => {
    // Arrange
    const root = document.body.appendChild(document.createElement('div'));
    const scope = new ShortcutScope(root, () => undefined);

    // Act / Assert
    expect(scope.contains(null)).toBe(false);
    expect(scope.contains(document)).toBe(false);
    expect(scope.contains(root)).toBe(true);
    scope.destroy();
  });
});

describe('isEditableTarget', () => {
  it('recognises fields and contenteditable, not other elements', () => {
    // Arrange
    const box = document.createElement('div');
    box.setAttribute('contenteditable', 'false');

    // Act / Assert
    expect(isEditableTarget(document.createElement('input'))).toBe(true);
    expect(isEditableTarget(document.createElement('div'))).toBe(false);
    expect(isEditableTarget(box)).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
    expect(isEditableTarget(window)).toBe(false);
  });
});
