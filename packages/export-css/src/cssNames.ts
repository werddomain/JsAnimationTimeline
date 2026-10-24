// packages/export-css/src/cssNames.ts
/**
 * Noms écrits dans la feuille de style : nom `@keyframes` sûr et unique pour
 * chaque calque, et contrôle des sélecteurs avant de les recopier.
 */

const UNSAFE_IDENT_CHARS = /[^A-Za-z0-9_-]/g;
/** Keywords that cannot name a `@keyframes` (`none` disables the animation). */
const RESERVED_NAMES = new Set(['none', 'initial', 'inherit', 'unset', 'revert', 'revert-layer', 'default']);
/** Characters that would end the rule or the `<style>` element early. */
const UNSAFE_SELECTOR_CHARS = /[{}<;]/;
const CLOSING: Readonly<Record<string, string>> = { '[': ']', '(': ')' };

/**
 * CSS identifier `prefix + layerId`, with every other character replaced by
 * `_`, never starting with a digit or `--`, never a reserved keyword, and
 * different from the names in `used` (a `-2`, `-3`... suffix is added). The
 * name is added to `used`.
 */
export function keyframesName(prefix: string, layerId: string, used: Set<string>): string {
  let base = `${prefix}${layerId}`.replace(UNSAFE_IDENT_CHARS, '_');
  if (base === '' || /^(\d|-\d|--)/.test(base) || RESERVED_NAMES.has(base.toLowerCase())) {
    base = `_${base}`;
  }
  let name = base;
  for (let suffix = 2; used.has(name); suffix++) {
    name = `${base}-${suffix}`;
  }
  used.add(name);
  return name;
}

/**
 * True when brackets, parentheses and quotes are balanced and closed, and no
 * escape is left dangling: otherwise the rest of the style sheet would be
 * swallowed by the unclosed token.
 */
function isBalanced(selector: string): boolean {
  const open: string[] = [];
  let quote: string | null = null;
  for (let i = 0; i < selector.length; i++) {
    const char = selector[i];
    if (char === '\\') {
      if (i === selector.length - 1) {
        return false;
      }
      i++;
    } else if (quote !== null) {
      quote = char === quote ? null : quote;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char in CLOSING) {
      open.push(CLOSING[char]);
    } else if (char === ']' || char === ')') {
      if (open.pop() !== char) {
        return false;
      }
    }
  }
  return quote === null && open.length === 0;
}

/** True when `selector` can be copied as the prelude of a CSS rule. */
export function isSafeSelector(selector: string): boolean {
  const trimmed = selector.trim();
  return (
    trimmed !== '' &&
    !UNSAFE_SELECTOR_CHARS.test(trimmed) &&
    !trimmed.startsWith('@') &&
    !trimmed.includes('/*') &&
    !trimmed.includes('*/') &&
    isBalanced(trimmed)
  );
}
