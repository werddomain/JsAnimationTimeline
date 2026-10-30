// packages/editor/src/plugins/tweens/easing/EasingPlugin.ts
/**
 * Plugin: tweens.easing
 * Epic: tweens
 * Depends on: tweens.motion
 * Listens: document:changed, document:loaded, frames:selectionChanged, layers:selectionChanged
 * Emits: none
 *
 * Span-wide easing commands and an accessible French preset dialog. Any document
 * or selection change closes a pending dialog so confirmation cannot target stale data.
 */
import type { Easing, PropertyEasing } from '@kazo-ca/timeline-runtime';
import type { EditorPlugin, IEditorContext } from '../../../core/context/IEditorContext';
import { CommandRefusedError } from '../../../core/commands/CommandRefusedError';
import type {} from '../motion/types';
import type {} from '../../layers/selection/types';
import type {} from '../../frames/selection/types';
import { createSetEasingCommand, requireEasingTarget } from './easingCommands';
import { createEasingDialog } from './EasingDialog';
import type { IEasingDialog } from './EasingDialog';
import { createPropertyEasingDialog } from './PropertyEasingDialog';
import { requirePropertyEasingTarget } from './propertyEasingTarget';
import { PropertyOperationError } from '../../../model/properties/propertyValue';
import { SpanOperationError } from '../../../model/spans/SpanOperationError';
import { sameEasing } from '../../../model/propertyTimelines/values';
import type { IEasingAvailability, IEasingService, IPropertyEasingTarget } from './types';
import './Easing.less';

export const EASING_PLUGIN_ID = 'tweens.easing';

/** Easing service owner; lifecycle cleanup also covers partially failed initialization. */
export class EasingPlugin implements EditorPlugin {
  readonly id = 'tweens.easing';
  readonly dependencies: readonly string[] = ['tweens.motion'];
  private ctx: IEditorContext | undefined;
  private dialog: IEasingDialog | undefined;
  private openingToken = 0;
  private cleanups: Array<() => void> = [];
  private propertyCleanups: Array<() => void> = [];

  readonly init = (ctx: IEditorContext): void => {
    this.ctx = ctx;
    try {
      ctx.services.require('tweens.motion');
      const service: IEasingService = {
        canSetAt: (layerId, frame) => this.canSetAt(layerId, frame),
        setAt: (layerId, frame, easing) => this.setAt(layerId, frame, easing),
        openAt: (layerId, frame) => this.openAt(layerId, frame),
        canSetProperty: (target) => this.canSetProperty(target),
        setProperty: (target, easing) => this.setProperty(target, easing),
        openProperty: (target) => this.openProperty(target),
        close: () => { this.close(); }
      };
      this.cleanups.push(ctx.services.provide(EASING_PLUGIN_ID, service));
      this.cleanups.push(ctx.events.on('document:changed', () => this.close()));
      this.cleanups.push(ctx.events.on('document:loaded', () => this.close()));
      this.cleanups.push(ctx.events.on('frames:selectionChanged', () => this.close()));
      this.cleanups.push(ctx.events.on('layers:selectionChanged', () => this.close()));
    } catch (error) { this.destroy(); throw error; }
  };

  destroy(): void {
    // Restoring focus may synchronously call a previously captured service.
    this.ctx = undefined;
    this.close();
    const cleanups = this.cleanups; this.cleanups = [];
    cleanups.reverse().forEach((cleanup) => cleanup());
  }

  private context(): IEditorContext {
    if (this.ctx === undefined) throw new Error('tweens.easing: used before init or after destroy.');
    return this.ctx;
  }

  private canSetAt(layerId: string, frame: number): IEasingAvailability {
    const ctx = this.context();
    try { requireEasingTarget(ctx.document, layerId, frame); return { enabled: true }; }
    catch (error) {
      if (error instanceof CommandRefusedError) return { enabled: false, reason: error.reason };
      throw error;
    }
  }

  private setAt(layerId: string, frame: number, easing: Easing): boolean {
    const ctx = this.context();
    const spanId = ctx.services.require('tweens.motion').tweenAt(layerId, frame)?.id;
    return ctx.commands.execute(createSetEasingCommand(layerId, frame, easing, spanId));
  }

  private canSetProperty(target: IPropertyEasingTarget): IEasingAvailability {
    const ctx = this.context();
    try {
      requirePropertyEasingTarget(ctx, target);
      return this.ctx === ctx ? { enabled: true } : { enabled: false, reason: 'L’éditeur a été détruit.' };
    } catch (error) {
      if (error instanceof PropertyOperationError || error instanceof SpanOperationError || error instanceof CommandRefusedError) {
        return { enabled: false, reason: error.message };
      }
      throw error;
    }
  }

  private setProperty(target: IPropertyEasingTarget, easing?: PropertyEasing): boolean {
    const ctx = this.context();
    return ctx.propertyTimelines.setEasing(target.layerId, target.property, target.transitionId, easing).status === 'changed';
  }

  private openProperty(input: IPropertyEasingTarget): boolean {
    const ctx = this.context();
    const target = { ...input };
    const document = ctx.document;
    const token = this.close();
    const current = (): boolean => this.ctx === ctx && this.openingToken === token && ctx.document === document;
    if (!current()) return false;
    let resolved: ReturnType<typeof requirePropertyEasingTarget>;
    try { resolved = requirePropertyEasingTarget(ctx, target); }
    catch (error) {
      if (error instanceof PropertyOperationError || error instanceof SpanOperationError || error instanceof CommandRefusedError) return false;
      throw error;
    }
    if (!current()) return false;
    try {
      this.propertyCleanups.push(ctx.events.on('stage:targetsChanged', () => this.close()));
      for (const stage of ctx.stage.stages) {
        const cleanup = stage.targets?.subscribe?.(() => this.close());
        if (cleanup !== undefined) {
          if (current()) this.propertyCleanups.push(cleanup);
          else cleanup();
        }
        if (!current()) return false;
      }
      const dialog = createPropertyEasingDialog({ owner: ctx.container, property: target.property, ...resolved,
        descriptor: ctx.registry.get(target.property),
        apply: (easing) => {
          if (!current() || !this.canSetProperty(target).enabled || !current()) return false;
          const result = ctx.propertyTimelines.guarded(current).setEasing(target.layerId, target.property, target.transitionId, easing);
          return result.status === 'changed' || result.status === 'noop' && resolved.transition.source === undefined && sameEasing(resolved.transition.easing, easing);
        }, close: () => { if (this.openingToken === token) this.close(); }
      });
      if (!current()) { dialog.destroy(); return false; }
      this.dialog = dialog;
      return true;
    } catch (error) {
      if (this.openingToken === token) this.close();
      throw error;
    }
  }

  private openAt(layerId: string, frame: number): boolean {
    const ctx = this.context();
    if (!this.canSetAt(layerId, frame).enabled) return false;
    const span = ctx.services.require('tweens.motion').tweenAt(layerId, frame);
    if (span === undefined) return false;
    const token = this.close();
    if (this.ctx !== ctx || this.openingToken !== token) return false;
    const dialog = createEasingDialog({ owner: ctx.container, easing: span.easing,
      apply: (preset) => {
        const current = ctx.services.require('tweens.motion').tweenAt(layerId, frame);
        if (current?.id !== span.id) return false;
        const command = createSetEasingCommand(layerId, frame, preset, span.id);
        // An identical choice is a successful confirmation with no history entry.
        if (!this.canSetAt(layerId, frame).enabled) return false;
        return ctx.commands.execute(command) || (current.easing ?? 'linear') === preset;
      }, close: () => { this.close(); }
    });
    // Initial focus may synchronously destroy, change or reopen the editor.
    if (this.ctx !== ctx || this.openingToken !== token) {
      dialog.destroy();
      return false;
    }
    this.dialog = dialog;
    return true;
  }

  private close(): number {
    const token = ++this.openingToken;
    const dialog = this.dialog;
    this.dialog = undefined;
    const propertyCleanups = this.propertyCleanups;
    this.propertyCleanups = [];
    propertyCleanups.reverse().forEach((cleanup) => cleanup());
    dialog?.destroy();
    return token;
  }
}

export function createEasingPlugin(): EasingPlugin { return new EasingPlugin(); }
