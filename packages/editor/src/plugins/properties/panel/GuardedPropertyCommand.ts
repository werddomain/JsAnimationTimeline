// packages/editor/src/plugins/properties/panel/GuardedPropertyCommand.ts
import type { ITimelineDocument } from '@werddomain/timeline-runtime';
import { CommandRefusedError } from '../../../core/commands/CommandRefusedError';
import type { ICommand } from '../../../core/commands/ICommand';
import type { SetPropertyCommand } from '../../../model/properties/SetPropertyCommand';

/** Guards only the UI confirmation; history delegates to the ordinary W2 command. */
export class GuardedPropertyCommand implements ICommand {
  readonly label: string;
  private initial = true;

  constructor(private readonly command: SetPropertyCommand, private readonly current: () => boolean) {
    this.label = command.label;
  }

  do(doc: ITimelineDocument): ITimelineDocument {
    if (!this.initial) return this.command.do(doc);
    this.assertCurrent();
    const next = this.command.do(doc);
    this.assertCurrent();
    this.initial = false;
    return next;
  }

  undo(doc: ITimelineDocument): ITimelineDocument { return this.command.undo(doc); }

  private assertCurrent(): void {
    if (!this.current()) {
      throw new CommandRefusedError(this.label, 'Le contexte du panneau a changé : la modification a été annulée.');
    }
  }
}
