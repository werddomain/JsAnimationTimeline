// packages/runtime/src/stage/html/createHtmlStage.ts
/**
 * Scène HTML, scène par défaut du lecteur : anime les éléments sous `root`.
 * - Mode `waapi` (défaut du lecteur) : Web Animations, réalignées sur `sync`.
 * - Mode `frame` (défaut de l'éditeur) : styles en ligne écrits à chaque
 *   `render` par le même `computeCssDeclarations`.
 * Aux images entières, les deux modes donnent les mêmes styles. Entre deux
 * images, un calque échantillonné image par image (accélération avec images
 * clés au milieu, interpolateur personnalisé, bornes) peut différer en mode
 * `waapi`, parce que le navigateur interpole en ligne droite entre deux
 * échantillons, alors que le mode `frame` évalue la courbe exacte.
 * Cibles : `{ selector }`, `{ element }` et `{ ref, stage: 'html' }` (jamais
 * un `{ ref }` sans `stage`, qui appartient aux autres scènes).
 */

import type { ITimelineDocument } from '../../model/document';
import { isRefTarget } from '../../model/guards';
import type { LayerTarget } from '../../model/target';
import type { PropertyRegistry } from '../../properties/PropertyRegistry';
import { defaultPropertyRegistry } from '../../properties/PropertyRegistry';
import { StageReportCodes } from '../reports';
import { sameTarget } from '../routing';
import type { IStage, IStageContext, IStageLayer, IStageLayerState, IStageTargets } from '../types';
import { HtmlElements } from './elements';
import type { HtmlStageRefs } from './elements';
import { InlineStyleKeeper, writeFrameStyles } from './inlineStyles';
import { needsVisibility } from './keyframes';
import { WaapiAnimations } from './waapi';

/** Id of the HTML stage. */
export const HTML_STAGE_ID = 'html';

/** `waapi`: Web Animations; `frame`: inline styles written on every render. */
export type HtmlStageMode = 'waapi' | 'frame';

/** Options of `createHtmlStage`. */
export interface IHtmlStageOptions {
  /** Where selectors and `[data-timeline-target]` are looked up. Defaults to `document`. */
  readonly root?: ParentNode;
  /** Defaults to `waapi`. */
  readonly mode?: HtmlStageMode;
  /** Subtrees never targeted nor listed (e.g. the editor's own container). */
  readonly exclude?: Element | readonly Element[];
  /** Elements of `{ ref, stage: 'html' }` targets, by ref. */
  readonly refs?: HtmlStageRefs;
}

/** The HTML stage. */
export interface IHtmlStage extends IStage<Element> {
  readonly mode: HtmlStageMode;
  readonly targets: IStageTargets;
  /** Binds `ref` to `element` (`null` unbinds); failed resolutions are retried. */
  bind(ref: string, element: Element | null): void;
}

function acceptsHtml(target: LayerTarget): boolean {
  return isRefTarget(target) ? target.stage === HTML_STAGE_ID : true;
}

function assertMode(mode: unknown): asserts mode is HtmlStageMode {
  if (mode !== 'waapi' && mode !== 'frame') {
    throw new Error(`The HTML stage mode must be "waapi" or "frame" (got ${String(mode)}).`);
  }
}

/** Shared state of one HTML stage. */
interface IHtmlStageCore {
  readonly elements: HtmlElements;
  readonly listeners: Set<() => void>;
  ctx: IStageContext | null;
}

function registryOf(core: IHtmlStageCore): PropertyRegistry {
  return core.ctx?.registry ?? defaultPropertyRegistry;
}

/** Reports every layer after the first one on the same element. */
function reportDuplicates(core: IHtmlStageCore, layers: readonly IStageLayer<Element>[]): void {
  const seen = new Set<Element>();
  for (const { layerId, object } of layers) {
    if (seen.has(object)) {
      core.ctx?.report({
        code: StageReportCodes.DUPLICATE_TARGET,
        layerId,
        message: `Layer "${layerId}" animates an element already animated by another layer.`
      });
    }
    seen.add(object);
  }
}

function createTargets(core: IHtmlStageCore): IStageTargets {
  return {
    list: () => core.elements.list(),
    describe: (target) => {
      const element = core.elements.resolve(target);
      if (element === null) {
        return undefined;
      }
      return core.elements.list().find((info) => sameTarget(info.target, target)) ?? { target, label: element.id || element.tagName.toLowerCase(), group: 'HTML' };
    },
    subscribe: (onChange) => {
      core.listeners.add(onChange);
      return () => {
        core.listeners.delete(onChange);
      };
    }
  };
}

function createWaapiStage(core: IHtmlStageCore, base: Omit<IHtmlStage, 'mode'>): IHtmlStage {
  const animations = new WaapiAnimations();
  return {
    ...base,
    mode: 'waapi',
    update(doc: ITimelineDocument, layers: readonly IStageLayer<Element>[]): void {
      animations.rebuild(doc, layers, registryOf(core));
      reportDuplicates(core, layers);
    },
    sync: (time, state) => animations.sync(time, state),
    detach: () => {
      animations.cancel();
      core.ctx = null;
    }
  };
}

function createFrameStage(core: IHtmlStageCore, base: Omit<IHtmlStage, 'mode'>): IHtmlStage {
  const keeper = new InlineStyleKeeper();
  const hiddenByEditor = new Set<Element>();
  let managed = new Map<string, boolean>();
  return {
    ...base,
    mode: 'frame',
    resolve(target: LayerTarget): Element | null {
      const element = core.elements.resolve(target);
      if (element !== null) {
        keeper.acquire(element);
      }
      return element;
    },
    update(doc: ITimelineDocument, layers: readonly IStageLayer<Element>[]): void {
      // Styles of the previous document go away (tracks or visibility no longer animated); render rewrites the rest.
      keeper.restoreOriginals();
      hiddenByEditor.clear();
      managed = new Map(layers.map(({ layerId, layer }) => [layerId, needsVisibility(layer, doc.settings.totalFrames)]));
      reportDuplicates(core, layers);
    },
    render(_time, states: readonly IStageLayerState<Element>[]): void {
      const registry = registryOf(core);
      for (const state of states) {
        writeFrameStyles(state.object, state.values, registry, {
          managed: managed.get(state.layerId) === true,
          active: state.active,
          editorVisible: state.editorVisible,
          original: keeper.originalVisibility(state.object),
          hiddenByEditor
        });
      }
    },
    release(_layerId: string, element: Element): void {
      keeper.release(element);
      if (keeper.count(element) === 0) {
        hiddenByEditor.delete(element);
      }
    },
    detach(): void {
      keeper.restoreAll();
      hiddenByEditor.clear();
      core.ctx = null;
    }
  };
}

/** Creates an HTML stage; see `IHtmlStageOptions`. */
export function createHtmlStage(options: IHtmlStageOptions = {}): IHtmlStage {
  const mode = options.mode ?? 'waapi';
  assertMode(mode);
  const core: IHtmlStageCore = {
    elements: new HtmlElements(options.root ?? document, HTML_STAGE_ID, options.exclude, options.refs),
    listeners: new Set(),
    ctx: null
  };
  const base: Omit<IHtmlStage, 'mode'> = {
    id: HTML_STAGE_ID,
    targets: createTargets(core),
    accepts: acceptsHtml,
    resolve: (target) => core.elements.resolve(target),
    attach: (ctx) => {
      core.ctx = ctx;
    },
    bind(ref: string, element: Element | null): void {
      core.elements.bind(ref, element);
      Array.from(core.listeners).forEach((listener) => listener());
    }
  };
  return mode === 'waapi' ? createWaapiStage(core, base) : createFrameStage(core, base);
}
