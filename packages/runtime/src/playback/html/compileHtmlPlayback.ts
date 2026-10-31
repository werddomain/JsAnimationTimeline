// packages/runtime/src/playback/html/compileHtmlPlayback.ts
import { collectLayers, evaluateDocument } from '../../evaluate/evaluateDocument';
import type { ITimelineDocument } from '../../model/document';
import { isSelectorTarget } from '../../model/guards';
import { defaultPropertyRegistry } from '../../properties/PropertyRegistry';
import type { IHtmlResolvedLayer } from '../../stage/html/animationTypes';
import { prepareHtmlAnimation, composeHtmlAnimationFrame } from '../../stage/html/preparedAnimation';
import { HtmlPropertyInspection } from '../../stage/html/propertyInspection';
import { assertHtmlExportPreparationBudget, cloneBoundedHtmlExportContext, HtmlExportResourceError } from '../../stage/html/exportWork';
import { compilePlayback } from '../compilePlayback';
import { clonePlaybackJson } from '../json';
import { MAX_PLAYBACK_CELLS } from '../limits';
import type { PlaybackResult } from '../types';
import { groupHtmlSnapshots } from './grouping';
import { parseHtmlPlayback } from './parseHtmlPlayback';
import type { HtmlPlaybackDeclarations, ICompileHtmlPlaybackOptions, IHtmlPlaybackDocument } from './types';

function compile(doc: ITimelineDocument, options: ICompileHtmlPlaybackOptions): PlaybackResult<IHtmlPlaybackDocument> {
  const generic = compilePlayback(doc, options);
  if (generic.status === 'refused') return generic;
  const document = clonePlaybackJson(doc) as ITimelineDocument;
  const context = cloneBoundedHtmlExportContext(options.animationContext);
  const registry = options.registry ?? defaultPropertyRegistry;
  const layers: IHtmlResolvedLayer[] = collectLayers(document).map((layer) => {
    if (layer.target === undefined || !isSelectorTarget(layer.target)) throw new Error(`L’objet « ${layer.name} » exige un sélecteur HTML exportable.`);
    const elements = Array.from(options.root.querySelectorAll(layer.target.selector));
    if (elements.length === 0) throw new Error(`Le sélecteur « ${layer.target.selector} » ne correspond à aucun élément.`);
    if (elements.some((element) => !('style' in element))) throw new Error('La cible ne possède pas de styles inline compatibles.');
    return { layerId: layer.id, layer, target: layer.target, elements };
  });
  assertHtmlExportPreparationBudget(layers, context, document.settings.totalFrames);
  const inspection = new HtmlPropertyInspection();
  const prepared = prepareHtmlAnimation(document, layers, context, registry, inspection);
  if (prepared.diagnostics.length > 0) return { status: 'refused', diagnostics: prepared.diagnostics.map((issue) => ({
    code: issue.code, message: issue.message, layerId: issue.layerIds[0], property: issue.property, frame: issue.fromFrame
  })) };
  const streams = new Map<Element, HtmlPlaybackDeclarations[]>();
  for (const element of new Set(layers.flatMap((layer) => [...layer.elements]))) streams.set(element, []);
  const maximum = options.maxCells ?? MAX_PLAYBACK_CELLS;
  if (!Number.isSafeInteger(maximum) || maximum < 1 || maximum > MAX_PLAYBACK_CELLS) throw new Error('Le budget d’export HTML est invalide.');
  if (streams.size * document.settings.totalFrames > maximum) throw new Error('Le budget d’export HTML est dépassé. Réduisez la durée ou le nombre de cibles.');
  let cells = Object.values(generic.data.frames).reduce((sum, frame) => sum + 1 + Object.values(frame)
    .reduce((count, state) => count + 1 + Object.keys(state.values).length, 0), 0);
  for (let frame = 1; frame <= document.settings.totalFrames; frame++) {
    const states = evaluateDocument(document, frame, { registry });
    const active = new Map(states.map((state) => [state.layerId, state.visible]));
    const composed = composeHtmlAnimationFrame(document, layers, prepared.plan, context, inspection, frame, new Map(), active);
    if (composed.diagnostics.length > 0) return { status: 'refused', diagnostics: composed.diagnostics.map((issue) => ({
      code: issue.code, message: issue.message, layerId: issue.layerIds[0], property: issue.property, frame
    })) };
    for (const [element, declarations] of composed.elements) {
      cells += Math.max(1, Object.keys(declarations).length);
      if (cells > maximum) throw new Error('Le budget d’export HTML est dépassé. Réduisez la durée ou le nombre de propriétés.');
      streams.get(element)!.push(declarations);
    }
  }
  const selectors = [...new Set(layers.map((layer) => 'selector' in layer.target ? layer.target.selector : ''))];
  const grouped = groupHtmlSnapshots(options.root, selectors, streams, options.selectorForElement);
  if (streams.size === 0) for (let frame = 1; frame <= document.settings.totalFrames; frame++) {
    (grouped.frames as Record<string, object>)[String(frame)] = {};
  }
  const data = parseHtmlPlayback({ version: 1, sampling: 'frames', source: generic.data, ...grouped });
  return { status: 'exported', data, diagnostics: [] };
}

/** Compile while source styles are visible; a live stage can suspend its preview for this operation. */
export function compileHtmlPlayback(doc: ITimelineDocument, options: ICompileHtmlPlaybackOptions): PlaybackResult<IHtmlPlaybackDocument> {
  try { return options.sourceStage === undefined ? compile(doc, options) : options.sourceStage.withSourceStyles(() => compile(doc, options)); }
  catch (error) { return { status: 'refused', diagnostics: [{ code: error instanceof HtmlExportResourceError ? 'resource-limit' : 'html-export-refused',
    message: error instanceof Error ? error.message : 'L’export HTML a été refusé.' }] }; }
}
