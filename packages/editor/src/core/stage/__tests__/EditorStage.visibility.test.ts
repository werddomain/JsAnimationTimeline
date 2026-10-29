// packages/editor/src/core/stage/__tests__/EditorStage.visibility.test.ts
/**
 * Tests de l'œil des calques transmis aux scènes : `editorVisible` faux pour
 * un calque masqué ou dans un dossier masqué, suivi d'une commande qui masque
 * un calque, de son annulation et de son rétablissement, et masquage effectif
 * d'un élément par la scène HTML par défaut.
 */

import { createManualClock } from '@kazo-ca/timeline-runtime';
import type { ITimelineDocument } from '@kazo-ca/timeline-runtime';
import { deepFreeze } from '../../commands/__tests__/fixtures';
import { createCommand } from '../../commands/createCommand';
import type { ICommand } from '../../commands/ICommand';
import { createEditor } from '../../editor/createEditor';
import { cleanBody, createContainer } from '../../editor/__tests__/fixtures';
import { DISPLAY_FRAME_MS, createFakeStage, createStageDocument } from './fixtures';

afterEach(cleanBody);

/** Le calque `l-tree` dans un dossier masqué, le calque `l-hero` visible. */
function folderDocument(): ITimelineDocument {
  const [hero, tree] = createStageDocument().layers;
  return deepFreeze<ITimelineDocument>({
    ...createStageDocument(),
    layers: [hero, { id: 'folder', type: 'folder', name: 'Décor', visible: false, children: [tree] }]
  });
}

function setVisible(layerId: string, visible: boolean): ICommand {
  const apply = (value: boolean) => (doc: ITimelineDocument): ITimelineDocument => ({
    ...doc,
    layers: doc.layers.map((node) => (node.id === layerId ? { ...node, visible: value } : node))
  });
  return createCommand(`Œil de ${layerId}`, apply(visible), apply(!visible));
}

describe('editor stage: editor visibility', () => {
  it('passes editorVisible false for a layer inside a hidden folder', () => {
    // Arrange
    const stage = createFakeStage();
    const clock = createManualClock();
    createEditor(createContainer(), { data: folderDocument(), defaultPlugins: false, clock, stage });

    // Act
    clock.advance(DISPLAY_FRAME_MS);

    // Assert
    expect(stage.lastStates.map((state) => [state.layerId, state.editorVisible])).toEqual([['l-hero', true], ['l-tree', false]]);
  });

  it('follows a command that hides a layer, its undo and its redo', () => {
    // Arrange
    const stage = createFakeStage();
    const clock = createManualClock();
    const editor = createEditor(createContainer(), { data: createStageDocument(), defaultPlugins: false, clock, stage });
    const heroVisible = (): boolean | undefined => stage.lastStates.find((state) => state.layerId === 'l-hero')?.editorVisible;

    // Act
    editor.execute(setVisible('l-hero', false));
    clock.advance(DISPLAY_FRAME_MS);
    const hidden = heroVisible();
    editor.undo();
    clock.advance(DISPLAY_FRAME_MS);
    const shownAgain = heroVisible();
    editor.redo();
    clock.advance(DISPLAY_FRAME_MS);

    // Assert
    expect(hidden).toBe(false);
    expect(shownAgain).toBe(true);
    expect(heroVisible()).toBe(false);
  });

  it('hides the element of a hidden layer with the default HTML stage', () => {
    // Arrange
    const box = document.createElement('div');
    document.body.appendChild(box);
    const data = deepFreeze<ITimelineDocument>({
      version: '2.0.0',
      settings: { fps: 10, totalFrames: 10 },
      layers: [{
        id: 'l-div', type: 'layer', name: 'Div', target: { selector: 'div' }, visible: false,
        spans: [{ id: 's1', start: 1, end: 10, kind: 'static', tracks: { x: [{ frame: 1, value: 5 }] } }]
      }]
    });
    const clock = createManualClock();
    createEditor(createContainer(), { data, defaultPlugins: false, clock });

    // Act
    clock.advance(DISPLAY_FRAME_MS);

    // Assert
    expect(box.style.visibility).toBe('hidden');
  });
});
