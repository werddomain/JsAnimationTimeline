// demo/editor/src/scene.ts
import { createEditor, createPropertiesPanelPlugin } from '@kazo-ca/timeline-editor';
import type { IEditor, IFrameSample } from '@kazo-ca/timeline-editor';
import { defaultPropertyRegistry, floorInterpolator } from '@kazo-ca/timeline-runtime';
import type { IStage } from '@kazo-ca/timeline-runtime';
import { AudioTrack, createAudioStage } from '../../runtime/src/objectStage/audioStage';
import { createCanvasStage, createSprite, drawScene } from '../../runtime/src/objectStage/canvasStage';
import { OBJECT_STAGE_DOCUMENT } from '../../runtime/src/objectStage/document';
import './style.css';

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (found === null) throw new Error(`Missing element: ${id}`);
  return found as T;
}
const host = element<HTMLElement>('editor-host');
const canvas = element<HTMLCanvasElement>('canvas');
const context = canvas.getContext('2d');
if (context === null) throw new Error('Canvas unavailable');
const drawing = context;
const track = new AudioTrack();
const sprite = createSprite();
const canvasStage = createCanvasStage(drawing, [], sprite);
const audioObjectStage = createAudioStage(track, []);
// Editor visibility also mutes the supplied audio stage; runtime playback is unchanged.
const audioStage: IStage<AudioTrack> = { ...audioObjectStage,
  render(time, states): void {
    audioObjectStage.render?.(time, states.map((state) => ({ ...state, active: state.active && state.editorVisible })));
  }
};
const data = { ...OBJECT_STAGE_DOCUMENT, layers: OBJECT_STAGE_DOCUMENT.layers.slice(0, 2) };
const registry = defaultPropertyRegistry.clone()
  .register({ name: 'frameIndex', kind: 'value', unit: '', defaultValue: 0, interpolate: floorInterpolator })
  .register({ name: 'volume', kind: 'value', unit: '', defaultValue: 1, min: 0, max: 1 });
let editor: IEditor;
let unsubscribe: (() => void) | undefined;
function renderSample(sample: IFrameSample): void {
  const hero = sample.layer('hero');
  const music = sample.layer('music');
  if (hero !== undefined) {
    sprite.visible = hero.active && hero.editorVisible;
    sprite.x = hero.values.x; sprite.y = hero.values.y;
    sprite.angle = hero.values.rotation; sprite.frame = hero.values.frameIndex;
  } else {
    Object.assign(sprite, createSprite());
  }
  track.setVolume(music !== undefined && music.active && music.editorVisible ? music.values.volume : 0);
  drawScene(drawing, [sprite]);
  element('status').textContent = `Image ${sample.time.integerFrame} · position ${sprite.x.toFixed(1)} · sprite ${sprite.frame} · volume ${track.volume.toFixed(2)}`;
}
function start(mode: string): void {
  unsubscribe?.();
  editor?.destroy();
  track.setPlaying(false);
  track.setVolume(0);
  Object.assign(sprite, createSprite());
  drawScene(drawing, [sprite]);
  // Supplied stages contribute their own frameIndex and volume descriptors to the editor registry.
  editor = mode === 'manual'
    ? createEditor(host, { data: structuredClone(data), stage: false, registry, plugins: [createPropertiesPanelPlugin()] })
    : createEditor(host, { data: structuredClone(data), stage: [canvasStage, audioStage], plugins: [createPropertiesPanelPlugin()] });
  window.editorDemo = editor;
  unsubscribe = editor.onFrame((sample) => {
    if (mode === 'manual') renderSample(sample);
    else element('status').textContent = `Image ${sample.time.integerFrame} · position ${sprite.x.toFixed(1)} · sprite ${sprite.frame} · volume ${track.volume.toFixed(2)}`;
  });
  if (mode === 'manual') {
    renderSample(editor.sample());
    editor.on('playback:play', () => track.setPlaying(true));
    editor.on('playback:pause', () => track.setPlaying(false));
    editor.on('playback:complete', () => track.setPlaying(false));
  }
}
const mode = element<HTMLSelectElement>('mode');
mode.addEventListener('change', () => start(mode.value));
element<HTMLButtonElement>('sound').addEventListener('click', () => {
  void track.start().then(() => { element('sound-status').textContent = 'Son activé'; }, () => { element('sound-status').textContent = 'Le son n’a pas pu être activé'; });
});
document.addEventListener('visibilitychange', () => track.setVisible(!document.hidden));
window.addEventListener('pagehide', (event) => { if (!event.persisted) { unsubscribe?.(); editor.destroy(); track.dispose(); } else track.setVisible(false); });
window.addEventListener('pageshow', (event) => { if (event.persisted) track.setVisible(!document.hidden); });
start(mode.value);

