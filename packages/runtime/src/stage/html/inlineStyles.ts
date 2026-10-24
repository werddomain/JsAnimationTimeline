// packages/runtime/src/stage/html/inlineStyles.ts
/**
 * Mode `frame` de la scène HTML : styles en ligne écrits à chaque image par
 * `computeCssDeclarations` (le même calcul que les images clés Web
 * Animations). Seules les propriétés que la scène écrit (dont `visibility`)
 * sont sauvegardées, à leur première écriture (valeur et priorité), puis
 * remises telles quelles (`removeProperty` quand il n'y en avait pas) : un
 * style que la page pose ailleurs sur l'élément n'est jamais effacé. Le
 * compte est tenu **par élément** : deux calques sur le même élément ne
 * s'effacent pas, et le style n'est rendu que quand le dernier le libère.
 */

import { computeCssDeclarations } from '../../properties/compose';
import type { PropertyRegistry } from '../../properties/PropertyRegistry';
import type { PropertyValues } from '../../properties/types';

/** An element with an inline style (HTML, SVG, MathML). */
type StyledElement = Element & ElementCSSInlineStyle;

function hasInlineStyle(element: Element): element is StyledElement {
  const style = (element as Partial<ElementCSSInlineStyle>).style;
  return typeof style === 'object' && style !== null && typeof style.setProperty === 'function';
}

/** Inline value of one property before the stage wrote it ('' when unset). */
interface ISavedProperty {
  readonly value: string;
  readonly priority: string;
}

interface IHeldStyle {
  count: number;
  /** The element had a `style` attribute when first held (an emptied one added by the stage is removed). */
  readonly hadAttribute: boolean;
  /** Original value of every property written since the last restore. */
  readonly saved: Map<string, ISavedProperty>;
}

function restoreProperty(element: Element, name: string, saved: ISavedProperty): void {
  if (!hasInlineStyle(element)) {
    return;
  }
  if (saved.value === '') {
    element.style.removeProperty(name);
  } else {
    element.style.setProperty(name, saved.value, saved.priority);
  }
}

function restoreEntry(element: Element, entry: IHeldStyle): void {
  entry.saved.forEach((saved, name) => restoreProperty(element, name, saved));
  entry.saved.clear();
  if (!entry.hadAttribute && element.getAttribute('style') === '') {
    element.removeAttribute('style');
  }
}

/** Per-element save of the written inline properties, with a reference counter. */
export class InlineStyleKeeper {
  private readonly held = new Map<Element, IHeldStyle>();

  /** Number of layers holding `element`. */
  count(element: Element): number {
    return this.held.get(element)?.count ?? 0;
  }

  /** A layer starts animating `element`. */
  acquire(element: Element): void {
    const entry = this.held.get(element);
    if (entry !== undefined) {
      entry.count += 1;
    } else {
      this.held.set(element, { count: 1, hadAttribute: element.hasAttribute('style'), saved: new Map() });
    }
  }

  /** A layer stops animating `element`; the last one restores what was written. */
  release(element: Element): void {
    const entry = this.held.get(element);
    if (entry === undefined) {
      return;
    }
    entry.count -= 1;
    if (entry.count <= 0) {
      this.held.delete(element);
      restoreEntry(element, entry);
    }
  }

  /**
   * Writes `name` inline on a held element, saving its original value the
   * first time. Elements not held, or without inline style, are skipped.
   */
  write(element: Element, name: string, value: string): void {
    const entry = this.held.get(element);
    if (entry === undefined || !hasInlineStyle(element)) {
      return;
    }
    if (!entry.saved.has(name)) {
      entry.saved.set(name, { value: element.style.getPropertyValue(name), priority: element.style.getPropertyPriority(name) });
    }
    element.style.setProperty(name, value);
  }

  /** Puts back the original value of `name` on `element`, when the stage wrote it. */
  restore(element: Element, name: string): void {
    const saved = this.held.get(element)?.saved.get(name);
    if (saved !== undefined) {
      this.held.get(element)?.saved.delete(name);
      restoreProperty(element, name, saved);
    }
  }

  /**
   * Puts back the original value of every written property, keeping the
   * counters: a new document then rewrites only what its layers still animate.
   */
  restoreOriginals(): void {
    this.held.forEach((entry, element) => restoreEntry(element, entry));
  }

  /** Restores every element still held, and forgets them. */
  restoreAll(): void {
    this.restoreOriginals();
    this.held.clear();
  }
}

/** How visibility is written for one layer. */
export interface IFrameVisibility {
  /** The layer hides its target at some frame (same rule as the Web Animations keyframes). */
  readonly managed: boolean;
  readonly active: boolean;
  readonly editorVisible: boolean;
  /** Elements currently hidden because of the editor's eye. */
  readonly hiddenByEditor: Set<Element>;
}

function writeVisibility(keeper: InlineStyleKeeper, element: Element, visibility: IFrameVisibility): void {
  if (!visibility.editorVisible) {
    visibility.hiddenByEditor.add(element);
    keeper.write(element, 'visibility', 'hidden');
  } else if (visibility.managed) {
    visibility.hiddenByEditor.delete(element);
    keeper.write(element, 'visibility', visibility.active ? 'visible' : 'hidden');
  } else if (visibility.hiddenByEditor.delete(element)) {
    keeper.restore(element, 'visibility');
  }
}

/**
 * Writes the CSS of `values` inline on `element` through `keeper`, and its
 * visibility when the layer manages it (or the editor hides it). Elements
 * without inline style are skipped.
 */
export function writeFrameStyles(
  keeper: InlineStyleKeeper,
  element: Element,
  values: PropertyValues,
  registry: PropertyRegistry,
  visibility: IFrameVisibility
): void {
  if (!hasInlineStyle(element)) {
    return;
  }
  for (const [cssName, value] of Object.entries(computeCssDeclarations(values, registry))) {
    keeper.write(element, cssName, value);
  }
  writeVisibility(keeper, element, visibility);
}
