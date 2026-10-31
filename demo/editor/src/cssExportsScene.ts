// demo/editor/src/cssExportsScene.ts
import type { IHtmlAnimationContext, IPropertyTimeline, ITimelineDocument, PropertyEasing, TimelinePropertyValue } from '@kazo-ca/timeline-runtime';

export const TOTAL_FRAMES = 97;
export const FPS = 29;
const number = (value: number): TimelinePropertyValue => ({ kind: 'number', value });
const color = (r: number, g: number, b: number): TimelinePropertyValue => ({ kind: 'color', r: r / 255, g: g / 255, b: b / 255, a: 1 });
const held = (initial: number, frame: number, value: number): IPropertyTimeline => ({ initialValue: number(initial), keys: [{ frame, value: number(value) }] });
export const htmlContext: IHtmlAnimationContext = { version: 1, bindings: {
  motion: { left: { kind: 'style', cssName: 'left', unit: 'px' } },
  held: { fill: { kind: 'style', cssName: 'background-color' }, border: { kind: 'style', cssName: 'border-style' } }
} };

/** Recreate the chosen example without editing an existing source document. */
export function createAnimation(curve: 'linear' | 'bezier' | 'elastic'): ITimelineDocument {
  const easing: PropertyEasing | undefined = curve === 'linear' ? undefined : curve === 'bezier'
    ? { kind: 'bezier', x1: .42, y1: 0, x2: .58, y2: 1 }
    : { kind: 'effect', family: 'elastic', mode: 'out', parameters: { oscillations: 3, springiness: 4 } };
  return { version: '2.0.0', settings: { fps: FPS, totalFrames: TOTAL_FRAMES }, layers: [
    { id: 'buttons', type: 'layer', name: '.button', target: { selector: '.button' }, spans: [], propertyTimelines: { opacity: held(1, 1, .5) } },
    { id: 'specific', type: 'layer', name: '#button-2', target: { selector: '#button-2' }, spans: [], propertyTimelines: { opacity: held(1, 50, .8) } },
    { id: 'motion', type: 'layer', name: 'Opacité et position', target: { selector: '#motion-tile' }, spans: [], propertyTimelines: {
      opacity: { initialValue: number(1), keys: [{ frame: 10, value: number(.2) }, { frame: 80, value: number(.9) }],
        transitions: [{ id: 'fade', fromFrame: 10, toFrame: 80, ...(easing === undefined ? {} : { easing }) }] },
      left: { initialValue: number(8), keys: [{ frame: 20, value: number(8) }, { frame: 65, value: number(100) }],
        transitions: [{ id: 'position', fromFrame: 20, toFrame: 65 }] }
    } },
    { id: 'transform', type: 'layer', name: 'Translation et rotation source', target: { selector: '#transform-tile' }, spans: [], propertyTimelines: {
      x: { initialValue: number(12), keys: [{ frame: 1, value: number(12) }, { frame: TOTAL_FRAMES, value: number(80) }],
        transitions: [{ id: 'translation', fromFrame: 1, toFrame: TOTAL_FRAMES }] }
    } },
    { id: 'held', type: 'layer', name: 'Changement sans interpolation', target: { selector: '#held-tile' }, spans: [], propertyTimelines: {
      fill: { initialValue: color(26, 104, 168), keys: [{ frame: 40, value: color(187, 76, 42) }] },
      border: { initialValue: { kind: 'text', value: 'solid' }, keys: [{ frame: 40, value: { kind: 'text', value: 'dashed' } }] }
    } }
  ] };
}

const sceneCss = `.JsTimeLine.css-export-scene { box-sizing:border-box; margin:0; padding:14px; min-height:360px; color:#203432; background:#f5f7ef; font:14px/1.45 'Segoe UI',sans-serif; }
.JsTimeLine.css-export-scene .button-group { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:12px; }
.JsTimeLine.css-export-scene .button { opacity:1; min-height:0; font:inherit; padding:8px 10px; border:0; border-radius:4px; color:white; background:#176e62; }
.JsTimeLine.css-export-scene .motion-area { height:76px; position:relative; overflow:hidden; background:#e3eadf; margin:10px 0; }
.JsTimeLine.css-export-scene #motion-tile { position:absolute; left:8px; top:15px; width:108px; height:44px; display:grid; place-items:center; background:#176e62; color:white; opacity:1; }
.JsTimeLine.css-export-scene #transform-tile { width:45px; height:45px; display:grid; place-items:center; color:white; background:#bb4c2a; transform:matrix(.8660254037844387,.5,-.5,.8660254037844387,12,15); }
.JsTimeLine.css-export-scene #held-tile { margin-top:12px; padding:10px; color:white; background-color:rgb(26,104,168); border:4px solid #203432; outline:2px solid #d5b57d; }
.JsTimeLine.css-export-scene .scene-caption { font-size:12px; margin:10px 0; }`;

/** The CSS output uses a separate document, never a clone contaminated by preview styles. */
export function createScene(owner: Document): HTMLElement {
  const root = owner.createElement('div'); root.id = 'css-scene'; root.className = 'JsTimeLine css-export-scene';
  const style = owner.createElement('style'); style.textContent = sceneCss; root.append(style);
  const group = owner.createElement('div'); group.className = 'button-group';
  for (let index = 1; index <= 4; index++) {
    const button = owner.createElement('button'); button.className = 'button'; button.id = `button-${index}`;
    button.type = 'button'; button.textContent = `B${index}`; group.append(button);
  }
  const lane = (id: string, label: string): HTMLDivElement => {
    const area = owner.createElement('div'); area.className = 'motion-area';
    const tile = owner.createElement('div'); tile.id = id; tile.textContent = label; area.append(tile); return area;
  };
  const heldTile = owner.createElement('div'); heldTile.id = 'held-tile'; heldTile.textContent = 'Couleur et bordure · changement à l’image 40';
  const caption = owner.createElement('p'); caption.className = 'scene-caption'; caption.textContent = 'Groupe 50 % · B2 80 % · rotation source 30°';
  root.append(group, lane('motion-tile', 'Opacité + position'), lane('transform-tile', '30°'), heldTile, caption);
  return root;
}

export interface ICssSceneSnapshot {
  readonly buttons: readonly string[]; readonly opacity: number; readonly left: number;
  readonly transform: readonly number[]; readonly color: string; readonly borderStyle: string;
}
export function readScene(root: ParentNode): ICssSceneSnapshot {
  const read = (selector: string): CSSStyleDeclaration => {
    const element = root.querySelector(selector);
    if (element === null || element.ownerDocument.defaultView === null) throw new Error(`Scene element missing: ${selector}`);
    return element.ownerDocument.defaultView.getComputedStyle(element);
  };
  return { buttons: [1, 2, 3, 4].map((index) => read(`#button-${index}`).opacity), opacity: Number(read('#motion-tile').opacity),
    left: Number.parseFloat(read('#motion-tile').left), transform: read('#transform-tile').transform.slice(7, -1).split(',').map(Number),
    color: read('#held-tile').backgroundColor, borderStyle: read('#held-tile').borderTopStyle };
}
