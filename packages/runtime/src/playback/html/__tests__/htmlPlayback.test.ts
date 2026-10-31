// packages/runtime/src/playback/html/__tests__/htmlPlayback.test.ts
import type { ILayer } from '../../../model/layer';
import { docOf } from '../../../stage/__tests__/fakeStage';
import { compileHtmlPlayback } from '../compileHtmlPlayback';
import { createHtmlPlaybackPlayer } from '../createHtmlPlaybackPlayer';
import { parseHtmlPlayback } from '../parseHtmlPlayback';
import { exportHtmlJavascript } from '../exportHtmlJavascript';
import { createManualClock } from '../../../transport/manualClock';
import { createHtmlStage } from '../../../stage/html/createHtmlStage';
import { createHost, timeAt } from '../../../stage/__tests__/fakeStage';

function layer(selector: string, id: string, frame: number, value: number): ILayer {
  return { id, name: id, type: 'layer', target: { selector }, spans: [], propertyTimelines: {
    opacity: { initialValue: { kind: 'number', value: 1 }, keys: [{ frame, value: { kind: 'number', value } }] }
  } };
}
function fixture() {
  document.head.innerHTML = '<style>.button { opacity: 1 !important }</style>';
  document.body.innerHTML = '<main><button id="one" class="button" style="color:red"></button><button id="two" class="button"></button><button id="three" class="button"></button></main>';
  return { root: document.querySelector('main')!, doc: docOf([layer('.button', 'group', 1, 0.5), layer('#two', 'specific', 50, 0.8)], 100) };
}

test('compiles case 59 without editing source objects and replays direct seeks after DOM reordering', () => {
  const { root, doc } = fixture(); const before = JSON.stringify(doc);
  const result = compileHtmlPlayback(doc, { root });
  expect(result.status).toBe('exported'); if (result.status !== 'exported') return;
  expect(Object.keys(result.data.source.objects)).toEqual(['group', 'specific']);
  expect(JSON.stringify(doc)).toBe(before);
  const third = root.querySelector('#three')!; root.prepend(third);
  const player = createHtmlPlaybackPlayer(parseHtmlPlayback(JSON.parse(JSON.stringify(result.data))), { root });
  for (const frame of [100, 1, 49, 20.75, 50]) {
    player.seek(frame);
    expect((root.querySelector('#two') as HTMLElement).style.opacity).toBe('0.8');
    expect((root.querySelector('#one') as HTMLElement).style.opacity).toBe('0.5');
  }
  player.destroy();
  expect((root.querySelector('#one') as HTMLElement).style.cssText).toBe('color: red;');
  expect((root.querySelector('#two') as HTMLElement).style.opacity).toBe('');
});

test('refuses conflicts and missing or changed target groups atomically', () => {
  const { root, doc } = fixture();
  const conflict = compileHtmlPlayback(docOf([layer('.button', 'a', 1, 0.5), layer('.button', 'b', 1, 0.9)], 100), { root });
  expect(conflict.status).toBe('refused');
  const result = compileHtmlPlayback(doc, { root }); if (result.status !== 'exported') throw new Error('fixture');
  root.querySelector('#two')!.remove();
  expect(() => createHtmlPlaybackPlayer(result.data, { root })).toThrow();
  expect((root.querySelector('#one') as HTMLElement).style.opacity).toBe('');
});

test('parser rejects incomplete and executable JSON without invoking an accessor', () => {
  const { root, doc } = fixture(); const result = compileHtmlPlayback(doc, { root });
  if (result.status !== 'exported') throw new Error('fixture');
  const input = JSON.parse(JSON.stringify(result.data)) as { frames: Record<string, unknown> };
  delete input.frames['20']; expect(() => parseHtmlPlayback(input)).toThrow();
  const getter = jest.fn(); const evil = { ...result.data };
  Object.defineProperty(evil, 'frames', { enumerable: true, get: getter });
  expect(() => parseHtmlPlayback(evil)).toThrow(); expect(getter).not.toHaveBeenCalled();
});

test('source-stage suspension preserves preview while compilation inspects the original CSS', () => {
  const { root, doc } = fixture(); const stage = createHtmlStage({ root, mode: 'frame' }); const host = createHost([stage]);
  host.load(doc); host.render(timeAt(20));
  const result = compileHtmlPlayback(doc, { root, sourceStage: stage });
  expect(result.status).toBe('exported');
  expect((root.querySelector('#two') as HTMLElement).style.opacity).toBe('0.8');
  host.destroy(); expect((root.querySelector('#two') as HTMLElement).style.opacity).toBe('');
});

test('supports sampled playback speed, loop, pause, final hold and idempotent destruction', () => {
  const { root, doc } = fixture(); const result = compileHtmlPlayback(doc, { root });
  if (result.status !== 'exported') throw new Error('fixture');
  const clock = createManualClock(); const player = createHtmlPlaybackPlayer(result.data, { root, clock });
  player.play(); clock.advance(1000 / doc.settings.fps * 4); expect(player.currentFrame).toBe(5);
  player.setSpeed(2); clock.advance(1000 / doc.settings.fps); expect(player.currentFrame).toBe(7);
  player.pause(); expect(clock.pendingFrames).toBe(0); clock.advance(500); expect(player.currentFrame).toBe(7);
  player.seek(100); player.play(); clock.advance(1000 / doc.settings.fps); expect(player.currentFrame).toBe(100); expect(player.playing).toBe(false);
  player.loop = true; player.play(); clock.advance(1000 / doc.settings.fps * 51); expect(player.currentFrame).toBe(3);
  player.destroy(); player.destroy(); expect(clock.pendingFrames).toBe(0);
  expect(() => player.seek(1)).toThrow(/détruit/);
});

test('restores managed declarations after target removal during playback', () => {
  const { root, doc } = fixture(); const result = compileHtmlPlayback(doc, { root }); if (result.status !== 'exported') throw new Error('fixture');
  const clock = createManualClock(); const player = createHtmlPlaybackPlayer(result.data, { root, clock });
  player.play(); root.querySelector('#two')!.remove();
  expect(() => clock.advance(20)).toThrow(/cibles/); expect(player.playing).toBe(false);
  expect((root.querySelector('#one') as HTMLElement).style.cssText).toBe('color: red;'); player.destroy();
});

test('rejects incompatible source groups and non-HTML targets without a partial artifact', () => {
  const { root, doc } = fixture(); (root.querySelector('#two') as HTMLElement).style.opacity = '0.7';
  expect(compileHtmlPlayback(doc, { root }).status).toBe('refused');
  expect(compileHtmlPlayback(docOf([{ ...layer('.button', 'object', 1, 0.5), target: { ref: 'object', stage: 'objects' } }]), { root }).status).toBe('refused');
  expect(compileHtmlPlayback(doc, { root, maxCells: 1 }).status).toBe('refused');
});

test('splits different unanimated transform bases by verified IDs and refuses ambiguous anonymous elements', () => {
  const { root } = fixture();
  for (const [index, element] of Array.from(root.querySelectorAll<HTMLElement>('.button')).entries()) element.style.transform = `matrix(1, 0, 0, 1, 0, ${10 + index})`;
  const doc = docOf([{ id: 'move', name: 'move', type: 'layer', target: { selector: '.button' }, spans: [], propertyTimelines: {
    x: { initialValue: { kind: 'number', value: 0 }, keys: [{ frame: 1, value: { kind: 'number', value: 30 } }] }
  } }]);
  const result = compileHtmlPlayback(doc, { root }); expect(result.status).toBe('exported');
  if (result.status !== 'exported') return;
  expect(result.data.groups).toHaveLength(3);
  const player = createHtmlPlaybackPlayer(result.data, { root });
  expect((root.querySelector('#one') as HTMLElement).style.transform).toContain('translate(30px, 10px)');
  expect((root.querySelector('#two') as HTMLElement).style.transform).toContain('translate(30px, 11px)');
  player.destroy();
  for (const element of root.querySelectorAll('.button')) element.removeAttribute('id');
  expect(compileHtmlPlayback(doc, { root }).status).toBe('refused');
});

test('keeps blank-span visibility and unrelated inline styles when seeking backwards', () => {
  const { root } = fixture();
  const doc = docOf([{ id: 'legacy', name: 'legacy', type: 'layer', target: { selector: '.button' }, spans: [
    { id: 'visible', kind: 'static', start: 1, end: 4, tracks: { opacity: [{ frame: 1, value: .4 }] } },
    { id: 'blank', kind: 'blank', start: 5, end: 10 }
  ] }]);
  const result = compileHtmlPlayback(doc, { root }); if (result.status !== 'exported') throw new Error('fixture');
  const player = createHtmlPlaybackPlayer(result.data, { root });
  player.seek(8); expect((root.querySelector('#one') as HTMLElement).style.visibility).toBe('hidden');
  player.seek(2); expect((root.querySelector('#one') as HTMLElement).style.visibility).toBe('visible');
  player.destroy(); expect((root.querySelector('#one') as HTMLElement).style.cssText).toBe('color: red;');
});

test('escapes embedded JSON and emits only the standalone entry point without dynamic execution', () => {
  const { root, doc } = fixture();
  const modified = { ...doc, layers: doc.layers.map((item) => ({ ...item, name: '</script>\u2028\u2029"quoted"' })) };
  const result = compileHtmlPlayback(modified, { root }); if (result.status !== 'exported') throw new Error('fixture');
  const code = exportHtmlJavascript(result.data);
  expect(code).toContain('export function createPlayer(options)'); expect(code).toContain('\\u003c/script>');
  expect(code).not.toContain('</script>'); expect(code).not.toMatch(/\beval\s*\(|new Function\s*\(|\bimport\s/);
  expect(code).not.toContain('\u2028'); expect(code).not.toContain('\u2029');
});
