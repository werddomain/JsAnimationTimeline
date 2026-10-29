// packages/editor/src/plugins/tweens/easing/__tests__/index.test.ts
import { EASING_PLUGIN_ID, EasingPlugin, createEasingPlugin, createSetEasingCommand, setSpanEasing } from '../index';
import { fixture } from './fixtures';

it('exposes the plugin factory and the two command helpers', () => {
  const plugin = createEasingPlugin();
  expect(plugin).toBeInstanceOf(EasingPlugin);
  expect(plugin.id).toBe(EASING_PLUGIN_ID);
  expect(plugin.dependencies).toEqual(['tweens.motion']);
  const data = fixture();
  expect(createSetEasingCommand('a', 1, 'ease').do(data)).toEqual(setSpanEasing(data, 'a', 1, 'ease'));
});
