// packages/editor/src/plugins/tweens/easing/easingCommands.ts
/** Immutable span easing operations and a command that restores the original layer. */
import { DEFAULT_EASING, parseEasing } from '@kazo-ca/timeline-runtime';
import type { Easing, ILayer, ISpan, ITimelineDocument } from '@kazo-ca/timeline-runtime';
import { CommandRefusedError } from '../../../core/commands/CommandRefusedError';
import type { ICommand } from '../../../core/commands/ICommand';
import { assertFrame, findLayer, replaceLayer, requireEditableLegacyLayer } from '../../../model/spans/layerAccess';
import { SpanOperationError } from '../../../model/spans/SpanOperationError';
import { spanIndexAt, withSpans } from '../../../model/spans/tracks';

/** French history label for an easing change. */
export const SET_EASING_LABEL = 'Modifier l’accélération';

function refused(reason: string): CommandRefusedError { return new CommandRefusedError(SET_EASING_LABEL, reason); }

/** Validate a frame, editable layer (including ancestor locks) and tween against the current document. */
export function requireEasingTarget(doc: ITimelineDocument, layerId: string, frame: number): { layer: ILayer; span: ISpan } {
  try {
    assertFrame(doc, frame);
    const layer = requireEditableLegacyLayer(doc, layerId);
    const span = layer.spans[spanIndexAt(layer, frame)];
    if (span?.kind !== 'tween') throw refused('Aucune interpolation à cette image.');
    return { layer, span };
  } catch (error) {
    if (error instanceof SpanOperationError) throw refused(error.message);
    throw error;
  }
}

/** Change only span.easing. An identical effective value returns the original document. */
export function setSpanEasing(doc: ITimelineDocument, layerId: string, frame: number, easing: Easing, expectedSpanId?: string): ITimelineDocument {
  const { layer, span } = requireEasingTarget(doc, layerId, frame);
  if (typeof easing !== 'string' || parseEasing(easing) === null) throw refused('L’accélération est invalide.');
  if (expectedSpanId !== undefined && span.id !== expectedSpanId) throw refused('L’interpolation a changé. Ouvrez de nouveau le dialogue.');
  if ((span.easing ?? DEFAULT_EASING) === easing) return doc;
  const spans = layer.spans.map((candidate) => candidate === span ? { ...span, easing } : candidate);
  return replaceLayer(doc, withSpans(layer, spans));
}

/** Resolve and validate on every do/redo; undo restores the precise pre-command layer. */
export function createSetEasingCommand(layerId: string, frame: number, easing: Easing, expectedSpanId?: string): ICommand {
  let snapshot: ILayer | undefined;
  return Object.freeze({
    label: SET_EASING_LABEL,
    do: (doc: ITimelineDocument): ITimelineDocument => {
      const next = setSpanEasing(doc, layerId, frame, easing, expectedSpanId);
      snapshot = next === doc ? undefined : findLayer(doc, layerId);
      return next;
    },
    undo: (doc: ITimelineDocument): ITimelineDocument => snapshot === undefined ? doc : replaceLayer(doc, snapshot)
  });
}
