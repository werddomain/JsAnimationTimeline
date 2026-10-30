// packages/editor/src/model/propertyTimelines/PropertyTimelineCommand.ts
import type { ILayer, ITimelineDocument } from '@kazo-ca/timeline-runtime';
import { CommandRefusedError } from '../../core/commands/CommandRefusedError';
import type { ICommand } from '../../core/commands/ICommand';
import { PropertyOperationError } from '../properties/propertyValue';
import type { IPropertyEditContext } from '../properties/targetProperties';
import { findLayer, replaceLayer } from '../spans/layerAccess';
import { SpanOperationError } from '../spans/SpanOperationError';
import { applyPropertyTimelineOperation } from './operations';
import type { PropertyTimelineOperation } from './types';
import { clonePropertyOperation } from './values';

const LABELS: Readonly<Record<PropertyTimelineOperation['kind'], string>> = {
  set: 'Modifier une propriété', capture: 'Créer une clé de propriété',
  'delete-key': 'Supprimer une clé de propriété', 'move-key': 'Déplacer une clé de propriété',
  'create-transition': 'Créer une interpolation de propriété', 'remove-transition': 'Supprimer une interpolation de propriété',
  'set-easing': "Modifier l'accélération d'une interpolation", migrate: 'Migrer une propriété'
};

/** A single history entry; all permissions and metadata are rechecked on redo. */
export class PropertyTimelineCommand implements ICommand {
  readonly label: string;
  private readonly operation: PropertyTimelineOperation;
  private snapshot: ILayer | undefined;

  constructor(operation: PropertyTimelineOperation, private readonly context: IPropertyEditContext) {
    this.operation = clonePropertyOperation(operation);
    this.label = LABELS[this.operation.kind] ?? 'Modifier une propriété';
  }

  do(doc: ITimelineDocument): ITimelineDocument {
    try {
      const next = applyPropertyTimelineOperation(doc, this.operation, this.context);
      this.snapshot = next === doc ? undefined : findLayer(doc, this.operation.layerId);
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
