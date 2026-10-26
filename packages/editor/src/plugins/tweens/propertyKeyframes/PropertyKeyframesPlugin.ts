// packages/editor/src/plugins/tweens/propertyKeyframes/PropertyKeyframesPlugin.ts
/**
 * Plugin: tweens.propertyKeyframes
 * Epic: tweens
 * Depends on: tweens.motion
 * Listens: —
 * Emits: — (document and refusal events belong to the shared command stack)
 *
 * Headless property discovery and edits. The future property panel consumes
 * this service; timeline diamonds already derive from document tracks.
 */
import type { PropertyDescriptor } from '@werddomain/timeline-runtime';
import type { EditorPlugin, IEditorContext } from '../../../core/context/IEditorContext';
import type { SetPropertyOptions } from '../../../core/editor/types';
import { readTargetInfo } from '../../../core/stage/targetInfo';
import { SetPropertyCommand } from '../../../model/properties/SetPropertyCommand';
import { PropertyOperationError } from '../../../model/properties/propertyValue';
import { getTargetPropertyNames } from '../../../model/properties/targetProperties';
import type { IPropertyEditContext } from '../../../model/properties/targetProperties';
import { findLayer } from '../../../model/spans/layerAccess';
import type { IPropertyKeyframesService } from './types';

export const PROPERTY_KEYFRAMES_PLUGIN_ID = 'tweens.propertyKeyframes';

/** Publishes property capabilities and the core undoable property command. */
export class PropertyKeyframesPlugin implements EditorPlugin {
  readonly id = 'tweens.propertyKeyframes';
  readonly dependencies: readonly string[] = ['tweens.motion'];
  private ctx: IEditorContext | undefined;
  private removeService: (() => void) | undefined;

  readonly init = (ctx: IEditorContext): void => {
    const service: IPropertyKeyframesService = Object.freeze({
      propertiesFor: (layerId: string) => this.propertiesFor(layerId),
      setProperty: (layerId: string, name: string, value: number, options?: SetPropertyOptions) =>
        this.setProperty(layerId, name, value, options)
    });
    this.removeService = ctx.services.provide(PROPERTY_KEYFRAMES_PLUGIN_ID, service);
    this.ctx = ctx;
  };

  destroy(): void {
    const remove = this.removeService;
    this.removeService = undefined;
    this.ctx = undefined;
    remove?.();
  }

  private propertiesFor(layerId: string): readonly PropertyDescriptor[] {
    const ctx = this.requireContext();
    const layer = findLayer(ctx.document, layerId);
    if (layer === undefined) return Object.freeze([]);
    const names = new Set(getTargetPropertyNames(layer.target, this.editContext(ctx)));
    return Object.freeze(ctx.registry.list().filter(({ name }) => names.has(name)));
  }

  private setProperty(layerId: string, name: string, value: number, options: SetPropertyOptions = {}): boolean {
    const ctx = this.requireContext();
    const frame = options.frame === undefined ? ctx.playback.frame : options.frame;
    return ctx.commands.execute(new SetPropertyCommand(layerId, name, value, frame, this.editContext(ctx)));
  }

  private editContext(ctx: IEditorContext): IPropertyEditContext {
    return {
      registry: ctx.registry,
      describe: (target) => {
        try { return readTargetInfo(ctx.stage.stages, target); }
        catch { throw new PropertyOperationError('Les propriétés de la cible sont indisponibles.'); }
      }
    };
  }

  private requireContext(): IEditorContext {
    if (this.ctx === undefined) throw new Error('tweens.propertyKeyframes : utilisé avant init ou après destroy.');
    return this.ctx;
  }
}
