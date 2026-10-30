// packages/runtime/src/stage/html/__tests__/htmlStage.groups.test.ts
import type { ILayer } from '../../../model/layer';
import { createHost, docOf, timeAt } from '../../__tests__/fakeStage';
import { createHtmlStage } from '../createHtmlStage';

function opacity(selector: string, id = 'group', frame = 1, value = 0.5): ILayer {
  return { id, name: id, type: 'layer', target: { selector }, spans: [], propertyTimelines: {
    opacity: { initialValue: { kind: 'number', value: 1 }, keys: [{ frame, value: { kind: 'number', value } }] }
  } };
}

beforeEach(() => {
  document.body.innerHTML = '<main><button class="button" id="one"></button><button class="button" id="two"></button><button class="button" id="three"></button><aside><button class="button" id="excluded"></button></aside></main><button class="button" id="outside"></button>';
  document.head.innerHTML = '<style>.button { opacity: 1 }</style>';
});

it('animates every group member inside root, excluding whole subtrees', () => {
  const stage = createHtmlStage({ mode: 'frame', root: document.querySelector('main')!, exclude: document.querySelector('aside')! });
  const host = createHost([stage]);
  host.load(docOf([opacity('.button')]));
  host.render(timeAt(3));
  for (const id of ['one', 'two', 'three']) expect(document.getElementById(id)?.style.opacity).toBe('0.5');
  for (const id of ['excluded', 'outside']) expect(document.getElementById(id)?.style.opacity).toBe('');
  host.destroy();
  expect(document.getElementById('one')?.getAttribute('style')).toBeNull();
});

it('applies case 59 per element without inserting an editable key or depending on layer order', () => {
  for (const reverse of [false, true]) {
    const layers = [opacity('.button'), opacity('#two', 'specific', 50, 0.8)];
    const doc = docOf(reverse ? layers.reverse() : layers, 100);
    const snapshot = JSON.stringify(doc);
    const host = createHost([createHtmlStage({ mode: 'frame', root: document.querySelector('main')! })]);
    host.load(doc);
    for (const frame of [1, 20, 49, 50, 100, 14.125]) {
      host.render(timeAt(frame));
      expect(document.getElementById('two')?.style.opacity).toBe('0.8');
      expect(document.getElementById('one')?.style.opacity).toBe('0.5');
    }
    expect(JSON.stringify(doc)).toBe(snapshot);
    host.destroy();
  }
});

it('preserves legacy blank-span visibility when one selector resolves to a group', () => {
  const stage = createHtmlStage({ mode: 'frame' }); const host = createHost([stage]);
  host.load(docOf([{ ...opacity('.button'), propertyTimelines: undefined, spans: [
    { id: 'shown', kind: 'static', start: 1, end: 4, tracks: { opacity: [{ frame: 1, value: 0.4 }] } },
    { id: 'hidden', kind: 'blank', start: 5, end: 10 }
  ] }]));
  host.render(timeAt(6));
  expect(document.getElementById('one')?.style.visibility).toBe('hidden');
  host.render(timeAt(2)); expect(document.getElementById('one')?.style.visibility).toBe('visible');
  host.destroy(); expect(document.getElementById('one')?.style.visibility).toBe('');
});
