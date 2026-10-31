// demo/editor/src/playbackExports.ts
import { compileHtmlPlayback, compilePlayback, createHtmlPlaybackPlayer, createHtmlStage, createPlaybackPlayer,
  createPlayer, evaluateDocument, exportHtmlJavascript, parseHtmlPlayback, parsePlayback } from '@kazo-ca/timeline-runtime';
import type { IHtmlPlaybackDocument, IPlaybackDocument, IPlaybackFrame, IPlayerClock } from '@kazo-ca/timeline-runtime';
import { animation, createScene, genericAnimation, htmlContext, readScene } from './playbackExportsScene';
import type { ISceneSnapshot } from './playbackExportsScene';
import './playbackExports.less';

function node<T extends HTMLElement>(id: string, constructor: { new(...args: never[]): T }): T {
  const found = document.getElementById(id);
  if (!(found instanceof constructor)) throw new Error(`Missing demo element: ${id}`);
  return found;
}
const status = node('export-status', HTMLParagraphElement);
const frameInput = node('frame-input', HTMLInputElement);
const output = node('frame-output', HTMLOutputElement);
const jsonFrame = node('json-frame', HTMLIFrameElement);
const javascriptFrame = node('javascript-frame', HTMLIFrameElement);
const sourceRoot = createScene(document); node('source-scene', HTMLDivElement).append(sourceRoot);
const initialEditable = JSON.stringify(animation);
const clock: IPlayerClock = { now: () => performance.now(), requestFrame: (callback) => requestAnimationFrame(callback),
  cancelFrame: (handle) => cancelAnimationFrame(handle) };

function createSource() {
  const stage = createHtmlStage({ root: sourceRoot, mode: 'frame', animationContext: htmlContext });
  return { stage, player: createPlayer(animation, { stage, clock }) };
}
let source = createSource();
let sourceDestroyed = false;
let loaded: ILoadedExports | undefined;
let loading = false;
let currentFrame = 1;
let genericFrame: IPlaybackFrame = {};

/** The generated module exposes this small control surface; no Timeline code is imported into its page. */
interface IStandaloneController { readonly currentFrame: number; readonly playing: boolean; play(): void; pause(): void; seek(frame: number): void; destroy(): void }
interface ILoadedExports {
  readonly data: IHtmlPlaybackDocument;
  readonly generic: IPlaybackDocument;
  readonly jsonText: string;
  readonly moduleSource: string;
  readonly jsonRoot: HTMLElement;
  readonly javascriptRoot: HTMLElement;
  jsonPlayer: ReturnType<typeof createHtmlPlaybackPlayer>;
  readonly javascriptPlayer: IStandaloneController;
  readonly genericPlayer: ReturnType<typeof createPlaybackPlayer>;
}

async function prepareFrame(frame: HTMLIFrameElement): Promise<HTMLElement> {
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => { frame.removeEventListener('load', ready); frame.removeEventListener('error', failed); };
    const ready = () => { cleanup(); resolve(); };
    const failed = () => { cleanup(); reject(new Error('La page isolée ne peut pas être chargée.')); };
    frame.addEventListener('load', ready, { once: true });
    frame.addEventListener('error', failed, { once: true });
    frame.srcdoc = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"></body></html>';
  });
  const owner = frame.contentDocument;
  if (owner === null) throw new Error('La page isolée est inaccessible.');
  const root = createScene(owner); owner.body.append(root); return root;
}

async function loadStandalone(moduleSource: string): Promise<{ root: HTMLElement; player: IStandaloneController }> {
  const root = await prepareFrame(javascriptFrame);
  const owner = root.ownerDocument;
  const view = owner.defaultView;
  if (view === null) throw new Error('La fenêtre de lecture est inaccessible.');
  const moduleUrl = URL.createObjectURL(new Blob([moduleSource], { type: 'text/javascript' }));
  const boot = `import { createPlayer } from ${JSON.stringify(moduleUrl)};
try { window.ha5Standalone = createPlayer({root: document.querySelector('.export-scene')}); window.dispatchEvent(new Event('ha5-ready')); }
catch (error) { window.dispatchEvent(new CustomEvent('ha5-failed', {detail: error instanceof Error ? error.message : String(error)})); }`;
  const bootUrl = URL.createObjectURL(new Blob([boot], { type: 'text/javascript' }));
  try {
    await new Promise<void>((resolve, reject) => {
      const ready = () => { cleanup(); resolve(); };
      const failed = (event: Event) => { cleanup(); reject(new Error(event instanceof view.CustomEvent ? String(event.detail) : 'Le module ne peut pas être chargé.')); };
      const cleanup = () => { view.removeEventListener('ha5-ready', ready); view.removeEventListener('ha5-failed', failed); };
      view.addEventListener('ha5-ready', ready, { once: true }); view.addEventListener('ha5-failed', failed, { once: true });
      const script = owner.createElement('script'); script.type = 'module'; script.src = bootUrl;
      script.addEventListener('error', failed, { once: true }); owner.body.append(script);
    });
    if (view.ha5Standalone === undefined) throw new Error('Le module ne fournit pas de lecteur.');
    return { root, player: view.ha5Standalone };
  } finally { URL.revokeObjectURL(moduleUrl); URL.revokeObjectURL(bootUrl); }
}

function controls(disabled: boolean): void {
  document.querySelectorAll<HTMLButtonElement>('[data-export-control]').forEach((button) => { button.disabled = disabled; });
}
function disposeExports(): void {
  loaded?.jsonPlayer.destroy(); loaded?.javascriptPlayer.destroy(); loaded?.genericPlayer.destroy();
}
function showFrame(frame: number): void {
  currentFrame = Math.min(100, Math.max(1, Math.floor(frame)));
  frameInput.value = String(frame); output.value = `Image ${currentFrame} / 100`; output.dataset.frame = String(currentFrame);
}
function seek(frame: number): void {
  if (loaded === undefined || !Number.isFinite(frame)) return;
  source.player.pause(); loaded.jsonPlayer.pause(); loaded.javascriptPlayer.pause(); loaded.genericPlayer.pause();
  const integer = Math.min(100, Math.max(1, Math.floor(frame)));
  source.player.seek(integer); loaded.jsonPlayer.seek(frame); loaded.javascriptPlayer.seek(frame); loaded.genericPlayer.seek(frame);
  showFrame(frame);
}

async function compileAndLoad(): Promise<void> {
  if (loading) return;
  loading = true; controls(true); node('compile-exports', HTMLButtonElement).disabled = true;
  status.textContent = 'Compilation et chargement des trois lecteurs…';
  try {
    if (sourceDestroyed) { source = createSource(); sourceDestroyed = false; }
    const html = compileHtmlPlayback(animation, { root: sourceRoot, animationContext: htmlContext, sourceStage: source.stage });
    const generic = compilePlayback(genericAnimation);
    if (html.status === 'refused') throw new Error(html.diagnostics.map((entry) => entry.message).join(' '));
    if (generic.status === 'refused') throw new Error(generic.diagnostics.map((entry) => entry.message).join(' '));
    const jsonText = JSON.stringify(html.data);
    const moduleSource = exportHtmlJavascript(html.data);
    disposeExports();
    const jsonRoot = await prepareFrame(jsonFrame);
    const standalone = await loadStandalone(moduleSource);
    const jsonPlayer = createHtmlPlaybackPlayer(parseHtmlPlayback(JSON.parse(jsonText)), { root: jsonRoot, clock });
    const genericPlayer = createPlaybackPlayer(parsePlayback(JSON.parse(JSON.stringify(generic.data))), { clock,
      render: (values, time) => { genericFrame = values; node('generic-values', HTMLPreElement).textContent = JSON.stringify(values, null, 2); showFrame(time.integerFrame); }
    });
    loaded = { data: html.data, generic: generic.data, jsonText, moduleSource, jsonRoot, javascriptRoot: standalone.root,
      jsonPlayer, javascriptPlayer: standalone.player, genericPlayer };
    seek(1); controls(false);
    node('html-json', HTMLPreElement).textContent = JSON.stringify(html.data, null, 2);
    node('document-state', HTMLParagraphElement).textContent = JSON.stringify(animation) === initialEditable ? 'Document éditable : inchangé.' : 'Le document éditable a changé.';
    status.textContent = 'Exports chargés. Accès direct disponible sur les 100 images, dans les trois lecteurs.';
  } catch (error) { status.textContent = `Chargement refusé : ${error instanceof Error ? error.message : String(error)}`; }
  finally { loading = false; node('compile-exports', HTMLButtonElement).disabled = false; }
}

function download(name: string, contents: string, type: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
node('compile-exports', HTMLButtonElement).addEventListener('click', () => { void compileAndLoad(); });
node('seek-form', HTMLFormElement).addEventListener('submit', (event) => { event.preventDefault(); seek(Number(frameInput.value)); });
node('play-exports', HTMLButtonElement).addEventListener('click', () => {
  if (loaded === undefined) return;
  source.player.play(); loaded.jsonPlayer.play(); loaded.javascriptPlayer.play(); loaded.genericPlayer.play();
});
node('pause-exports', HTMLButtonElement).addEventListener('click', () => seek(loaded?.genericPlayer.frame ?? currentFrame));
node('reload-json', HTMLButtonElement).addEventListener('click', () => {
  if (loaded === undefined) return;
  seek(currentFrame); loaded.jsonPlayer.destroy();
  loaded.jsonPlayer = createHtmlPlaybackPlayer(parseHtmlPlayback(JSON.parse(loaded.jsonText)), { root: loaded.jsonRoot, clock });
  loaded.jsonPlayer.seek(currentFrame); status.textContent = 'JSON relu. La même image est reconstruite sans rejouer les précédentes.';
});
node('download-html', HTMLButtonElement).addEventListener('click', () => { if (loaded !== undefined) download('timeline-html-playback.json', loaded.jsonText, 'application/json'); });
node('download-js', HTMLButtonElement).addEventListener('click', () => { if (loaded !== undefined) download('timeline-playback.mjs', loaded.moduleSource, 'text/javascript'); });
node('download-generic', HTMLButtonElement).addEventListener('click', () => { if (loaded !== undefined) download('timeline-playback.json', JSON.stringify(loaded.generic, null, 2), 'application/json'); });
node('test-conflict', HTMLButtonElement).addEventListener('click', () => {
  const conflicting = { ...animation, layers: [...animation.layers, { id: 'rival', type: 'layer' as const, name: 'Règle concurrente', target: { selector: '.button' }, spans: [],
    propertyTimelines: { opacity: { initialValue: { kind: 'number' as const, value: 1 }, keys: [{ frame: 1, value: { kind: 'number' as const, value: .3 } }] } } }] };
  const result = compileHtmlPlayback(conflicting, { root: sourceRoot, animationContext: htmlContext, sourceStage: source.stage });
  node('refusal-status', HTMLParagraphElement).textContent = result.status === 'refused' ? `Export refusé : ${result.diagnostics.map((entry) => entry.message).join(' ')}` : 'Ce document a été exporté.';
});
node('restore-styles', HTMLButtonElement).addEventListener('click', () => {
  disposeExports(); source.player.destroy(); sourceDestroyed = true; controls(true);
  status.textContent = 'Styles d’origine restaurés. Les styles voisins, dont le contour du dégradé, sont conservés.';
});
window.addEventListener('pagehide', (event) => { if (!event.persisted) { disposeExports(); if (!sourceDestroyed) source.player.destroy(); } });

interface IExportSnapshot {
  readonly source: ISceneSnapshot; readonly json?: ISceneSnapshot; readonly javascript?: ISceneSnapshot;
  readonly editable: string; readonly genericFrame: IPlaybackFrame; readonly genericSource: IPlaybackFrame;
  readonly frame: number; readonly playing: boolean; readonly moduleSource: string;
  readonly htmlSourceObjects: readonly string[]; readonly javascriptRequests: readonly string[]; readonly injected: boolean;
}
/** Observation only: browser tests operate through the visible controls. */
export interface IPlaybackExportsFixture { snapshot(): IExportSnapshot }
window.playbackExportsFixture = Object.freeze({ snapshot: () => ({
  source: readScene(sourceRoot), json: loaded === undefined ? undefined : readScene(loaded.jsonRoot),
  javascript: loaded === undefined ? undefined : readScene(loaded.javascriptRoot), editable: JSON.stringify(animation), genericFrame,
  genericSource: Object.fromEntries(evaluateDocument(genericAnimation, currentFrame).map((state) => [state.layerId, { active: state.visible, values: state.propertyValues ?? {} }])),
  frame: currentFrame, playing: loaded?.genericPlayer.playing ?? false, moduleSource: loaded?.moduleSource ?? '',
  htmlSourceObjects: Object.keys(loaded?.data.source.objects ?? {}),
  javascriptRequests: javascriptFrame.contentWindow?.performance.getEntriesByType('resource').map((entry) => entry.name).filter((name) => /^https?:/.test(name)) ?? [],
  injected: window.ha5Injected === true || javascriptFrame.contentWindow?.ha5Injected === true
}) });
declare global { interface Window { playbackExportsFixture?: IPlaybackExportsFixture; ha5Standalone?: IStandaloneController; ha5Injected?: boolean } }
