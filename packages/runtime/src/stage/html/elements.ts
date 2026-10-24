// packages/runtime/src/stage/html/elements.ts
/**
 * Éléments de la scène HTML : résolution des cibles sous `root` (sélecteur,
 * élément, `{ ref, stage: 'html' }` par la table `refs`, `bind` ou
 * `[data-timeline-target]`), sous-arbres exclus (`exclude`, par exemple le
 * conteneur de l'éditeur) et liste des cibles proposées.
 */

import { isElementTarget, isRefTarget, isSelectorTarget } from '../../model/guards';
import type { LayerTarget } from '../../model/target';
import type { ITargetInfo } from '../types';

/** Attribute naming an element for `{ ref, stage: 'html' }` targets. */
export const TARGET_ATTRIBUTE = 'data-timeline-target';

/** Elements bound to refs: a plain object or a `Map`. */
export type HtmlStageRefs = Readonly<Record<string, Element>> | ReadonlyMap<string, Element>;

/** Simple ids, listed as `#id` selectors. */
const SIMPLE_ID = /^[A-Za-z][\w-]*$/;

function toList(exclude: Element | readonly Element[] | undefined): readonly Element[] {
  if (exclude === undefined) {
    return [];
  }
  return Array.isArray(exclude) ? exclude.slice() : [exclude as Element];
}

function toMap(refs: HtmlStageRefs | undefined): Map<string, Element> {
  if (refs === undefined) {
    return new Map();
  }
  if (refs instanceof Map) {
    return new Map(refs);
  }
  return new Map(Object.entries(refs as Readonly<Record<string, Element>>));
}

/** Elements and refs of one HTML stage. */
export class HtmlElements {
  private readonly excluded: readonly Element[];
  private readonly refs: Map<string, Element>;

  constructor(
    private readonly root: ParentNode,
    private readonly stageId: string,
    exclude: Element | readonly Element[] | undefined,
    refs: HtmlStageRefs | undefined
  ) {
    this.excluded = toList(exclude);
    this.refs = toMap(refs);
  }

  /** True when `element` is in an excluded subtree. */
  isExcluded(element: Element): boolean {
    return this.excluded.some((excluded) => excluded === element || excluded.contains(element));
  }

  /** Binds `ref` to `element`, or unbinds it with `null`. */
  bind(ref: string, element: Element | null): void {
    if (element === null) {
      this.refs.delete(ref);
    } else {
      this.refs.set(ref, element);
    }
  }

  /** Element of `target`, `null` when missing, excluded or for an invalid selector (never throws). */
  resolve(target: LayerTarget): Element | null {
    const element = this.find(target);
    return element !== null && !this.isExcluded(element) ? element : null;
  }

  /** Targets offered by the stage: bound refs, `[data-timeline-target]` and elements with a simple id. */
  list(): ITargetInfo[] {
    const infos: ITargetInfo[] = [];
    const seen = new Set<string>();
    const addRef = (ref: string): void => {
      if (!seen.has(ref)) {
        seen.add(ref);
        infos.push({ target: { ref, stage: this.stageId }, label: ref, group: 'HTML' });
      }
    };
    this.refs.forEach((element, ref) => {
      if (!this.isExcluded(element)) {
        addRef(ref);
      }
    });
    this.queryAll(`[${TARGET_ATTRIBUTE}]`).forEach((element) => addRef(element.getAttribute(TARGET_ATTRIBUTE) ?? ''));
    this.queryAll('[id]')
      .filter((element) => SIMPLE_ID.test(element.id))
      .forEach((element) => infos.push({ target: { selector: `#${element.id}` }, label: element.id, group: 'HTML' }));
    return infos.filter((info) => !isRefTarget(info.target) || info.target.ref !== '');
  }

  private find(target: LayerTarget): Element | null {
    if (isElementTarget(target)) {
      return target.element;
    }
    if (isSelectorTarget(target)) {
      return this.queryFirst(target.selector);
    }
    if (isRefTarget(target)) {
      const bound = this.refs.get(target.ref);
      if (bound !== undefined) {
        return bound;
      }
      return this.queryAll(`[${TARGET_ATTRIBUTE}]`).find((element) => element.getAttribute(TARGET_ATTRIBUTE) === target.ref) ?? null;
    }
    return null;
  }

  /** First match outside the excluded subtrees; `null` for an invalid selector. */
  private queryFirst(selector: string): Element | null {
    try {
      if (this.excluded.length === 0) {
        return this.root.querySelector(selector);
      }
      return Array.from(this.root.querySelectorAll(selector)).find((element) => !this.isExcluded(element)) ?? null;
    } catch {
      return null;
    }
  }

  private queryAll(selector: string): Element[] {
    return Array.from(this.root.querySelectorAll(selector)).filter((element) => !this.isExcluded(element));
  }
}
