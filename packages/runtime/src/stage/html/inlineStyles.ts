// packages/runtime/src/stage/html/inlineStyles.ts
/**
 * Mode `frame` de la scène HTML : styles en ligne écrits à chaque image par
 * `computeCssDeclarations` (le même calcul que les images clés Web
 * Animations). Seules les propriétés que la scène écrit (dont `visibility`)
 * sont sauvegardées, à leur première écriture qui change quelque chose
 * (valeur et priorité), puis remises telles quelles (`removeProperty` quand
 * il n'y en avait pas) : un style que la page pose ailleurs sur l'élément
 * n'est jamais effacé. Pour un raccourci (`border-radius`, `margin`), ce sont
 * les déclarations qu'il change qui sont sauvegardées (comparées avant et
 * après l'écriture) : les sous-propriétés posées en partie par la page, ou
 * avec des `!important` mêlés, reviennent telles quelles. Le
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
  /** Original value of every inline property changed by the stage since the last restore (longhands included). */
  readonly saved: Map<string, ISavedProperty>;
  /** Properties saved because of each written name (a shorthand changes its longhands). */
  readonly written: Map<string, string[]>;
}

/** Every inline declaration of `style`, by name. */
function snapshot(style: CSSStyleDeclaration): Map<string, ISavedProperty> {
  const declarations = new Map<string, ISavedProperty>();
  for (let index = 0; index < style.length; index += 1) {
    const name = style.item(index);
    declarations.set(name, { value: style.getPropertyValue(name), priority: style.getPropertyPriority(name) });
  }
  return declarations;
}

function sameDeclaration(a: ISavedProperty | undefined, b: ISavedProperty | undefined): boolean {
  return (a?.value ?? '') === (b?.value ?? '') && (a?.priority ?? '') === (b?.priority ?? '');
}

const UNSET: ISavedProperty = { value: '', priority: '' };

/** Per document: `style.item()` lists the longhands of a shorthand (browsers do, jsdom does not). */
const expandsShorthands = new WeakMap<Document, boolean>();

function listsLonghands(element: Element): boolean {
  const doc = element.ownerDocument;
  let expands = expandsShorthands.get(doc);
  if (expands === undefined) {
    const scratch = doc.createElement('div').style;
    scratch.setProperty('margin', '0px');
    expands = scratch.length > 1;
    expandsShorthands.set(doc, expands);
  }
  return expands;
}

function serialize(declarations: ReadonlyMap<string, ISavedProperty>): string {
  return Array.from(declarations)
    .map(([name, { value, priority }]) => `${name}: ${value}${priority === '' ? '' : ` !${priority}`};`)
    .join(' ');
}

/**
 * Puts back `names` from `saved`. Browsers: every property is removed first
 * (a shorthand clears its longhands), then the ones the page had are set
 * again. An engine that lists shorthands as such (jsdom) keeps stale
 * longhands after `removeProperty`: the declarations are rewritten at once
 * through `cssText`, from the current ones (its values are the written text).
 */
function restoreProperties(element: Element, names: readonly string[], saved: ReadonlyMap<string, ISavedProperty>): void {
  if (!hasInlineStyle(element) || names.length === 0) {
    return;
  }
  const style = element.style;
  if (!listsLonghands(element)) {
    const declarations = snapshot(style);
    names.forEach((name) => declarations.delete(name));
    names.forEach((name) => {
      const original = saved.get(name) ?? UNSET;
      if (original.value !== '') {
        declarations.set(name, original);
      }
    });
    style.cssText = serialize(declarations);
    return;
  }
  names.forEach((name) => style.removeProperty(name));
  names.forEach((name) => {
    const original = saved.get(name) ?? UNSET;
    if (original.value !== '') {
      style.setProperty(name, original.value, original.priority);
    }
  });
}

function restoreEntry(element: Element, entry: IHeldStyle): void {
  restoreProperties(element, Array.from(entry.saved.keys()), entry.saved);
  entry.saved.clear();
  entry.written.clear();
  if (!entry.hadAttribute && element.getAttribute('style') === '') {
    element.removeAttribute('style');
  }
}

/**
 * Saves the original value of every property that `name: value` changes on
 * `style`, comparing the declarations before and after: a shorthand changes
 * its longhands (browsers list the longhands, jsdom the shorthand), and a
 * partly set or mixed `!important` shorthand reads as ''.
 */
function writeSaving(entry: IHeldStyle, style: CSSStyleDeclaration, name: string, value: string): void {
  const before = snapshot(style);
  style.setProperty(name, value);
  const after = snapshot(style);
  const changed = new Set<string>();
  before.forEach((declaration, key) => {
    if (!sameDeclaration(declaration, after.get(key))) {
      changed.add(key);
    }
  });
  after.forEach((declaration, key) => {
    if (!sameDeclaration(before.get(key), declaration)) {
      changed.add(key);
    }
  });
  if (changed.size === 0) {
    // Same value as the page's, or a value the browser refused: saved on the first write that changes something.
    return;
  }
  changed.add(name);
  const names: string[] = [];
  changed.forEach((key) => {
    if (!entry.saved.has(key)) {
      entry.saved.set(key, before.get(key) ?? UNSET);
      names.push(key);
    }
  });
  entry.written.set(name, names);
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
      this.held.set(element, { count: 1, hadAttribute: element.hasAttribute('style'), saved: new Map(), written: new Map() });
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
   * Writes `name` inline on a held element, saving the original value of
   * what it changes the first time. Elements not held, or without inline
   * style, are skipped.
   */
  write(element: Element, name: string, value: string): void {
    const entry = this.held.get(element);
    if (entry === undefined || !hasInlineStyle(element)) {
      return;
    }
    if (entry.written.has(name)) {
      // Already saved: only the value changes (a shorthand changes the same longhands for same-shape values, e.g. one value to one value).
      element.style.setProperty(name, value);
      return;
    }
    writeSaving(entry, element.style, name, value);
  }

  /** Puts back the original value of `name` on `element` (and of what it changed), when the stage wrote it. */
  restore(element: Element, name: string): void {
    const entry = this.held.get(element);
    const names = entry?.written.get(name);
    if (entry === undefined || names === undefined) {
      return;
    }
    entry.written.delete(name);
    restoreProperties(element, names, entry.saved);
    names.forEach((key) => entry.saved.delete(key));
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
