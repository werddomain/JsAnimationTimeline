// demo/editor/src/cssExports.ts
import { createHtmlStage, createManualClock, createPlayer } from '@kazo-ca/timeline-runtime';
import { exportHtmlCss } from '@kazo-ca/timeline-export-css';
import type { ITimelineDocument } from '@kazo-ca/timeline-runtime';
import { createAnimation, createScene, FPS, htmlContext, readScene, TOTAL_FRAMES } from './cssExportsScene';
import type { ICssSceneSnapshot } from './cssExportsScene';
import './cssExports.less';

function node<T extends HTMLElement>(id: string, constructor: { new(...args: never[]): T }): T {
  const found = document.getElementById(id);
  if (!(found instanceof constructor)) throw new Error(`Missing demo element: ${id}`);
  return found;
}
const status = node('export-status', HTMLParagraphElement);
const frameInput = node('frame-input', HTMLInputElement);
const output = node('frame-output', HTMLOutputElement);
const curveSelect = node('curve-select', HTMLSelectElement);
const cssFrame = node('css-frame', HTMLIFrameElement);
const sourceRoot = createScene(document); node('source-scene', HTMLDivElement).append(sourceRoot);

function createSource(document: ITimelineDocument) {
  const stage = createHtmlStage({ root: sourceRoot, mode: 'frame', animationContext: htmlContext });
  return { document, stage, player: createPlayer(document, { stage, clock: createManualClock() }) };
}
let source = createSource(createAnimation('linear'));
let originalEditable = JSON.stringify(source.document);
let sourceDestroyed = false;
let loading = false;
let currentFrame = 1;
let playing = false;
let frameHandle: number | undefined;
let loaded: ILoadedCss | undefined;
let refusedCss = '';

interface ILoadedCss {
  readonly root: HTMLElement; readonly outside: HTMLElement; readonly stylesheet: HTMLStyleElement;
  readonly css: string; readonly animations: readonly Animation[];
}
function controls(disabled: boolean): void {
  document.querySelectorAll<HTMLButtonElement>('[data-css-control]').forEach((button) => { button.disabled = disabled; });
}
function pause(): void {
  playing = false;
  if (frameHandle !== undefined) cancelAnimationFrame(frameHandle);
  frameHandle = undefined;
}
function showFrame(frame: number): void {
  if (!Number.isFinite(frame)) return;
  currentFrame = Math.min(TOTAL_FRAMES, Math.max(1, frame));
  if (!sourceDestroyed) source.player.seek(currentFrame);
  loaded?.animations.forEach((animation) => { animation.currentTime = (currentFrame - 1) * 1000 / FPS; });
  frameInput.value = String(currentFrame);
  output.value = `Image ${Number(currentFrame.toFixed(3))} / ${TOTAL_FRAMES}`;
  output.dataset.frame = String(currentFrame);
}
function play(): void {
  if (loaded === undefined || sourceDestroyed || playing) return;
  if (currentFrame >= TOTAL_FRAMES) showFrame(1);
  playing = true;
  const start = performance.now(); const from = currentFrame;
  const tick = (time: number): void => {
    frameHandle = undefined;
    if (!playing) return;
    showFrame(from + (time - start) * FPS / 1000);
    if (currentFrame >= TOTAL_FRAMES) { pause(); return; }
    frameHandle = requestAnimationFrame(tick);
  };
  frameHandle = requestAnimationFrame(tick);
}

async function prepareOutput(css: string): Promise<ILoadedCss> {
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => { cssFrame.removeEventListener('load', ready); cssFrame.removeEventListener('error', failed); };
    const ready = () => { cleanup(); resolve(); };
    const failed = () => { cleanup(); reject(new Error('La scène CSS ne peut pas être chargée.')); };
    cssFrame.addEventListener('load', ready, { once: true }); cssFrame.addEventListener('error', failed, { once: true });
    cssFrame.srcdoc = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"></body></html>';
  });
  const owner = cssFrame.contentDocument;
  if (owner === null) throw new Error('La scène CSS est inaccessible.');
  const root = createScene(owner); owner.body.append(root);
  const outside = owner.createElement('button'); outside.className = 'button'; outside.type = 'button';
  outside.textContent = 'Voisin hors de la scène · non animé'; outside.style.margin = '8px 14px'; owner.body.append(outside);
  const stylesheet = owner.createElement('style'); stylesheet.textContent = css; owner.head.append(stylesheet);
  const animations = root.getAnimations({ subtree: true });
  animations.forEach((animation) => { animation.pause(); animation.currentTime = 0; });
  return { root, outside, stylesheet, css, animations };
}
function compile(document: ITimelineDocument) {
  return exportHtmlCss(document, { root: sourceRoot, rootSelector: '#css-scene', animationContext: htmlContext,
    ...(sourceDestroyed ? {} : { sourceStage: source.stage }) });
}
async function compileAndLoad(): Promise<void> {
  if (loading) return;
  loading = true; pause(); controls(true); node('compile-css', HTMLButtonElement).disabled = true;
  status.textContent = 'Vérification de la courbe et préparation du CSS…';
  try {
    const candidate = createAnimation(curveSelect.value === 'bezier' ? 'bezier' : 'linear');
    const result = compile(candidate);
    if (result.status === 'refused') throw new Error(result.diagnostics.map((issue) => issue.message).join(' '));
    const next = await prepareOutput(result.css);
    loaded?.animations.forEach((animation) => animation.cancel()); loaded = next;
    if (!sourceDestroyed) source.player.destroy();
    source = createSource(candidate); sourceDestroyed = false; originalEditable = JSON.stringify(candidate);
    showFrame(currentFrame); controls(false);
    node('css-output', HTMLPreElement).textContent = result.css;
    node('document-state', HTMLParagraphElement).textContent = 'Document éditable : inchangé.';
    status.textContent = 'CSS continu chargé. Les deux scènes partagent les mêmes valeurs, y compris entre les images.';
  } catch (error) {
    status.textContent = `Export refusé : ${error instanceof Error ? error.message : String(error)}`;
    controls(loaded === undefined || sourceDestroyed);
  } finally { loading = false; node('compile-css', HTMLButtonElement).disabled = false; }
}
function showRefusal(document: ITimelineDocument): void {
  const result = compile(document); refusedCss = result.css;
  node('refusal-status', HTMLParagraphElement).textContent = result.status === 'refused'
    ? `Export refusé : ${result.diagnostics.map((issue) => issue.message).join(' ')} Utilisez le JavaScript ou le JSON de lecture.`
    : 'Cette animation peut être exportée en CSS.';
  node('document-state', HTMLParagraphElement).textContent = JSON.stringify(source.document) === originalEditable
    ? 'Document éditable : inchangé.' : 'Le document éditable a changé.';
}
function restore(): void {
  pause(); loaded?.animations.forEach((animation) => animation.cancel()); loaded?.stylesheet.remove();
  if (!sourceDestroyed) source.player.destroy(); sourceDestroyed = true; controls(true);
  status.textContent = 'Styles d’origine restaurés. Les autres styles et le voisin hors de la scène sont conservés.';
}

node('compile-css', HTMLButtonElement).addEventListener('click', () => { void compileAndLoad(); });
node('seek-form', HTMLFormElement).addEventListener('submit', (event) => { event.preventDefault(); pause(); showFrame(Number(frameInput.value)); });
node('play-css', HTMLButtonElement).addEventListener('click', play);
node('pause-css', HTMLButtonElement).addEventListener('click', pause);
node('download-css', HTMLButtonElement).addEventListener('click', () => {
  if (loaded === undefined) return;
  const url = URL.createObjectURL(new Blob([loaded.css], { type: 'text/css' }));
  const link = document.createElement('a'); link.href = url; link.download = 'timeline-animation.css'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
node('test-elastic', HTMLButtonElement).addEventListener('click', () => { showRefusal(createAnimation('elastic')); });
node('test-important', HTMLButtonElement).addEventListener('click', () => {
  const rule = document.createElement('style'); rule.textContent = '.JsTimeLine.css-export-scene #motion-tile { opacity:1!important; }';
  sourceRoot.append(rule);
  try { showRefusal(source.document); } finally { rule.remove(); }
});
node('restore-styles', HTMLButtonElement).addEventListener('click', restore);
window.addEventListener('pagehide', (event) => { if (!event.persisted) restore(); });

interface ICssExportSnapshot {
  readonly source: ICssSceneSnapshot; readonly cssScene?: ICssSceneSnapshot; readonly outsideOpacity?: string;
  readonly editable: string; readonly frame: number; readonly playing: boolean; readonly css: string;
  readonly animations: number; readonly refusedCss: string;
}
/** Observation only: reusable browser tests navigate through the visible controls. */
export interface ICssExportsFixture { snapshot(): ICssExportSnapshot }
window.cssExportsFixture = Object.freeze({ snapshot: () => ({ source: readScene(sourceRoot),
  cssScene: loaded === undefined ? undefined : readScene(loaded.root),
  outsideOpacity: loaded?.outside.ownerDocument.defaultView?.getComputedStyle(loaded.outside).opacity,
  editable: JSON.stringify(source.document), frame: currentFrame, playing, css: loaded?.css ?? '',
  animations: loaded?.root.getAnimations({ subtree: true }).length ?? 0, refusedCss
}) });
declare global { interface Window { cssExportsFixture?: ICssExportsFixture } }
