// packages/export-css/src/exportCss.ts
/**
 * Export d'un document timeline en CSS pur : un bloc `@keyframes` par calque
 * et une règle qui l'applique au sélecteur de la cible, sur une durée de
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
 * - calque impossible à évaluer → `invalid-layer`.
 * Avant d'évaluer, le calque est copié avec ses seules pistes CSS connues.
 *
 * Comme le lecteur, l'export ignore l'œil des calques de l'éditeur
 * (`visible`) et masque la cible sur les plages vides. Différence : le
 * lecteur anime le premier élément trouvé, la règle CSS tous ceux qui
 * correspondent au sélecteur.
 */

import {
  buildLayerKeyframes,
  collectLayers,
  defaultPropertyRegistry,
  isSelectorTarget
} from '@werddomain/timeline-runtime';
import type { ILayer, ITimelineDocument, PropertyRegistry } from '@werddomain/timeline-runtime';
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
  readonly loop: boolean;
  readonly usedNames: Set<string>;
  readonly warnings: IExportCssWarning[];
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
  const selector = layer.target.selector.trim();
  if (!isSafeSelector(selector)) {
    warnings.push(unsupportedTarget(layer, `le sélecteur « ${layer.target.selector} » ne peut pas être écrit dans une feuille de style`));
    return null;
  }
  return selector;
}

function animationRule(selector: string, name: string, ctx: IExportContext): string {
  return [
    `${selector} {`,
    `  animation-name: ${name};`,
    `  animation-duration: ${formatDuration(ctx.doc)};`,
    '  animation-timing-function: linear;',
    '  animation-fill-mode: both;',
    `  animation-iteration-count: ${ctx.loop ? 'infinite' : '1'};`,
    '}'
  ].join('\n');
}

/** CSS of one layer (keyframes + rule), or `null` when nothing is exported. */
function exportLayer(layer: ILayer, ctx: IExportContext): string | null {
  const selector = selectorOf(layer, ctx.warnings);
  if (selector === null) {
    return null;
  }
  const filtered = keepCssTracks(layer, ctx.registry);
  ctx.warnings.push(...filtered.warnings);
  let keyframes: Keyframe[] | null;
  try {
    keyframes = buildLayerKeyframes(filtered.layer, ctx.doc.settings, ctx.registry);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    ctx.warnings.push({
      code: 'invalid-layer',
      layerId: layer.id,
      message: `Calque « ${layer.id} » : il ne peut pas être évalué (${reason}), il n'est pas exporté en CSS.`
    });
    return null;
  }
  if (keyframes === null) {
    return null;
  }
  const name = keyframesName(ctx.prefix, layer.id, ctx.usedNames);
  return `${formatKeyframesBlock(name, toCssKeyframes(keyframes))}\n\n${animationRule(selector, name, ctx)}`;
}

/** `css` in a `<style>` element (safe: `isSafeSelector` refuses `<`, the only text not written by the export). */
function toStyleElement(css: string): string {
  return `<style>\n${css}</style>`;
}

/**
 * Pure CSS version of `doc`: one `@keyframes` block and one rule per layer
 * of the HTML stage, in display order. Never throws for a layer or a track
 * it cannot export: it skips them and lists them in `warnings`.
 */
export function exportCss(doc: ITimelineDocument, options: IExportCssOptions = {}): IExportCssResult {
  const ctx: IExportContext = {
    doc,
    registry: options.registry ?? defaultPropertyRegistry,
    prefix: options.prefix ?? DEFAULT_PREFIX,
    loop: options.loop ?? false,
    usedNames: new Set<string>(),
    warnings: []
  };
  const blocks: string[] = [];
  for (const layer of collectLayers(doc)) {
    const block = exportLayer(layer, ctx);
    if (block !== null) {
      blocks.push(block);
    }
  }
  const css = blocks.length === 0 ? '' : `${blocks.join('\n\n')}\n`;
  return { css, html: toStyleElement(css), warnings: ctx.warnings };
}
