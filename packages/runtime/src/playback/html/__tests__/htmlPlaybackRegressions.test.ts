// packages/runtime/src/playback/html/__tests__/htmlPlaybackRegressions.test.ts
import type { ITimelineDocument } from '../../../model/document';
import { compileHtmlPlayback } from '../compileHtmlPlayback';
import { createHtmlPlaybackPlayer } from '../createHtmlPlaybackPlayer';

const source: ITimelineDocument = { version: '2.0.0', settings: { fps: 20, totalFrames: 2 }, layers: [
  { id: 'move', name: 'Move', type: 'layer', target: { selector: '.item' }, spans: [], propertyTimelines: {
    x: { initialValue: { kind: 'number', value: 0 }, keys: [{ frame: 1, value: { kind: 'number', value: 30 } }] }
  } }
] };

test('cancels the old scheduled frame when a speed change reaches the end before RAF fires', () => {
  document.body.innerHTML = '<main><div class="item"></div></main>';
  const root = document.querySelector('main')!;
  const result = compileHtmlPlayback(source, { root });
  if (result.status !== 'exported') throw new Error(JSON.stringify(result.diagnostics));
  let now = 0; let nextHandle = 0;
  const callbacks = new Map<number, () => void>();
  const clock = { now: () => now,
    requestFrame: (callback: () => void) => { callbacks.set(++nextHandle, callback); return nextHandle; },
    cancelFrame: (handle: number) => { callbacks.delete(handle); }
  };
  const player = createHtmlPlaybackPlayer(result.data, { root, clock });
  player.play(); expect(callbacks.size).toBe(1);
  now = 110; player.setSpeed(2);
  expect(player.playing).toBe(false); expect(player.currentFrame).toBe(2); expect(callbacks.size).toBe(0);
  player.play(); player.play(); expect(player.currentFrame).toBe(1); expect(callbacks.size).toBe(1);
  player.destroy(); player.destroy(); expect(callbacks.size).toBe(0);
  expect(root.querySelector('div')!.getAttribute('style')).toBeNull();
});

test('splits distinct transform bases using complete non-BMP ID code points', () => {
  document.body.innerHTML = '<main><div class="item" id="button-💫" style="transform:matrix(1,0,0,1,0,10)"></div>' +
    '<div class="item" id="button-𝄞" style="transform:matrix(1,0,0,1,0,20)"></div></main>';
  const root = document.querySelector('main')!;
  const originals = Array.from(root.querySelectorAll<HTMLElement>('div')).map((element) => element.style.transform);
  const result = compileHtmlPlayback(source, { root });
  expect(result.status).toBe('exported'); if (result.status !== 'exported') return;
  expect(result.data.groups).toHaveLength(2);
  const first = document.getElementById('button-💫')!; const second = document.getElementById('button-𝄞')!;
  root.prepend(second);
  const player = createHtmlPlaybackPlayer(result.data, { root }); player.seek(2);
  expect(first.style.transform).toContain('translate(30px, 10px)');
  expect(second.style.transform).toContain('translate(30px, 20px)');
  player.destroy(); expect(first.style.transform).toBe(originals[0]); expect(second.style.transform).toBe(originals[1]);
});
