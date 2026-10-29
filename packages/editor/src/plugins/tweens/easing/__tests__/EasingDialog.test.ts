// packages/editor/src/plugins/tweens/easing/__tests__/EasingDialog.test.ts
import { createEasingDialog } from '../EasingDialog';

afterEach(() => { document.body.replaceChildren(); jest.restoreAllMocks(); });

it('removes the portal and its listeners when initial focus fails', () => {
  const owner = document.createElement('div'); document.body.append(owner);
  const focus = jest.spyOn(HTMLSelectElement.prototype, 'focus').mockImplementation(() => { throw new Error('focus failed'); });
  expect(() => createEasingDialog({ owner, easing: undefined, apply: () => true, close: () => {} })).toThrow('focus failed');
  expect(document.querySelector('.jt-easing-portal')).toBeNull(); focus.mockRestore();
});

it('does not restore disconnected focus, invoke stale callbacks, or accept an empty preset', () => {
  const owner = document.createElement('div'); const old = document.createElement('button'); document.body.append(owner, old); old.focus();
  const apply = jest.fn(() => true); const close = jest.fn();
  const dialog = createEasingDialog({ owner, easing: 'cubic-bezier(.2, 0, .8, 1)', apply, close });
  const form = document.querySelector('form'); const cancel = form?.querySelector('button[type="button"]');
  form?.dispatchEvent(new SubmitEvent('submit', { cancelable: true })); expect(apply).not.toHaveBeenCalled();
  old.remove(); dialog.destroy(); dialog.destroy();
  form?.dispatchEvent(new SubmitEvent('submit', { cancelable: true })); cancel?.dispatchEvent(new MouseEvent('click'));
  expect(apply).not.toHaveBeenCalled(); expect(close).not.toHaveBeenCalled();
});
