// packages/editor/src/plugins/tweens/__tests__/TweensPlugin.test.ts
/**
 * Tests de l'epic `tweens` : ses enfants et sa présence dans l'éditeur par
 * défaut.
 */

import { createEditor } from '../../../core/editor/createEditor';
import { defaultPlugins } from '../../../core/editor/defaultPlugins';
import { cleanBody, createContainer } from '../../layout/__tests__/layoutFixtures';
import { MotionTweenPlugin } from '../motion/MotionTweenPlugin';
import { TweensPlugin } from '../TweensPlugin';
import { PropertyKeyframesPlugin } from '../propertyKeyframes/PropertyKeyframesPlugin';

afterEach(cleanBody);

describe('TweensPlugin', () => {
  it('groups motion and property-keyframe plugins', () => {
    // Arrange
    const epic = new TweensPlugin();

    // Assert
    expect(epic.id).toBe('tweens');
    expect(epic.dependencies).toEqual([]);
    expect(epic.children).toHaveLength(2);
    expect(epic.children[0]).toBeInstanceOf(MotionTweenPlugin);
    expect(epic.children[0].id).toBe('tweens.motion');
    expect(epic.children[0].dependencies).toEqual(['frames.selection']);
    expect(epic.children[0].slot).toBeUndefined();
    expect(epic.children[1]).toBeInstanceOf(PropertyKeyframesPlugin);
    expect(epic.children[1].id).toBe('tweens.propertyKeyframes');
    expect(epic.children[1].dependencies).toEqual(['tweens.motion']);
    expect(() => epic.init()).not.toThrow();
    expect(() => epic.destroy()).not.toThrow();
  });

  it('comes after the frames epic in the default plugins', () => {
    // Act
    const ids = defaultPlugins().map((plugin) => plugin.id);

    // Assert
    expect(ids.indexOf('tweens')).toBeGreaterThan(ids.indexOf('frames'));
  });

  it('gives the default editor the tweens.motion service', () => {
    // Act
    const editor = createEditor(createContainer());
    const service = editor.getService('tweens.motion');

    // Assert
    expect(service).toBeDefined();
    expect(service?.canCreate().enabled).toBe(false);
    expect(service?.canRemove().enabled).toBe(false);
    expect(editor.getService('tweens.propertyKeyframes')?.propertiesFor('missing')).toEqual([]);
    editor.destroy();
  });
});
