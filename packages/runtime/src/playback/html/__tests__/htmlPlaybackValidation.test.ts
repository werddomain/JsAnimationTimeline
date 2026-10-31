// packages/runtime/src/playback/html/__tests__/htmlPlaybackValidation.test.ts
import Ajv2020 from 'ajv/dist/2020';
import { readJson } from '../../../model/__tests__/fixtures/schema';
import { createManualClock } from '../../../transport/manualClock';
import { compileHtmlPlayback } from '../compileHtmlPlayback';
import { parseHtmlPlayback } from '../parseHtmlPlayback';
import { createHtmlPlaybackPlayer } from '../createHtmlPlaybackPlayer';
import type { IHtmlPlaybackDocument } from '../types';

function data(): IHtmlPlaybackDocument {
  document.head.innerHTML = '<style>.a { opacity: 1 }</style>';
  document.body.innerHTML = '<main><div class="a" id="one"></div><div class="b" id="two"></div></main>';
  const result = compileHtmlPlayback({ version: '2.0.0', settings: { fps: 24, totalFrames: 2 }, layers: [
    { id: 'a', name: 'a', type: 'layer', target: { selector: '.a' }, spans: [], propertyTimelines: {
      opacity: { initialValue: { kind: 'number', value: 1 }, keys: [{ frame: 1, value: { kind: 'number', value: 0.5 } }] }
    } },
    { id: 'b', name: 'b', type: 'layer', target: { selector: '.b' }, spans: [], propertyTimelines: {
      x: { initialValue: { kind: 'number', value: 0 }, keys: [{ frame: 1, value: { kind: 'number', value: 30 } }] }
    } }
  ] }, { root: document.querySelector('main')! });
  if (result.status !== 'exported') throw new Error(JSON.stringify(result.diagnostics));
  return result.data;
}
const mutable = (value: IHtmlPlaybackDocument): Record<string, unknown> => JSON.parse(JSON.stringify(value)) as Record<string, unknown>;

test('HTML schema validates the emitted JSON alongside its generic source schema', () => {
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  ajv.addSchema(readJson('playback-document.schema.json') as object);
  const validate = ajv.compile(readJson('html-playback-document.schema.json') as object);
  const value = data(); expect(validate(value)).toBe(true);
  for (const patch of [{ version: 2 }, { sampling: 'continuous' }, { unexpected: true }, { groups: [{ id: 'x', include: [], exclude: [], count: 0 }] }]) {
    const invalid = { ...value, ...patch }; expect(validate(invalid)).toBe(false); expect(() => parseHtmlPlayback(invalid)).toThrow();
  }
});

test.each([
  ['frame coverage', (input: Record<string, unknown>) => { delete (input.frames as Record<string, unknown>)['2']; }],
  ['group identity', (input: Record<string, unknown>) => { const groups = input.groups as { id: string }[]; groups[1].id = groups[0].id; }],
  ['group coverage', (input: Record<string, unknown>) => { const groups = input.groups as { exclude: string[] }[]; groups[0].exclude = []; }],
  ['source target', (input: Record<string, unknown>) => { const source = input.source as { objects: { a: { target: unknown } } }; source.objects.a.target = { ref: 'x' }; }],
  ['group count', (input: Record<string, unknown>) => { (input.groups as { count: number }[])[0].count = 2_000_000; }],
  ['css block', (input: Record<string, unknown>) => { const frame = (input.frames as Record<string, Record<string, Record<string, string>>>)['1']; frame['group-1'].opacity = '0.5; color:red'; }],
  ['executable css', (input: Record<string, unknown>) => { const frame = (input.frames as Record<string, Record<string, Record<string, string>>>)['1']; frame['group-1'].opacity = 'expression(alert(1))'; }],
  ['prototype', (input: Record<string, unknown>) => { Object.defineProperty(input, '__proto__', { value: {}, enumerable: true }); }],
  ['cyclic', (input: Record<string, unknown>) => { input.frames = input; }],
  ['hidden field', (input: Record<string, unknown>) => { Object.defineProperty(input, 'hidden', { value: 3 }); }]
])('refuses malformed %s without touching the DOM', (_label, mutate) => {
  const input = mutable(data()); mutate(input); const before = document.body.innerHTML;
  expect(() => parseHtmlPlayback(input)).toThrow(); expect(document.body.innerHTML).toBe(before);
});

test('validates supported CSS and newly uncovered selector intersections before writing', () => {
  const original = data(); const input = mutable(original);
  const frames = input.frames as Record<string, Record<string, Record<string, string>>>;
  frames['2']['group-1'].opacity = 'not-a-valid-css-opacity';
  expect(() => createHtmlPlaybackPlayer(input, { root: document.querySelector('main')! })).toThrow(/prise en charge/);
  expect((document.querySelector('#one') as HTMLElement).style.opacity).toBe('');
  const extra = document.createElement('div'); extra.className = 'a b'; document.querySelector('main')!.append(extra);
  expect(() => createHtmlPlaybackPlayer(original, { root: document.querySelector('main')! })).toThrow(/correspondance/);
  expect((document.querySelector('#one') as HTMLElement).style.opacity).toBe('');
});

test('the native default clock keeps its window receivers for pause and destruction', () => {
  const original = data();
  const request = jest.spyOn(window, 'requestAnimationFrame').mockImplementation(function (this: Window) {
    expect(this).toBe(window); return 17;
  });
  const cancel = jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(function (this: Window) { expect(this).toBe(window); });
  try {
    const player = createHtmlPlaybackPlayer(original, { root: document.querySelector('main')! });
    player.play(); player.pause(); player.play(); player.destroy(); expect(cancel).toHaveBeenCalledWith(17);
  } finally { request.mockRestore(); cancel.mockRestore(); }
});

test('rejects invalid controls without changing state and detaches caller-owned data', () => {
  const original = data(); const input = mutable(original); const clock = createManualClock();
  const player = createHtmlPlaybackPlayer(input, { root: document.querySelector('main')!, clock });
  input.frames = {};
  for (const frame of [NaN, Infinity]) expect(() => player.seek(frame)).toThrow();
  for (const speed of [0, -1, Infinity]) expect(() => player.setSpeed(speed)).toThrow();
  player.seek(2); expect(player.currentFrame).toBe(2); expect(player.playing).toBe(false);
  player.destroy();
});
