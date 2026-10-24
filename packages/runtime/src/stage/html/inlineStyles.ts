// packages/runtime/src/stage/html/inlineStyles.ts
/**
 * Mode `frame` de la scène HTML : styles en ligne écrits à chaque image par
 * `computeCssDeclarations` (le même calcul que les images clés Web
 * Animations). Le style d'origine est sauvegardé **par élément** avec un
 * compteur : deux calques sur le même élément ne s'effacent pas, et le style
 * n'est rendu que quand le dernier calque le libère.
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

interface IHeldStyle {
  count: number;
  /** `style` attribute before the first layer, `null` when absent. */
  readonly attribute: string | null;
  /** Inline `visibility` before the first layer, '' when unset. */
  readonly visibility: string;
}

/** Per-element save of the inline style, with a reference counter. */
export class InlineStyleKeeper {
  private readonly held = new Map<Element, IHeldStyle>();

  /** Number of layers holding `element`. */
  count(element: Element): number {
    return this.held.get(element)?.count ?? 0;
  }

  /** A layer starts animating `element`; the first one saves its style. */
  acquire(element: Element): void {
    const entry = this.held.get(element);
    if (entry !== undefined) {
      entry.count += 1;
      return;
    }
    const visibility = hasInlineStyle(element) ? element.style.getPropertyValue('visibility') : '';
    this.held.set(element, { count: 1, attribute: element.getAttribute('style'), visibility });
  }

  /** A layer stops animating `element`; the last one restores its style. */
  release(element: Element): void {
    const entry = this.held.get(element);
    if (entry === undefined) {
      return;
    }
    entry.count -= 1;
    if (entry.count <= 0) {
      this.held.delete(element);
      restoreAttribute(element, entry.attribute);
    }
  }

  /** Restores every element still held. */
  restoreAll(): void {
    this.held.forEach((entry, element) => restoreAttribute(element, entry.attribute));
    this.held.clear();
  }

  /** Inline `visibility` of `element` before the first layer. */
  originalVisibility(element: Element): string {
    return this.held.get(element)?.visibility ?? '';
  }
}

function restoreAttribute(element: Element, attribute: string | null): void {
  if (attribute === null) {
    element.removeAttribute('style');
  } else {
    element.setAttribute('style', attribute);
  }
}

/** How visibility is written for one layer. */
export interface IFrameVisibility {
  /** The layer hides its target at some frame (same rule as the Web Animations keyframes). */
  readonly managed: boolean;
  readonly active: boolean;
  readonly editorVisible: boolean;
  /** Inline value to put back when the editor shows the layer again. */
  readonly original: string;
  /** Elements currently hidden because of the editor's eye. */
  readonly hiddenByEditor: Set<Element>;
}

function setVisibility(element: StyledElement, value: string): void {
  if (value === '') {
    element.style.removeProperty('visibility');
  } else {
    element.style.setProperty('visibility', value);
  }
}

function writeVisibility(element: StyledElement, visibility: IFrameVisibility): void {
  if (!visibility.editorVisible) {
    visibility.hiddenByEditor.add(element);
    setVisibility(element, 'hidden');
  } else if (visibility.managed) {
    visibility.hiddenByEditor.delete(element);
    setVisibility(element, visibility.active ? 'visible' : 'hidden');
  } else if (visibility.hiddenByEditor.delete(element)) {
    setVisibility(element, visibility.original);
  }
}

/**
 * Writes the CSS of `values` inline on `element`, and its visibility when the
 * layer manages it (or the editor hides it). Elements without inline style
 * are skipped.
 */
export function writeFrameStyles(
  element: Element,
  values: PropertyValues,
  registry: PropertyRegistry,
  visibility: IFrameVisibility
): void {
  if (!hasInlineStyle(element)) {
    return;
  }
  for (const [cssName, value] of Object.entries(computeCssDeclarations(values, registry))) {
    element.style.setProperty(cssName, value);
  }
  writeVisibility(element, visibility);
}
