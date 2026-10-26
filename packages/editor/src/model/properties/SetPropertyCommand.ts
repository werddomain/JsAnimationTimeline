// packages/editor/src/model/properties/SetPropertyCommand.ts
import type { ILayer, ITimelineDocument } from '@werddomain/timeline-runtime';
import { CommandRefusedError } from '../../core/commands/CommandRefusedError';
import type { ICommand } from '../../core/commands/ICommand';
import { findLayer, replaceLayer } from '../spans/layerAccess';
import { SpanOperationError } from '../spans/SpanOperationError';
import { applyPropertyValue, PropertyOperationError } from './propertyValue';
import type { IPropertyEditContext } from './targetProperties';

/** Undoable property edit, independent of plugins. Redo rechecks current rules. */
export class SetPropertyCommand implements ICommand {
  readonly label = 'Modifier une propriété';
  private snapshot: ILayer | undefined;

  constructor(
    private readonly layerId: string,
    private readonly name: string,
    private readonly value: number,
    private readonly frame: number,
    private readonly context: IPropertyEditContext
  ) {}

  do(doc: ITimelineDocument): ITimelineDocument {
    try {
      const next = applyPropertyValue(doc, this.layerId, this.name, this.value, this.frame, this.context);
      this.snapshot = next === doc ? undefined : findLayer(doc, this.layerId);
      return next;
    } catch (error) {
      if (error instanceof PropertyOperationError || error instanceof SpanOperationError) {
        throw new CommandRefusedError(this.label, error.message);
      }
      throw error;
    }
  }

  undo(doc: ITimelineDocument): ITimelineDocument {
    return this.snapshot === undefined ? doc : replaceLayer(doc, this.snapshot);
  }
}
