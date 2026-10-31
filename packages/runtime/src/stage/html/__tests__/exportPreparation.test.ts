// packages/runtime/src/stage/html/__tests__/exportPreparation.test.ts
import { withPreparedHtmlExport } from '../exportPreparation';
import type { ILayer } from '../../../model/layer';
import { docOf } from '../../__tests__/fakeStage';

function layer(selector: string, id: string, frame: number, value: number): ILayer {
  return { id, name: id, type: 'layer', target: { selector }, spans: [], propertyTimelines: {
    opacity: { initialValue: { kind: 'number', value: 1 }, keys: [{ frame, value: { kind: 'number', value } }] }
  } };
}

test('prepares exact chosen timelines and the case 59 policy without inventing source keys', () => {
  document.head.innerHTML = '<style>.button { opacity: 1 }</style>';
  document.body.innerHTML = '<main><button class="button" id="one"></button><button class="button" id="two"></button></main>';
  const doc = docOf([layer('.button', 'group', 1, 0.5), layer('#two', 'specific', 5, 0.8)]);
  const original = JSON.stringify(doc);
  const result = withPreparedHtmlExport(doc, { root: document.querySelector('main')! }, (prepared) => prepared.trajectories);
  expect(result.status).toBe('exported');
  if (result.status !== 'exported') throw new Error('prepare failed');
  const specific = result.data.find((entry) => entry.element.id === 'two')!.properties[0];
  expect(specific.layerId).toBe('specific');
  expect(specific.timeline?.beforeFirst).toBe('first-key');
  expect(specific.timeline?.keys.map((key) => key.frame)).toEqual([5]);
  expect(specific.descriptor?.min).toBe(0);
  expect(specific.descriptor?.max).toBe(1);
  expect(JSON.stringify(doc)).toBe(original);
});

test('keeps preparation and the export callback inside source-stage suspension', () => {
  document.body.innerHTML = '<main><div id="one" style="opacity:1"></div></main>';
  const element = document.querySelector<HTMLElement>('#one')!;
  element.style.opacity = '0.2';
  const sourceStage = { withSourceStyles<T>(action: () => T): T {
    element.style.opacity = '1';
    try { return action(); } finally { element.style.opacity = '0.2'; }
  } };
  const result = withPreparedHtmlExport(docOf([layer('#one', 'a', 1, 0.5)]),
    { root: document.querySelector('main')!, sourceStage }, () => element.style.opacity);
  expect(result).toMatchObject({ status: 'exported', data: '1' });
  expect(element.style.opacity).toBe('0.2');
});

test('refuses a priority conflict before invoking an export callback', () => {
  document.body.innerHTML = '<main><div id="one"></div></main>';
  const callback = jest.fn();
  const result = withPreparedHtmlExport(docOf([layer('#one', 'a', 1, 0.5), layer('#one', 'b', 1, 0.8)]),
    { root: document.querySelector('main')! }, callback);
  expect(result.status).toBe('refused');
  expect(callback).not.toHaveBeenCalled();
});
