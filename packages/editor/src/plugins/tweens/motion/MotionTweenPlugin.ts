// packages/editor/src/plugins/tweens/motion/MotionTweenPlugin.ts
/**
 * Plugin : tweens.motion
 * Epic : tweens
 * Dépend de : frames.selection
 * Écoute : frames:selectionChanged, document:changed, document:loaded
 * Émet : tweens:motionAvailabilityChanged, tweens:motionCreated, tweens:motionRemoved
 *
 * Interpolations de mouvement (motion tween de Flash CS4) : créer depuis une
 * ou deux images clés, supprimer. Sans interface ni emplacement : il publie
 * le service `tweens.motion` que les boutons (T2), le menu contextuel (I1)
 * et les plugins W2 / W3 utilisent. Les opérations sont des commandes
 * annulables (`motionTweenCommands.ts`) qui évaluent les valeurs avec
 * `ctx.registry`.
 *
 * `canCreate()` et `canRemove()` font un essai à blanc de l'opération sur le
 * document courant : même verdict que la commande, raison comprise. Quand
 * l'un des deux change (sélection, document modifié ou chargé),
 * `tweens:motionAvailabilityChanged` est émis. `tweens:motionCreated` et
 * `tweens:motionRemoved` suivent une exécution réussie seulement (pas un
 * annuler / rétablir : ils changent le document, `document:changed` le dit).
 * Un refus (sélection invalide, calque verrouillé) passe par
 * `command:refused` avec le message français.
 */

import type { ISpan, ITimelineDocument } from '@kazo-ca/timeline-runtime';
import type { EditorPlugin, IEditorContext } from '../../../core/context/IEditorContext';
import type { ICommand } from '../../../core/commands/ICommand';
import { findLayer } from '../../../model/spans/layerAccess';
import { spanIndexAt } from '../../../model/spans/tracks';
// Types seulement : service utilisé (frames.selection) et événement écouté (frames:selectionChanged).
import type {} from '../../frames/selection/types';
import type { IFrameCell } from '../../frames/selection/frameSelection';
import { createMotionTween } from './createMotionTween';
import type { IMotionTarget } from './createMotionTween';
import { refusalReason } from './MotionTweenError';
import { createMotionTweenCommands } from './motionTweenCommands';
import type { IMotionTweenCommands } from './motionTweenCommands';
import { removeMotionTweens } from './removeMotionTween';
import type { IRemoveTarget } from './removeMotionTween';
import { resolveCreateTarget, resolveRemoveTargets } from './resolveTarget';
import type { Resolution } from './resolveTarget';
import { propertyMotionPlan, runPropertyMotion } from './propertyMotion';
import type {
  IMotionTweenAvailability,
  IMotionTweenService,
  MotionAvailabilityChangedEvent,
  MotionTweenEvent
} from './types';

/** Identifiant du plugin (et de son service). */
export const MOTION_TWEEN_PLUGIN_ID = 'tweens.motion';

const ENABLED: IMotionTweenAvailability = Object.freeze({ enabled: true });

function disabled(reason: string): IMotionTweenAvailability {
  return Object.freeze({ enabled: false, reason });
}

function sameAvailability(a: IMotionTweenAvailability, b: IMotionTweenAvailability): boolean {
  return a.enabled === b.enabled && a.reason === b.reason;
}

/** Essai à blanc : `operation` s'applique-t-elle à `doc` ? Un refus donne sa raison, un bogue est propagé. */
function dryRun(operation: () => ITimelineDocument): IMotionTweenAvailability {
  try {
    operation();
    return ENABLED;
  } catch (error) {
    const reason = refusalReason(error);
    if (reason === undefined) throw error;
    return disabled(reason);
  }
}

/** Plage de `layerId` qui contient `frame` dans `doc`. */
function spanAt(doc: ITimelineDocument, layerId: string, frame: number): ISpan | undefined {
  const layer = findLayer(doc, layerId);
  return layer === undefined ? undefined : layer.spans[spanIndexAt(layer, frame)];
}

function eventOf(layerId: string, span: ISpan): MotionTweenEvent {
  return { layerId, spanId: span.id, start: span.start, end: span.end };
}

/** Crée et supprime les interpolations de mouvement, depuis la sélection ou par API. */
export class MotionTweenPlugin implements EditorPlugin {
  readonly id = 'tweens.motion';
  readonly dependencies: readonly string[] = ['frames.selection'];

  private ctx: IEditorContext | undefined;
  private commands: IMotionTweenCommands | undefined;
  private availability: MotionAvailabilityChangedEvent | undefined;
  private cleanups: Array<() => void> = [];

  readonly init = (ctx: IEditorContext): void => {
    this.ctx = ctx;
    this.commands = createMotionTweenCommands(ctx.registry);
    this.availability = this.computeAvailability();
    const refresh = (): void => this.refreshAvailability();
    this.cleanups = [
      ctx.services.provide(MOTION_TWEEN_PLUGIN_ID, this.service()),
      ctx.events.on('frames:selectionChanged', refresh),
      ctx.events.on('document:changed', refresh),
      ctx.events.on('document:loaded', refresh),
      ctx.events.on('stage:targetsChanged', refresh)
    ];
  };

  destroy(): void {
    const cleanups = this.cleanups;
    this.cleanups = [];
    cleanups.forEach((cleanup) => cleanup());
    this.availability = undefined;
    this.commands = undefined;
    this.ctx = undefined;
  }

  private service(): IMotionTweenService {
    return {
      canCreate: () => this.createAvailability(),
      canRemove: () => this.removeAvailability(),
      create: () => this.createFromSelection(),
      remove: () => this.removeFromSelection(),
      createAt: (layerId, from, to) => this.executeCreate({ layerId, from, ...(to === undefined ? {} : { to }) }),
      removeAt: (layerId, frame) => this.executeRemove([{ layerId, frames: [frame] }]),
      tweenAt: (layerId, frame) => {
        const span = spanAt(this.requireContext().document, layerId, frame);
        return span?.kind === 'tween' ? span : undefined;
      }
    };
  }

  private selectedCells(): readonly IFrameCell[] {
    return this.requireContext().services.require('frames.selection').cells();
  }

  private createAvailability(): IMotionTweenAvailability {
    const ctx = this.requireContext();
    const modern = propertyMotionPlan(ctx, 'create');
    if (modern !== undefined) return modern.availability;
    const resolved = resolveCreateTarget(ctx.document, this.selectedCells());
    if (!resolved.ok) return disabled(resolved.message);
    return dryRun(() => createMotionTween(ctx.document, resolved.target, ctx.registry));
  }

  private removeAvailability(): IMotionTweenAvailability {
    const ctx = this.requireContext();
    const modern = propertyMotionPlan(ctx, 'remove');
    if (modern !== undefined) return modern.availability;
    const resolved = resolveRemoveTargets(ctx.document, this.selectedCells());
    if (!resolved.ok) return disabled(resolved.message);
    const targets = resolved.target;
    return dryRun(() => targets.reduce((doc, t) => removeMotionTweens(doc, t.layerId, t.frames, ctx.registry), ctx.document));
  }

  private computeAvailability(): MotionAvailabilityChangedEvent {
    return { canCreate: this.createAvailability(), canRemove: this.removeAvailability() };
  }

  /** Recalcule la disponibilité et l'annonce seulement si elle a changé. */
  private refreshAvailability(): void {
    const previous = this.availability;
    const next = this.computeAvailability();
    this.availability = next;
    const unchanged =
      previous !== undefined &&
      sameAvailability(previous.canCreate, next.canCreate) &&
      sameAvailability(previous.canRemove, next.canRemove);
    if (!unchanged) this.requireContext().events.emit('tweens:motionAvailabilityChanged', next);
  }

  private createFromSelection(): boolean {
    const modern = runPropertyMotion(this.requireContext(), 'create');
    if (modern !== undefined) return modern;
    const resolved: Resolution<IMotionTarget> = resolveCreateTarget(this.requireContext().document, this.selectedCells());
    if (!resolved.ok) return this.execute(this.requireCommands().refused('create', resolved.message));
    return this.executeCreate(resolved.target);
  }

  private removeFromSelection(): boolean {
    const modern = runPropertyMotion(this.requireContext(), 'remove');
    if (modern !== undefined) return modern;
    const resolved = resolveRemoveTargets(this.requireContext().document, this.selectedCells());
    if (!resolved.ok) return this.execute(this.requireCommands().refused('remove', resolved.message));
    return this.executeRemove(resolved.target);
  }

  private execute(command: ICommand): boolean {
    return this.requireContext().commands.execute(command);
  }

  private executeCreate(target: IMotionTarget): boolean {
    const commands = this.requireCommands();
    const command =
      target.to === undefined
        ? commands.createFromSpan(target.layerId, target.from)
        : commands.createBetween(target.layerId, target.from, target.to);
    if (!this.execute(command)) return false;
    const span = spanAt(this.requireContext().document, target.layerId, target.from);
    if (span !== undefined) this.requireContext().events.emit('tweens:motionCreated', eventOf(target.layerId, span));
    return true;
  }

  private executeRemove(targets: readonly IRemoveTarget[]): boolean {
    const before = this.requireContext().document;
    const removed = targets.flatMap((target) =>
      target.frames.flatMap((frame) => {
        const span = spanAt(before, target.layerId, frame);
        return span?.kind === 'tween' ? [eventOf(target.layerId, span)] : [];
      })
    );
    if (!this.execute(this.requireCommands().remove(targets))) return false;
    const unique = new Map(removed.map((event) => [`${event.layerId}:${event.spanId}`, event] as const));
    unique.forEach((event) => this.requireContext().events.emit('tweens:motionRemoved', event));
    return true;
  }

  private requireContext(): IEditorContext {
    if (this.ctx === undefined) throw new Error('tweens.motion : utilisé avant init ou après destroy.');
    return this.ctx;
  }

  private requireCommands(): IMotionTweenCommands {
    if (this.commands === undefined) throw new Error('tweens.motion : utilisé avant init ou après destroy.');
    return this.commands;
  }
}
