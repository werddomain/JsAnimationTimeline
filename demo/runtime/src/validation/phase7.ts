// demo/runtime/src/validation/phase7.ts
/** Reusable X1/X2 inspection page; all animation behavior comes from the public packages. */
import { createPlayer, defaultPropertyRegistry } from '@werddomain/timeline-runtime';
import type { IPlayer, ISpan, ITimelineDocument, PropertyTracks } from '@werddomain/timeline-runtime';
import { exportCss } from '@werddomain/timeline-export-css';
import type { IExportCssWarning } from '@werddomain/timeline-export-css';
import { DEMO_ANIMATION } from '../animation';
import type { IPhase7RenderedState, IPhase7Snapshot, Phase7Selector } from './phase7Types';
import sceneCss from './phase7Scene.less?inline';
import './phase7.less';

const SELECTORS: readonly Phase7Selector[] = ['#logo', '#logo-mark', '#ball'];
const SCENE_MARKUP = '<div class="grid"></div><div class="axis"><span>0 px</span><span>150 px</span><span>300 px</span><span>450 px</span></div><div class="floor"></div><div id="logo"><span id="logo-mark">◆</span>JST</div><div id="ball"></div>';

function required<T extends Element>(selector: string, root: ParentNode = document): T {
  const element = root.querySelector<T>(selector);
  if (element === null) throw new Error(`Missing validation element: ${selector}`);
  return element;
}

function createScene(hostId: string): ShadowRoot {
  const root = required<HTMLElement>(`#${hostId}`).attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = sceneCss;
  const content = document.createElement('div');
  content.className = 'JsTimeLine';
  // Fixed local markup only; no document or user value is interpolated into HTML.
  content.innerHTML = SCENE_MARKUP;
  root.append(style, content);
  return root;
}

function renderedStates(root: ShadowRoot): Record<Phase7Selector, IPhase7RenderedState> {
  const result = {} as Record<Phase7Selector, IPhase7RenderedState>;
  for (const selector of SELECTORS) {
    const style = getComputedStyle(required<Element>(selector, root));
    const matrix = new DOMMatrix(style.transform === 'none' ? undefined : style.transform);
    result[selector] = {
      tx: matrix.m41, ty: matrix.m42,
      linear: [matrix.m11, matrix.m12, matrix.m21, matrix.m22],
      opacity: Number(style.opacity), visibility: style.visibility
    };
  }
  return result;
}

function agrees(left: IPhase7RenderedState, right: IPhase7RenderedState): boolean {
  return left.visibility === right.visibility && Math.abs(left.tx - right.tx) < 0.005 &&
    Math.abs(left.ty - right.ty) < 0.005 && Math.abs(left.opacity - right.opacity) < 0.0005 &&
    left.linear.every((value, index) => Math.abs(value - right.linear[index]) < 0.0005);
}

function renderMetrics(rendered: IPhase7Snapshot): void {
  const rows = required<HTMLTableSectionElement>('#metric-rows');
  rows.replaceChildren();
  let matches = 0;
  for (const selector of SELECTORS) {
    const left = rendered.runtime[selector];
    const right = rendered.css[selector];
    const match = agrees(left, right);
    if (match) matches += 1;
    const row = document.createElement('tr');
    const values = [selector, `(${left.tx.toFixed(2)}, ${left.ty.toFixed(2)}) / (${right.tx.toFixed(2)}, ${right.ty.toFixed(2)})`,
      `${left.opacity.toFixed(3)} / ${right.opacity.toFixed(3)}`, `${left.visibility} / ${right.visibility}`,
      match ? 'Concordante' : 'Écart détecté'];
    for (const value of values) {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    }
    rows.append(row);
  }
  const badge = required<HTMLElement>('#agreement');
  badge.dataset.match = String(matches === SELECTORS.length);
  badge.textContent = `${matches} / ${SELECTORS.length} cibles concordantes`;
}

function controlSpan(id: string, tracks: PropertyTracks): ISpan[] {
  return [{ id, start: 1, end: 48, kind: 'static', tracks }];
}

function warningExamples(): readonly IExportCssWarning[] {
  const registry = defaultPropertyRegistry.clone().register({ name: 'volume', kind: 'value', defaultValue: 1, unit: '' });
  const data: ITimelineDocument = {
    version: '2.0.0', settings: { fps: 24, totalFrames: 48 }, layers: [
      { id: 'ref-example', type: 'layer', name: 'Objet de scène', target: { ref: 'sprite', stage: 'canvas' }, spans: controlSpan('ref-span', { x: [{ frame: 1, value: 0 }] }) },
      { id: 'unknown-example', type: 'layer', name: 'Propriété inconnue', target: { selector: '#logo' }, spans: controlSpan('unknown-span', { mystery: [{ frame: 1, value: 2 }] }) },
      { id: 'value-example', type: 'layer', name: 'Propriété sans CSS', target: { selector: '#ball' }, spans: controlSpan('value-span', { volume: [{ frame: 1, value: 0.5 }] }) }
    ]
  };
  return exportCss(data, { registry }).warnings;
}

function renderWarnings(warnings: readonly IExportCssWarning[]): void {
  for (const warning of warnings) {
    const item = document.createElement('li');
    const code = document.createElement('code');
    code.textContent = warning.code;
    item.append(code, document.createTextNode(` — ${warning.message}`));
    required<HTMLElement>('#warning-list').append(item);
  }
}

function downloadCss(css: string): void {
  const url = URL.createObjectURL(new Blob([css], { type: 'text/css;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'timeline-phase7.css';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

let player: IPlayer | undefined;

async function initialize(): Promise<void> {
  const runtimeRoot = createScene('runtime-host');
  const cssRoot = createScene('css-host');
  const exported = exportCss(DEMO_ANIMATION);
  const sheet = document.createElement('style');
  sheet.textContent = exported.css;
  cssRoot.append(sheet);
  required<HTMLTextAreaElement>('#css-output').value = exported.css;
  const runtimePlayer = createPlayer(DEMO_ANIMATION, { root: runtimeRoot });
  player = runtimePlayer;
  const cssAnimations = cssRoot.getAnimations().filter((item) => item instanceof CSSAnimation);
  cssAnimations.forEach((item) => item.pause());
  let currentFrame = 1;
  const snapshot = (): IPhase7Snapshot => ({ frame: currentFrame, runtime: renderedStates(runtimeRoot), css: renderedStates(cssRoot) });
  const seek = async (frame: number): Promise<void> => {
    currentFrame = Math.max(1, Math.min(DEMO_ANIMATION.settings.totalFrames, Math.round(frame)));
    runtimePlayer.seek(currentFrame);
    const time = ((currentFrame - 1) * 1000) / DEMO_ANIMATION.settings.fps;
    cssAnimations.forEach((item) => { item.currentTime = time; });
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    renderMetrics(snapshot());
    required<HTMLInputElement>('#frame-slider').value = String(currentFrame);
    required<HTMLOutputElement>('#frame-label').textContent = `Image ${currentFrame} / ${DEMO_ANIMATION.settings.totalFrames}`;
  };
  const warnings = warningExamples();
  renderWarnings(warnings);
  required<HTMLInputElement>('#frame-slider').addEventListener('input', (event) => {
    if (event.currentTarget instanceof HTMLInputElement) void seek(Number(event.currentTarget.value));
  });
  document.querySelectorAll<HTMLButtonElement>('[data-frame]').forEach((button) => {
    button.addEventListener('click', () => { void seek(Number(button.dataset.frame)); });
  });
  required<HTMLButtonElement>('#download-css').addEventListener('click', () => downloadCss(exported.css));
  window.addEventListener('pagehide', () => runtimePlayer.destroy(), { once: true });
  await seek(1);
  window.phase7Review = { ready: true, seek, snapshot, warnings: exported.warnings, warningExamples: warnings, animationCount: cssAnimations.length };
}

void initialize().catch((error: unknown) => {
  player?.destroy();
  const fatal = required<HTMLElement>('#fatal');
  fatal.hidden = false;
  fatal.textContent = error instanceof Error ? error.stack ?? error.message : String(error);
  window.phase7Review = { ready: false, error: fatal.textContent };
  throw error;
});
