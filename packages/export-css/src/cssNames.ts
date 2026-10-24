// packages/export-css/src/cssNames.ts
/**
 * Noms écrits dans la feuille de style : nom `@keyframes` sûr et unique pour
 * chaque calque, et contrôle des sélecteurs avant de les recopier.
 */

const UNSAFE_IDENT_CHARS = /[^A-Za-z0-9_-]/g;
/** Characters that would end the rule or the `<style>` element early. */
const UNSAFE_SELECTOR_CHARS = /[{}<;]/;

/**
 * CSS identifier `prefix + layerId`, with every other character replaced by
 * `_`, never starting with a digit or `--`, and different from the names in
 * `used` (a `-2`, `-3`... suffix is added). The name is added to `used`.
 */
export function keyframesName(prefix: string, layerId: string, used: Set<string>): string {
  let base = `${prefix}${layerId}`.replace(UNSAFE_IDENT_CHARS, '_');
  if (base === '' || /^(\d|-\d|--)/.test(base)) {
    base = `_${base}`;
  }
  let name = base;
  for (let suffix = 2; used.has(name); suffix++) {
    name = `${base}-${suffix}`;
  }
  used.add(name);
  return name;
}

/** True when `selector` can be copied as the prelude of a CSS rule. */
export function isSafeSelector(selector: string): boolean {
  return selector.trim() !== '' && !UNSAFE_SELECTOR_CHARS.test(selector);
}
