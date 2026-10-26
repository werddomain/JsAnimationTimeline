// packages/editor/src/plugins/tweens/__tests__/TweensPlugin.test.ts
/** The tweens epic registers its independent services in the default editor. */
import { createEditor } from '../../../core/editor/createEditor';
import { defaultPlugins } from '../../../core/editor/defaultPlugins';
import { cleanBody, createContainer } from '../../layout/__tests__/layoutFixtures';
import { MotionTweenPlugin } from '../motion/MotionTweenPlugin';
import { PropertyKeyframesPlugin } from '../propertyKeyframes/PropertyKeyframesPlugin';
import { EasingPlugin } from '../easing/EasingPlugin';
import { TweensPlugin } from '../TweensPlugin';

afterEach(cleanBody);

describe('TweensPlugin', () => {
  it('groups motion, property-keyframe and easing plugins', () => {
    const epic = new TweensPlugin();
    expect(epic.id).toBe('tweens');
    expect(epic.dependencies).toEqual([]);
    expect(epic.children).toHaveLength(3);
    expect(epic.children[0]).toBeInstanceOf(MotionTweenPlugin);
    expect(epic.children[0].id).toBe('tweens.motion');
    expect(epic.children[0].dependencies).toEqual(['frames.selection']);
    expect(epic.children[0].slot).toBeUndefined();
    expect(epic.children[1]).toBeInstanceOf(PropertyKeyframesPlugin);
    expect(epic.children[1].id).toBe('tweens.propertyKeyframes');
    expect(epic.children[1].dependencies).toEqual(['tweens.motion']);
    expect(epic.children[2]).toBeInstanceOf(EasingPlugin);
    expect(epic.children[2].id).toBe('tweens.easing');
    expect(epic.children[2].dependencies).toEqual(['tweens.motion']);
    expect(() => epic.init()).not.toThrow();
    expect(() => epic.destroy()).not.toThrow();
  });

  it('comes after the frames epic in the default plugins', () => {
    const ids = defaultPlugins().map((plugin) => plugin.id);
    expect(ids.indexOf('tweens')).toBeGreaterThan(ids.indexOf('frames'));
  });

  it('gives the default editor every tween service', () => {
    const editor = createEditor(createContainer());
    const service = editor.getService('tweens.motion');
    expect(service).toBeDefined();
    expect(service?.canCreate().enabled).toBe(false);
    expect(service?.canRemove().enabled).toBe(false);
    expect(editor.getService('tweens.propertyKeyframes')?.propertiesFor('missing')).toEqual([]);
    expect(editor.getService('tweens.easing')?.canSetAt('missing', 1).enabled).toBe(false);
    editor.destroy();
  });
});
