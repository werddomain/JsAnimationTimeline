// packages/editor/src/core/stage/__tests__/editorHtmlStage.test.ts
/**
 * Tests de `createEditorHtmlStage` : le conteneur et le sous-arbre de
 * l'éditeur ne se résolvent ni par sélecteur, ni par ref (table, `bind`,
 * attribut), ni par `{ element }` ; `list`, `describe` et `resolve` suivent la
 * même règle ; un `.JsTimeLine` imbriqué dans l'éditeur reste exclu, un autre
 * hors du conteneur reste une cible.
 */

import { TARGET_ATTRIBUTE } from '@kazo-ca/timeline-runtime';
import { cleanBody } from '../../editor/__tests__/fixtures';
import { createEditorHtmlStage } from '../editorHtmlStage';

afterEach(cleanBody);

interface IPage {
  readonly container: HTMLElement;
  readonly editorRoot: HTMLElement;
  readonly scene: HTMLElement;
}

/** `<div id="timeline">` qui contient une scène `#scene`, puis l'éditeur `.JsTimeLine`. */
function createPage(): IPage {
  const container = document.createElement('div');
  container.id = 'timeline';
  const scene = document.createElement('div');
  scene.id = 'scene';
  const editorRoot = document.createElement('div');
  editorRoot.classList.add('JsTimeLine');
  container.append(scene, editorRoot);
  document.body.appendChild(container);
  return { container, editorRoot, scene };
}

describe('createEditorHtmlStage', () => {
  it('resolves a selector to the first element outside the editor, and describes that one', () => {
    // Arrange
    const { container, scene } = createPage();
    const stage = createEditorHtmlStage(container);

    // Act
    const resolved = stage.resolve({ selector: 'div' });
    const described = stage.targets.describe?.({ selector: 'div' });

    // Assert
    expect(resolved).toBe(scene);
    expect(described).toMatchObject({ target: { selector: 'div' }, label: 'scene' });
  });

  it('refuses refs and element targets that name the container or the editor', () => {
    // Arrange
    const { container, editorRoot, scene } = createPage();
    container.setAttribute(TARGET_ATTRIBUTE, 'host');
    const stage = createEditorHtmlStage(container, { refs: { box: container, scene } });

    // Act
    stage.bind('panel', editorRoot);

    // Assert
    expect(stage.resolve({ ref: 'host', stage: 'html' })).toBeNull();
    expect(stage.resolve({ ref: 'box', stage: 'html' })).toBeNull();
    expect(stage.resolve({ ref: 'panel', stage: 'html' })).toBeNull();
    expect(stage.resolve({ element: container })).toBeNull();
    expect(stage.resolve({ ref: 'scene', stage: 'html' })).toBe(scene);
    expect(stage.targets.describe?.({ ref: 'box', stage: 'html' })).toBeUndefined();
  });

  it('lists only targets it would resolve', () => {
    // Arrange
    const { container, scene } = createPage();
    container.setAttribute(TARGET_ATTRIBUTE, 'host');
    const stage = createEditorHtmlStage(container, { refs: { box: container, scene } });

    // Act
    const listed = stage.targets.list().map((info) => info.label);

    // Assert
    expect(listed).toEqual(expect.arrayContaining(['scene']));
    expect(listed).not.toContain('host');
    expect(listed).not.toContain('box');
    expect(listed).not.toContain('timeline');
  });

  it('excludes elements under a .JsTimeLine nested in the editor, not another editor elsewhere', () => {
    // Arrange
    const { container, editorRoot } = createPage();
    const nested = document.createElement('div');
    nested.classList.add('JsTimeLine');
    const inner = document.createElement('span');
    inner.id = 'inner';
    nested.appendChild(inner);
    editorRoot.appendChild(nested);
    const other = document.createElement('div');
    other.classList.add('JsTimeLine');
    other.id = 'other-editor';
    document.body.appendChild(other);
    const stage = createEditorHtmlStage(container);

    // Assert
    expect(stage.resolve({ selector: '#inner' })).toBeNull();
    expect(stage.resolve({ selector: '#other-editor' })).toBe(other);
  });

  it('returns null for an invalid selector without throwing', () => {
    // Arrange
    const { container } = createPage();
    const stage = createEditorHtmlStage(container);

    // Assert
    expect(stage.resolve({ selector: 'div[' })).toBeNull();
    expect(stage.targets.describe?.({ selector: 'div[' })).toBeUndefined();
  });
});
