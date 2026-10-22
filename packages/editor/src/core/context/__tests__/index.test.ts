// packages/editor/src/core/context/__tests__/index.test.ts
/**
 * Vérifie les valeurs exportées par les index des modules context et editor,
 * et que le module du contrat rend visibles les événements du Store et de la
 * pile dans TimelineEventMap.
 */

import * as context from '..';
import * as editor from '../../editor';
import * as contract from '../IEditorContext';
import type { EditorEventName } from '../IEditorContext';

type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

function assertType<T extends true>(value: T): T {
  return value;
}

type CoreNames = 'editor:ready' | 'editor:destroying' | 'document:changed' | 'history:changed';

describe('context and editor modules public API', () => {
  it('exports the runtime values of the context module', () => {
    // Assert
    expect(Object.keys(context).sort()).toEqual(['ServiceRegistry', 'createEditorContext']);
    expect(Object.keys(contract)).toEqual([]);
  });

  it('exports the runtime values of the editor module', () => {
    // Assert
    expect(Object.keys(editor).sort()).toEqual([
      'DEFAULT_FPS',
      'DEFAULT_TOTAL_FRAMES',
      'EDITOR_ROOT_CLASS',
      'createEditor',
      'createEmptyDocument',
      'defaultPlugins'
    ]);
  });

  it('sees the core, store and command events through the context contract', () => {
    // Assert
    assertType<Equals<Extract<EditorEventName, CoreNames>, CoreNames>>(true);
    expect(true).toBe(true);
  });
});
