// packages/export-css/src/cssKeyframes.ts
/**
 * Passage des images clés Web Animations du lecteur (`buildLayerKeyframes`)
 * à un bloc CSS `@keyframes`, pour que l'export et le lecteur donnent le même
 * rendu.
 *
 * - L'accélération d'un segment devient l'`animation-timing-function` de
 *   l'image clé qui le commence (le CSS le permet).
 * - Le lecteur marque un changement net par deux images clés au même offset.
 *   En CSS, la seconde remplacerait la première : le segment qui précède
 *   reçoit donc `step-end` (il tient sa valeur jusqu'au changement), et seule
 *   la nouvelle valeur est écrite à l'offset.
 * - Les pourcentages sont arrondis vers le bas (6 décimales) : à l'instant
 *   exact d'un changement net, le CSS montre déjà la nouvelle valeur, comme
 *   le lecteur.
 * - Avant la première plage, l'état tenu est écrit dès 0 % ; le lecteur, lui,
 *   n'a pas d'image clé à 0 % et part du style propre de l'élément.
 */

import { parseEasing } from '@werddomain/timeline-runtime';

/** A CSS keyframe: offset in [0, 1], easing of the segment it starts, declarations. */
export interface ICssKeyframe {
  readonly offset: number;
  readonly easing: string;
  /** Kebab-case CSS property → value, in writing order. */
  readonly declarations: ReadonlyArray<readonly [string, string]>;
}

const PERCENT_DECIMALS = 6;
/** Offset shift used only when a hard change cannot become `step-end`. */
const HARD_CHANGE_EPSILON = 1e-6;
const NON_PROPERTY_KEYS = new Set(['offset', 'easing', 'composite']);

/** `borderRadius` → `border-radius`; `WebkitMask` → `-webkit-mask`. */
export function camelCaseToCssName(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

/** `value` with at most `decimals` decimals, rounded down, without trailing zeros. */
export function formatFloor(value: number, decimals: number): string {
  const scale = 10 ** decimals;
  const floored = Math.floor(value * scale + 1e-6) / scale;
  return String(Number(floored.toFixed(decimals)));
}

/** Text that would end a declaration, a block or the `<style>` element. */
const UNSAFE_DECLARATION_TEXT = /[;{}<]/;

/** Throws when a registry gives a name or value that cannot be written safely. */
function safeDeclaration(name: string, value: string): [string, string] {
  if (UNSAFE_DECLARATION_TEXT.test(name) || UNSAFE_DECLARATION_TEXT.test(value)) {
    throw new Error(`unsafe CSS declaration "${name}: ${value}"`);
  }
  return [name, value];
}

function toCssKeyframe(keyframe: Keyframe): ICssKeyframe {
  const declarations: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(keyframe)) {
    if (!NON_PROPERTY_KEYS.has(key) && value !== undefined && value !== null) {
      declarations.push(safeDeclaration(camelCaseToCssName(key), String(value)));
    }
  }
  return { offset: Number(keyframe.offset ?? 0), easing: safeEasing(keyframe.easing), declarations };
}

/** `easing` when it is a valid timing function of the model, `linear` otherwise (never copies arbitrary text). */
function safeEasing(easing: string | undefined): string {
  return easing !== undefined && parseEasing(easing) !== null ? easing : 'linear';
}

function sameDeclarations(a: ICssKeyframe, b: ICssKeyframe): boolean {
  return (
    a.declarations.length === b.declarations.length &&
    a.declarations.every(([name, value], i) => b.declarations[i][0] === name && b.declarations[i][1] === value)
  );
}

/**
 * Adds `next` after `out`, turning a pair of keyframes at the same offset
 * (held value, then new value) into a `step-end` segment.
 */
function pushKeyframe(out: ICssKeyframe[], next: ICssKeyframe): void {
  const last = out[out.length - 1];
  if (last === undefined || last.offset !== next.offset) {
    out.push(next);
    return;
  }
  const before = out[out.length - 2];
  if (before !== undefined && sameDeclarations(before, last)) {
    out[out.length - 2] = { ...before, easing: 'step-end' };
    out[out.length - 1] = next;
    return;
  }
  // The held value differs from what precedes it: keep it just before the change.
  const shifted = Math.max(before === undefined ? 0 : before.offset, last.offset - HARD_CHANGE_EPSILON);
  out[out.length - 1] = { ...last, offset: shifted, easing: 'step-end' };
  out.push(next);
}

/**
 * CSS keyframes equivalent to the player's Web Animations keyframes. A first
 * keyframe after 0% is held from 0% (`fill-mode: both` would otherwise
 * interpolate from the element's own style).
 */
export function toCssKeyframes(keyframes: readonly Keyframe[]): ICssKeyframe[] {
  const out: ICssKeyframe[] = [];
  keyframes.map(toCssKeyframe).forEach((keyframe, index) => {
    if (index === 0 && keyframe.offset > 0) {
      out.push({ ...keyframe, offset: 0, easing: 'linear' });
    }
    pushKeyframe(out, keyframe);
  });
  return out;
}

function formatKeyframe(keyframe: ICssKeyframe, indent: string): string {
  const lines = keyframe.declarations.map(([name, value]) => `${indent}  ${name}: ${value};`);
  if (keyframe.easing !== 'linear') {
    lines.push(`${indent}  animation-timing-function: ${keyframe.easing};`);
  }
  const percent = formatFloor(keyframe.offset * 100, PERCENT_DECIMALS);
  return `${indent}${percent}% {\n${lines.join('\n')}\n${indent}}`;
}

/** `@keyframes name { ... }` block, two-space indentation. */
export function formatKeyframesBlock(name: string, keyframes: readonly ICssKeyframe[]): string {
  const body = keyframes.map((keyframe) => formatKeyframe(keyframe, '  ')).join('\n');
  return `@keyframes ${name} {\n${body}\n}`;
}
