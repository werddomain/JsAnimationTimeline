// packages/runtime/src/stage/html/cssTransform.ts
import type { HtmlReadResult, HtmlTransformValues } from './cssTypes';
import { htmlNumberText, parseHtmlNumber } from './cssValue';

type Matrix = readonly [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];
const ZERO: HtmlTransformValues = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, skewX: 0, skewY: 0 };
const FAILURE: HtmlReadResult<never> = { status: 'unsupported', reason: 'Cette transformation ne peut pas être conservée en composantes 2D. Convertissez-la explicitement avant de l’animer.' };

function multiply(left: Matrix, right: Matrix): Matrix {
  const [a, b, c, d, e, f] = left;
  const [g, h, i, j, k, l] = right;
  return [a * g + c * h, b * g + d * h, a * i + c * j, b * i + d * j, a * k + c * l + e, b * k + d * l + f];
}

function angle(token: string): number | undefined {
  const unit = ['grad', 'deg', 'rad', 'turn'].find((suffix) => token.endsWith(suffix));
  const result = parseHtmlNumber(token, unit ?? '');
  if (result.status !== 'value' || unit === undefined && result.value !== 0) return undefined;
  return result.value * (unit === 'rad' ? 1 : unit === 'turn' ? 2 * Math.PI : unit === 'grad' ? Math.PI / 200 : Math.PI / 180);
}

function plain(token: string, unit = ''): number | undefined {
  const result = parseHtmlNumber(token, unit);
  return result.status === 'value' ? result.value : undefined;
}

function functionMatrix(name: string, args: readonly string[]): Matrix | undefined {
  if (name === 'matrix' && args.length === 6) {
    const values = args.map((arg) => plain(arg));
    return values.every((value) => value !== undefined) ? values as unknown as Matrix : undefined;
  }
  if (['translate', 'translateX', 'translateY'].includes(name) && args.length >= 1 && args.length <= (name === 'translate' ? 2 : 1)) {
    const first = plain(args[0], 'px');
    const second = args[1] === undefined ? 0 : plain(args[1], 'px');
    if (first === undefined || second === undefined) return undefined;
    return [1, 0, 0, 1, name === 'translateY' ? 0 : first, name === 'translateY' ? first : second];
  }
  if (['scale', 'scaleX', 'scaleY'].includes(name) && args.length >= 1 && args.length <= (name === 'scale' ? 2 : 1)) {
    const first = plain(args[0]);
    const second = args[1] === undefined ? first : plain(args[1]);
    if (first === undefined || second === undefined) return undefined;
    return [name === 'scaleY' ? 1 : first, 0, 0, name === 'scaleX' ? 1 : second, 0, 0];
  }
  if (name === 'rotate' && args.length === 1) {
    const radians = angle(args[0]);
    if (radians === undefined) return undefined;
    return [Math.cos(radians), Math.sin(radians), -Math.sin(radians), Math.cos(radians), 0, 0];
  }
  if (['skew', 'skewX', 'skewY'].includes(name) && args.length >= 1 && args.length <= (name === 'skew' ? 2 : 1)) {
    const first = angle(args[0]);
    const second = args[1] === undefined ? 0 : angle(args[1]);
    if (first === undefined || second === undefined) return undefined;
    return [1, Math.tan(name === 'skewY' ? first : second), name === 'skewY' ? 0 : Math.tan(first), 1, 0, 0];
  }
  return undefined;
}

function matrixOf(text: string): Matrix | undefined {
  if (/matrix3d|perspective|var\(|calc\(/i.test(text)) return undefined;
  const tokens = Array.from(text.matchAll(/([a-zA-Z]+)\(([^()]*)\)/g));
  if (tokens.length === 0 || text.replace(/([a-zA-Z]+)\(([^()]*)\)/g, '').trim() !== '') return undefined;
  let matrix = IDENTITY;
  for (const token of tokens) {
    const next = functionMatrix(token[1], token[2].trim().split(/\s*,\s*|\s+/));
    if (next === undefined) return undefined;
    matrix = multiply(matrix, next);
  }
  return matrix.every(Number.isFinite) ? matrix : undefined;
}

/** Canonical T · R · skewX · skewY · S; the captured skewY is zero. */
export function readHtmlTransform(text: string): HtmlReadResult<HtmlTransformValues> {
  if (text === '' || text === 'none') return { status: 'value', value: { ...ZERO } };
  const matrix = matrixOf(text);
  if (matrix === undefined) return FAILURE;
  const [a, b, c, d, x, y] = matrix;
  const scaleX = Math.hypot(a, b);
  const determinant = a * d - b * c;
  if (scaleX === 0 || determinant === 0 || !Number.isFinite(determinant)) return FAILURE;
  const value: HtmlTransformValues = { x, y, scaleX, scaleY: determinant / scaleX,
    rotation: Math.atan2(b, a) * 180 / Math.PI, skewX: Math.atan((a * c + b * d) / determinant) * 180 / Math.PI, skewY: 0 };
  return Object.values(value).every(Number.isFinite) ? { status: 'value', value } : FAILURE;
}

export function composeHtmlTransform(value: HtmlTransformValues): string {
  const n = htmlNumberText;
  return `translate(${n(value.x)}px, ${n(value.y)}px) rotate(${n(value.rotation)}deg) skewX(${n(value.skewX)}deg) skewY(${n(value.skewY)}deg) scale(${n(value.scaleX)}, ${n(value.scaleY)})`;
}
