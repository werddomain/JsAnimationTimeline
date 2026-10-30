// packages/runtime/src/stage/html/cssValue.ts
import type { TimelinePropertyValue } from '../../model/propertyTimeline';
import type { HtmlReadResult } from './cssTypes';

export type HtmlColorValue = Extract<TimelinePropertyValue, { kind: 'color' }>;
const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;

export function htmlNumberText(value: number): string {
  if (!Number.isFinite(value)) throw new Error('La valeur CSS doit être un nombre fini.');
  return String(Object.is(value, -0) ? 0 : value);
}

export function isHtmlColor(value: unknown, opaque = false): value is HtmlColorValue {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const color = value as Partial<HtmlColorValue>;
  return color.kind === 'color' && Object.keys(value).every((key) => ['kind', 'r', 'g', 'b', 'a'].includes(key))
    && [color.r, color.g, color.b, color.a].every((channel) => typeof channel === 'number' && Number.isFinite(channel) && channel >= 0 && channel <= 1)
    && (!opaque || color.a === 1);
}

export function htmlColorText(color: HtmlColorValue, opacity = color.a): string {
  return `rgba(${htmlNumberText(color.r * 255)}, ${htmlNumberText(color.g * 255)}, ${htmlNumberText(color.b * 255)}, ${htmlNumberText(opacity)})`;
}

/** Computed CSS uses resolved sRGB for ordinary colors; wider spaces require explicit conversion. */
export function parseHtmlColor(input: string): HtmlReadResult<HtmlColorValue> {
  const match = /^rgba?\(([^)]+)\)$/i.exec(input.trim());
  if (match === null) return { status: 'unsupported', reason: `La couleur « ${input} » n'est pas une couleur sRGB résolue.` };
  const tokens = match[1].trim().split(/\s*[,/]\s*|\s+/).filter(Boolean);
  if (tokens.length < 3 || tokens.length > 4) return { status: 'unsupported', reason: 'La couleur CSS est invalide.' };
  const channels = tokens.map((token, index) => {
    const percent = token.endsWith('%');
    const raw = percent ? token.slice(0, -1) : token;
    if (!NUMBER.test(raw)) return NaN;
    return Number(raw) / (percent ? 100 : index < 3 ? 255 : 1);
  });
  const value: HtmlColorValue = { kind: 'color', r: channels[0], g: channels[1], b: channels[2], a: channels[3] ?? 1 };
  return isHtmlColor(value) ? { status: 'value', value } : { status: 'unsupported', reason: 'La couleur CSS contient des composantes invalides.' };
}

/** No implicit conversion between %, font-relative units and resolved pixels. */
export function parseHtmlNumber(input: string, unit: string): HtmlReadResult<number> {
  const text = input.trim();
  const numeric = unit === '' ? text : text.endsWith(unit) ? text.slice(0, -unit.length) : text === '0' ? text : '';
  if (NUMBER.test(numeric) && Number.isFinite(Number(numeric))) return { status: 'value', value: Number(numeric) };
  return { status: 'unsupported', reason: `La valeur « ${input} » ne peut pas être conservée dans l'unité « ${unit || 'sans unité'} ».` };
}

/** Writes into a detached inert div, never the supplied element or its source stylesheet. */
export function supportedHtmlDeclaration(element: Element, property: string, value: string): boolean {
  const control = Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 && code !== 9 && code !== 10 && code !== 13;
  });
  if (value.length === 0 || /[;{}]/.test(value) || control
    || /(?:expression\s*\(|javascript\s*:|@import)/i.test(value)) return false;
  const style = element.ownerDocument.createElement('div').style;
  style.setProperty(property, value);
  return style.getPropertyValue(property) !== '';
}
