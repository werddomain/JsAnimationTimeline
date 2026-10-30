// packages/runtime/src/stage/html/specificity.ts
import { isSelectorTarget } from '../../model/guards';
import type { LayerTarget } from '../../model/target';

/** IDs, class/attribute selectors, type selectors (Selectors Level 4 §17). */
export type HtmlSpecificity = readonly [number, number, number];

const IDENT = /^-?(?:[_\p{L}][\p{L}\p{N}_-]*|-[\p{L}\p{N}_-]+)/u;

/** Positive means a is more specific; counts are compared, never packed into a number. */
export function compareHtmlSpecificity(a: HtmlSpecificity, b: HtmlSpecificity): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

/**
 * Deliberately bounded grammar: compounds of types, IDs, classes and attributes,
 * combined by whitespace/>/+/~. Pseudo selectors, namespaces and CSS escapes are
 * unknown, not assigned an invented weight. The browser still resolves them.
 */
export function htmlSelectorSpecificity(selector: string): HtmlSpecificity | undefined {
  let rest = selector.trim();
  if (rest === '') return undefined;
  let ids = 0;
  let classes = 0;
  let types = 0;
  let compound = false;
  let hasType = false;
  while (rest !== '') {
    const separator = /^(?:\s*[>+~]\s*|\s+)/.exec(rest);
    if (separator !== null) {
      if (!compound) return undefined;
      compound = false;
      hasType = false;
      rest = rest.slice(separator[0].length);
      if (rest === '') return undefined;
      continue;
    }
    const prefix = rest[0];
    if (prefix === '[') {
      // Quotes may contain ] or commas; escapes require a full CSS tokenizer.
      const attribute = /^\[(?:[^\]"'\\]|"[^"\\]*"|'[^'\\]*')+\]/.exec(rest);
      if (attribute === null) return undefined;
      classes++;
      compound = true;
      rest = rest.slice(attribute[0].length);
      continue;
    }
    if (prefix === '*' && !hasType && !compound) {
      hasType = true;
      compound = true;
      rest = rest.slice(1);
      continue;
    }
    const name = IDENT.exec(prefix === '#' || prefix === '.' ? rest.slice(1) : rest);
    if (name === null) return undefined;
    if (prefix === '#') ids++;
    else if (prefix === '.') classes++;
    else {
      if (hasType || compound) return undefined;
      types++;
      hasType = true;
    }
    compound = true;
    rest = rest.slice(name[0].length + (prefix === '#' || prefix === '.' ? 1 : 0));
  }
  return [ids, classes, types];
}

/** Unknown binding priority (refs/direct elements) requires a choice on overlap. */
export function htmlTargetSpecificity(target: LayerTarget, element: Element): HtmlSpecificity | undefined {
  if (!isSelectorTarget(target)) return undefined;
  // Lists and functional selectors need a full parser; fail closed on overlap.
  if (target.selector.includes(',')) return undefined;
  try {
    if (!element.matches(target.selector)) return undefined;
  } catch { return undefined; }
  return htmlSelectorSpecificity(target.selector);
}
