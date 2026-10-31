// packages/runtime/src/playback/compilePlayback.ts
import type { ITimelineDocument } from '../model/document';
import { validateDocument } from '../model/validate';
import { collectLayers, evaluateDocument } from '../evaluate/evaluateDocument';
import { defaultPropertyRegistry } from '../properties/PropertyRegistry';
import { typedNumericValues } from '../properties/timelineValues';
import type { SerializableLayerTarget } from '../model/target';
import { clonePlaybackJson, freezePlaybackJson } from './json';
import { assertPlaybackCompileBudget } from './compileWork';
import { parsePlayback } from './parsePlayback';
import type { ICompilePlaybackOptions, IPlaybackDocument, IPlaybackFrame, IPlaybackObject, IPlaybackObjectState, PlaybackResult } from './types';

/** Bake canonical evaluator results without creating keys or retaining executable host data. */
export function compilePlayback(input: ITimelineDocument, options: ICompilePlaybackOptions = {}): PlaybackResult<IPlaybackDocument> {
  let code = 'invalid-document';
  try {
    const safe = clonePlaybackJson(input);
    code = 'resource-limit';
    assertPlaybackCompileBudget(safe, options.maxCells);
    code = 'invalid-document';
    const issues = validateDocument(safe, { allowLiveTargets: false });
    if (issues.length > 0) return { status: 'refused', diagnostics: issues.map((issue) => ({ code, message: `${issue.path}: ${issue.message}` })) };
    const doc = freezePlaybackJson(safe) as ITimelineDocument;
    const layers = collectLayers(doc);
    code = 'evaluation-failed';
    const registry = (options.registry ?? defaultPropertyRegistry).clone();
    const objects = Object.create(null) as Record<string, IPlaybackObject>;
    for (const layer of layers) objects[layer.id] = { name: layer.name, ...(layer.target === undefined ? {} : { target: layer.target as SerializableLayerTarget }) };
    const frames = Object.create(null) as Record<string, IPlaybackFrame>;
    for (let frame = 1; frame <= doc.settings.totalFrames; frame++) {
      const states = Object.create(null) as Record<string, IPlaybackObjectState>;
      for (const state of evaluateDocument(doc, frame, { registry })) {
        states[state.layerId] = { active: state.visible, values: state.propertyValues ?? typedNumericValues(state.values) };
      }
      frames[String(frame)] = states;
    }
    const data = parsePlayback({ version: 1, sampling: 'frames', fps: doc.settings.fps, totalFrames: doc.settings.totalFrames, objects, frames });
    return { status: 'exported', data, diagnostics: [] };
  } catch (error) {
    return { status: 'refused', diagnostics: [{ code, message: error instanceof Error ? error.message : 'La compilation des données de lecture a échoué.' }] };
  }
}
