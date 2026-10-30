// packages/export-css/src/exportCss.ts
/**
 * Export d'un document timeline en CSS pur : un bloc `@keyframes` par calque,
 * puis une règle par sélecteur qui applique ses animations sur une durée de
 * totalFrames / fps.
 *
 * Dépend de : runtime (registre de propriétés R1, évaluation R2, images clés
 * du lecteur R3).
 *
 * Seule la scène HTML a un équivalent CSS. Le reste est sauté avec un
 * avertissement, sans jamais faire échouer l'export :
 * - calque sans cible `{ selector }` (ou sélecteur dangereux) → `unsupported-target` ;
 * - piste d'une propriété non CSS → `non-css-property` ;
 * - piste d'une propriété inconnue du registre → `unknown-property` ;
 * - calque impossible à évaluer → `invalid-layer` ;
 * - `fps` ou `totalFrames` invalide → `invalid-document` (rien n'est exporté).
 * Avant d'évaluer, le calque est copié avec ses seules pistes CSS connues.
 *
 * Comme le lecteur, l'export ignore l'œil des calques de l'éditeur
 * (`visible`) et masque la cible sur les plages vides. Plusieurs calques sur
 * le même sélecteur partagent une règle (liste d'animations, la dernière
 * l'emporte sur une même propriété, comme les animations du lecteur).
 * Différence : le lecteur anime le premier élément trouvé, la règle CSS tous
 * ceux qui correspondent au sélecteur.
 */

import {
  buildLayerKeyframes,
  collectLayers,
  defaultPropertyRegistry,
  isSelectorTarget
} from '@kazo-ca/timeline-runtime';
import type { ILayer, ITimelineDocument, PropertyRegistry } from '@kazo-ca/timeline-runtime';
import { formatKeyframesBlock, toCssKeyframes } from './cssKeyframes';
import { isSafeSelector, keyframesName } from './cssNames';
import { keepCssTracks } from './cssTracks';
import type { IExportCssOptions, IExportCssResult, IExportCssWarning } from './types';

export const DEFAULT_PREFIX = 'tl-';
const DURATION_DECIMALS = 4;

interface IExportContext {
  readonly doc: ITimelineDocument;
  readonly registry: PropertyRegistry;
  readonly prefix: string;
  readonly usedNames: Set<string>;
  readonly warnings: IExportCssWarning[];
}

/** One exported layer: its `@keyframes` block and the animation name it defines. */
interface IExportedLayer {
  readonly selector: string;
  readonly name: string;
  readonly block: string;
}

function isPositiveFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function formatDuration(doc: ITimelineDocument): string {
  const ms = (doc.settings.totalFrames / doc.settings.fps) * 1000;
  return `${Number(ms.toFixed(DURATION_DECIMALS))}ms`;
}

function unsupportedTarget(layer: ILayer, reason: string): IExportCssWarning {
  return {
    code: 'unsupported-target',
    layerId: layer.id,
    message: `Calque « ${layer.id} » : ${reason}, il n'est pas exporté en CSS.`
  };
}

/** Selector of the layer, or `null` after adding the warning that explains why not. */
function selectorOf(layer: ILayer, warnings: IExportCssWarning[]): string | null {
  if (!isSelectorTarget(layer.target)) {
    warnings.push(unsupportedTarget(layer, layer.target === undefined ? "il n'a pas de cible" : "sa cible n'est pas un sélecteur CSS"));
    return null;
  }
  const selector = String(layer.target.selector).trim();
  if (!isSafeSelector(selector)) {
    warnings.push(unsupportedTarget(layer, `le sélecteur « ${layer.target.selector} » ne peut pas être écrit dans une feuille de style`));
    return null;
  }
  return selector;
}

/** Exported layer, or `null` when nothing is exported. Throws for a layer that cannot be evaluated. */
function exportLayer(layer: ILayer, ctx: IExportContext): IExportedLayer | null {
  const selector = selectorOf(layer, ctx.warnings);
  if (selector === null) {
    return null;
  }
  const filtered = keepCssTracks(layer, ctx.registry);
  const keyframes = buildLayerKeyframes(filtered.layer, ctx.doc.settings, ctx.registry);
  const css = keyframes === null ? null : toCssKeyframes(keyframes);
  ctx.warnings.push(...filtered.warnings);
  if (css === null) {
    return null;
  }
  const name = keyframesName(ctx.prefix, layer.id, ctx.usedNames);
  return { selector, name, block: formatKeyframesBlock(name, css) };
}

/** `exportLayer` that never throws: a failure becomes an `invalid-layer` warning. */
function tryExportLayer(layer: ILayer, ctx: IExportContext): IExportedLayer | null {
  const warningCount = ctx.warnings.length;
  try {
    return exportLayer(layer, ctx);
  } catch (error) {
    ctx.warnings.length = warningCount;
    const reason = error instanceof Error ? error.message : String(error);
    ctx.warnings.push({
      code: 'invalid-layer',
      layerId: String(layer.id),
      message: `Calque « ${layer.id} » : il ne peut pas être évalué (${reason}), il n'est pas exporté en CSS.`
    });
    return null;
  }
}

/** One rule per selector, in order of first appearance, listing its animations. */
function animationRules(layers: readonly IExportedLayer[], doc: ITimelineDocument, loop: boolean): string[] {
  const names = new Map<string, string[]>();
  layers.forEach(({ selector, name }) => names.set(selector, [...(names.get(selector) ?? []), name]));
  const list = (value: string, count: number): string => Array.from({ length: count }, () => value).join(', ');
  return Array.from(names, ([selector, animations]) =>
    [
      `${selector} {`,
      `  animation-name: ${animations.join(', ')};`,
      `  animation-duration: ${list(formatDuration(doc), animations.length)};`,
      `  animation-timing-function: ${list('linear', animations.length)};`,
      `  animation-fill-mode: ${list('both', animations.length)};`,
      `  animation-iteration-count: ${list(loop ? 'infinite' : '1', animations.length)};`,
      '}'
    ].join('\n')
  );
}

/** `css` in a `<style>` element (safe: selectors and declarations never contain `<`). */
function toStyleElement(css: string): string {
  return `<style>\n${css}</style>`;
}

function result(css: string, warnings: readonly IExportCssWarning[]): IExportCssResult {
  return { css, html: toStyleElement(css), warnings };
}

/**
 * Pure CSS version of `doc`: one `@keyframes` block per layer of the HTML
 * stage, in display order, then one rule per selector. Never throws for a
 * layer or a track it cannot export: it skips them and lists them in
 * `warnings`.
 */
export function exportCss(doc: ITimelineDocument, options: IExportCssOptions = {}): IExportCssResult {
  if (!isPositiveFinite(doc.settings?.fps) || !isPositiveFinite(doc.settings?.totalFrames) || !Array.isArray(doc.layers)) {
    return result('', [
      { code: 'invalid-document', layerId: '', message: "Le document n'a pas de fps, de nombre d'images ou de liste de calques valide : rien n'est exporté en CSS." }
    ]);
  }
  const sourceLayers = collectLayers(doc);
  const unsupported = sourceLayers.filter((layer) => Object.keys(layer.propertyTimelines ?? {}).length > 0);
  if (unsupported.length > 0) {
    return result('', unsupported.map((layer): IExportCssWarning => ({
      code: 'unsupported-property-timeline',
      layerId: layer.id,
      message: `Calque « ${layer.id} » : l'adaptateur HTML des pistes de propriétés est indisponible dans cette phase. L'export CSS complet est refusé pour préserver l'animation.`
    })));
  }
  const ctx: IExportContext = {
    doc,
    registry: options.registry ?? defaultPropertyRegistry,
    prefix: options.prefix ?? DEFAULT_PREFIX,
    usedNames: new Set<string>(),
    warnings: []
  };
  const layers = sourceLayers
    .map((layer) => tryExportLayer(layer, ctx))
    .filter((layer): layer is IExportedLayer => layer !== null);
  if (layers.length === 0) {
    return result('', ctx.warnings);
  }
  const blocks = [...layers.map((layer) => layer.block), ...animationRules(layers, doc, options.loop ?? false)];
  return result(`${blocks.join('\n\n')}\n`, ctx.warnings);
}
