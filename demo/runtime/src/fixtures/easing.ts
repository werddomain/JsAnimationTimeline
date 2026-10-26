// demo/runtime/src/fixtures/easing.ts
/** Permanent W3 fixture using the real editor, default plugins and HTML stage. */
import { createEditor } from '@werddomain/timeline-editor';
import type { IEditor } from '@werddomain/timeline-editor';
import type { ITimelineDocument } from '@werddomain/timeline-runtime';
import { createSetLockedCommand } from '../../../../packages/editor/src/plugins/layers/lock/lockCommands';


export interface IEasingFixture {
  readonly ready: true;
  readonly editor: IEditor;
  seek(frame: number): void;
  lock(): void;
}

declare global { interface Window { easingFixture?: IEasingFixture; } }

function element(id: string): HTMLElement {
  const found = document.getElementById(id);
  if (found === null) throw new Error(`Missing W3 fixture element: ${id}`);
  return found;
}

const data: ITimelineDocument = { version: '2.0.0', settings: { fps: 24, totalFrames: 20 }, layers: [{
  id: 'easing-layer', type: 'layer', name: 'Objet animé', target: { selector: '#easing-object' }, spans: [{
    id: 'easing-span', start: 1, end: 11, kind: 'tween', tracks: {
      x: [{ frame: 1, value: 0 }, { frame: 6, value: 90 }, { frame: 11, value: 160 }],
      opacity: [{ frame: 1, value: 0.3 }, { frame: 11, value: 1 }]
    }
  }, { id: 'easing-static', start: 12, end: 20, kind: 'static' }]
}] };
const editor = createEditor(element('editor-host'), { data });
function seek(frame: number): void {
  editor.playback.seek(frame);
  element('sample').textContent = `x = ${editor.sample(frame).layers[0].values.x.toFixed(3)}`;
}
element('open-easing').addEventListener('click', () => { editor.getService('tweens.easing')?.openAt('easing-layer', 6); });
element('undo-easing').addEventListener('click', () => { editor.undo(); seek(editor.playback.frame); });
element('redo-easing').addEventListener('click', () => { editor.redo(); seek(editor.playback.frame); });
element('frame').addEventListener('change', (event) => { seek(Number((event.target as HTMLInputElement).value)); });
editor.on('document:changed', () => { seek(editor.playback.frame); });
window.easingFixture = { ready: true, editor, seek, lock: () => { editor.execute(createSetLockedCommand(editor.document, 'easing-layer', true)); } };
window.addEventListener('pagehide', (event) => { if (!event.persisted) editor.destroy(); });
seek(6);
const style = document.createElement('style');
style.textContent = 'body{margin:0;background:#f6f4ef;color:#20252b;font:16px system-ui}main{max-width:1100px;margin:auto;padding:16px}h1{font-size:1.7rem}section{height:110px;border-bottom:2px solid #496479;overflow:hidden}#easing-object{width:100px;padding:16px 8px;background:#17645c;color:white}button,input{font:inherit;padding:8px}#editor-host{height:360px;min-width:0;overflow:hidden}';
document.head.append(style);

