// packages/runtime/src/stage/html/inlineStyles.ts
/**
 * Mode `frame` de la scène HTML : styles en ligne écrits à chaque image par
 * `computeCssDeclarations` (le même calcul que les images clés Web
 * Animations). Seules les propriétés que la scène écrit (dont `visibility`)
 * sont sauvegardées, à leur première écriture qui change quelque chose
 * (valeur et priorité), puis remises telles quelles (`removeProperty` quand
 * il n'y en avait pas) : un style que la page pose ailleurs sur l'élément
 * n'est jamais effacé. Pour un raccourci (`border-radius`, `margin`), toutes ses
 * sous-propriétés sont sauvegardées (trouvées une fois par une écriture
 * d'essai sur un élément jetable de même espace de noms et de nom fixe, gardées par document), qu'il
 * les change ou non à cette première écriture : les images suivantes les
 * réécrivent sans les sauvegarder. Celles posées en partie par la page, ou
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
/** Per document and property name: the longhands a shorthand sets (found with a probe write). */
const longhandsByName = new WeakMap<Document, Map<string, readonly string[]>>();

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

/**
 * Inline style of a throw-away element in the namespace of `element`
 * (`createElement('div')` has no `style` in an XMLDocument). The probe has a
 * fixed name per namespace ('g' for SVG, 'div' otherwise), never the page's:
 * creating a custom element could run its constructor. `undefined` when the
 * probe has no inline style.
 */
function scratchStyle(element: Element): CSSStyleDeclaration | undefined {
  const doc = element.ownerDocument;
  const namespace = element.namespaceURI;
  const probe =
    namespace && typeof doc.createElementNS === 'function'
      ? doc.createElementNS(namespace, namespace === SVG_NAMESPACE ? 'g' : 'div')
      : doc.createElement('div');
  return hasInlineStyle(probe) ? probe.style : undefined;
}

function listsLonghands(element: Element): boolean {
  const doc = element.ownerDocument;
  let expands = expandsShorthands.get(doc);
  if (expands === undefined) {
    const scratch = scratchStyle(element);
    if (scratch === undefined) {
      return false;
    }
    scratch.setProperty('margin', '0px');
    expands = scratch.length > 1;
    expandsShorthands.set(doc, expands);
  }
  return expands;
}

/** Longhands that writing `name: value` sets ([] for a plain property or an engine that lists shorthands as such). */
function longhandsOf(element: Element, name: string, value: string): readonly string[] {
  if (!listsLonghands(element)) {
    return [];
  }
  const doc = element.ownerDocument;
  const cache = longhandsByName.get(doc) ?? new Map<string, readonly string[]>();
  longhandsByName.set(doc, cache);
  const known = cache.get(name);
  if (known !== undefined) {
    return known;
  }
  const scratch = scratchStyle(element);
  if (scratch === undefined) {
    return [];
  }
  scratch.setProperty(name, value);
  if (scratch.length === 0) {
    return []; // value refused: not cached, a later value may work
  }
  const names = Array.from(snapshot(scratch).keys()).filter((key) => key !== name);
  cache.set(name, names);
  return names;
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

/** Names whose declaration differs between two snapshots. */
function changedNames(before: ReadonlyMap<string, ISavedProperty>, after: ReadonlyMap<string, ISavedProperty>): Set<string> {
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
  return changed;
}

/**
 * Saves the original value of `name` and of every longhand it sets (all of
 * them, changed by this first write or not: later frames overwrite them
 * without saving), plus anything the before/after comparison shows as
 * changed (jsdom lists the shorthand itself, and a partly set or mixed
 * `!important` shorthand reads as '').
 */
function writeSaving(entry: IHeldStyle, element: StyledElement, name: string, value: string): void {
  const style = element.style;
  const longhands = longhandsOf(element, name, value);
  const before = snapshot(style);
  // A page shorthand written with var() is not listed by item(): read it as such.
  const pageShorthand: ISavedProperty = { value: style.getPropertyValue(name), priority: style.getPropertyPriority(name) };
  style.setProperty(name, value);
  const changed = changedNames(before, snapshot(style));
  if (changed.size === 0) {
    // A value the browser refused: saved on the first write that changes something.
    return;
  }
  const keys = new Set<string>([name, ...longhands, ...changed]);
  keys.forEach((key) => {
    if (!entry.saved.has(key)) {
      entry.saved.set(key, before.get(key) ?? (key === name ? pageShorthand : UNSET));
    }
  });
  entry.written.set(name, Array.from(keys));
}

function isUnchanged(style: CSSStyleDeclaration, name: string, value: string): boolean {
  return style.getPropertyValue(name) === value && style.getPropertyPriority(name) === '';
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
    if (!entry.written.has(name) && isUnchanged(element.style, name, value)) {
      return; // same as the page's: nothing to save, no snapshot taken
    }
    if (entry.written.has(name)) {
      // Already saved: only the value changes (a shorthand changes the same longhands for same-shape values, e.g. one value to one value).
      element.style.setProperty(name, value);
      return;
    }
    writeSaving(entry, element, name, value);
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
    // A name another written property still sets keeps its saved original (else its next write would leak).
    const stillSet = new Set(Array.from(entry.written.values()).flat());
    names.filter((key) => !stillSet.has(key)).forEach((key) => entry.saved.delete(key));
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
