// packages/runtime/src/stage/html/exportPreparation.ts
import { collectLayers } from '../../evaluate/evaluateDocument';
import type { ITimelineDocument } from '../../model/document';
import { isSelectorTarget } from '../../model/guards';
import { validateDocument } from '../../model/validate';
import { assertPlaybackCompileBudget } from '../../playback/compileWork';
import { clonePlaybackJson, freezePlaybackJson } from '../../playback/json';
import type { PlaybackResult } from '../../playback/types';
import { defaultPropertyRegistry, type PropertyRegistry } from '../../properties/PropertyRegistry';
import type { IHtmlAnimationContext, IHtmlResolvedElementTrajectories, IHtmlResolvedLayer } from './animationTypes';
import type { HtmlTransformValues } from './cssTypes';
import { prepareHtmlAnimation } from './preparedAnimation';
import { HtmlPropertyInspection } from './propertyInspection';
import { assertHtmlExportPreparationBudget, cloneBoundedHtmlExportContext, HtmlExportResourceError } from './exportWork';

export interface IPrepareHtmlExportOptions {
  readonly root: ParentNode;
  readonly registry?: PropertyRegistry;
  readonly animationContext?: IHtmlAnimationContext;
  readonly sourceStage?: { withSourceStyles<T>(action: () => T): T };
}
export interface IPreparedHtmlExport {
  readonly document: ITimelineDocument;
  readonly context: IHtmlAnimationContext;
  readonly registry: PropertyRegistry;
  readonly layers: readonly IHtmlResolvedLayer[];
  readonly trajectories: readonly IHtmlResolvedElementTrajectories[];
  readonly transformBases: ReadonlyMap<Element, HtmlTransformValues>;
}

/** Runs an export synchronously while preview writes are suspended, without modifying source keys. */
export function withPreparedHtmlExport<T>(input: ITimelineDocument, options: IPrepareHtmlExportOptions,
  action: (scene: IPreparedHtmlExport) => T): PlaybackResult<T> {
  let code = 'invalid-document';
  const prepare = (): PlaybackResult<T> => {
    const safe = clonePlaybackJson(input);
    code = 'resource-limit';
    assertPlaybackCompileBudget(safe);
    code = 'invalid-document';
    const issues = validateDocument(safe, { allowLiveTargets: false });
    if (issues.length > 0) return { status: 'refused', diagnostics: issues.map((issue) => ({ code, message: `${issue.path}: ${issue.message}` })) };
    const document = freezePlaybackJson(safe) as ITimelineDocument;
    const context = cloneBoundedHtmlExportContext(options.animationContext);
    const registry = (options.registry ?? defaultPropertyRegistry).clone();
    code = 'html-export-refused';
    let count = 0;
    const layers: IHtmlResolvedLayer[] = collectLayers(document).map((layer) => {
      if (!isSelectorTarget(layer.target)) throw new Error(`L’objet « ${layer.name} » exige un sélecteur HTML exportable.`);
      const elements = Array.from(options.root.querySelectorAll(layer.target.selector));
      if (elements.length === 0) throw new Error(`Le sélecteur « ${layer.target.selector} » ne correspond à aucun élément.`);
      count += elements.length;
      if (count > 10_000) throw new Error('Le nombre de correspondances dépasse le budget d’export HTML.');
      if (elements.some((element) => !('style' in element))) throw new Error('La cible ne possède pas de styles inline compatibles.');
      return { layerId: layer.id, layer, target: layer.target, elements };
    });
    assertHtmlExportPreparationBudget(layers, context);
    const inspection = new HtmlPropertyInspection();
    const prepared = prepareHtmlAnimation(document, layers, context, registry, inspection);
    if (prepared.diagnostics.length > 0) return { status: 'refused', diagnostics: prepared.diagnostics.map((issue) => ({
      code: issue.code, message: issue.message, layerId: issue.layerIds[0], property: issue.property, frame: issue.fromFrame
    })) };
    const transformBases = new Map<Element, HtmlTransformValues>();
    for (const element of new Set(layers.flatMap((layer) => [...layer.elements]))) {
      const base = inspection.transform(element);
      if (base.status === 'value') transformBases.set(element, base.value);
    }
    return { status: 'exported', data: action({ document, context, registry, layers,
      trajectories: prepared.plan.trajectories(), transformBases }), diagnostics: [] };
  };
  try { return options.sourceStage === undefined ? prepare() : options.sourceStage.withSourceStyles(prepare); }
  catch (error) { return { status: 'refused', diagnostics: [{ code: error instanceof HtmlExportResourceError ? 'resource-limit' : code,
    message: error instanceof Error ? error.message : 'La préparation HTML a échoué.' }] }; }
}
