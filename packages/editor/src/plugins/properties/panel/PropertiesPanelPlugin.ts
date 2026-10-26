// packages/editor/src/plugins/properties/panel/PropertiesPanelPlugin.ts
/**
 * Plugin: properties.panel
 * Epic: properties (optional)
 * Depends on: layout.shell, layers.selection, tweens.propertyKeyframes
 * Listens: document changes, layer selection, playback, stage metadata, toolbar:editKeyframe
 * Emits: none (edits use the W2 command service)
 */
import type { EditorPlugin, IEditorContext } from '../../../core/context/IEditorContext';
import { assertFrame, findLayer } from '../../../model/spans/layerAccess';
import type {} from '../../toolbar/keyframeActions/types';
import { PanelView } from './PanelView';
import { readPanelState, samePanelContext } from './panelState';
import type { IPanelState } from './panelState';
import type { IPropertiesPanelService } from './types';
import './PropertiesPanel.less';

export const PROPERTIES_PANEL_PLUGIN_ID = 'properties.panel';
const ROOT_CLASS = 'jt-properties-panel-owner';

/** Persistent optional inspector using the existing root slot. */
export class PropertiesPanelPlugin implements EditorPlugin {
  readonly id = 'properties.panel';
  readonly dependencies: readonly string[] = ['layout.shell', 'layers.selection', 'tweens.propertyKeyframes'];
  private ctx: IEditorContext | undefined;
  private view: PanelView | undefined;
  private cleanups: Array<() => void> = [];
  private revision = 0;
  private focusToken = 0;
  private refreshVersion = 0;

  readonly init = (ctx: IEditorContext): void => {
    this.ctx = ctx;
    try {
      ctx.services.require('layers.selection');
      ctx.services.require('tweens.propertyKeyframes');
      const service: IPropertiesPanelService = Object.freeze({ focusAt: (id: string, frame: number) => this.focusAt(id, frame) });
      this.cleanups.push(ctx.services.provide(PROPERTIES_PANEL_PLUGIN_ID, service));
      const refresh = (): void => this.refresh();
      this.cleanups.push(ctx.events.on('document:changed', refresh), ctx.events.on('document:loaded', refresh),
        ctx.events.on('layers:selectionChanged', refresh), ctx.events.on('playhead:changed', refresh),
        ctx.events.on('playback:play', refresh), ctx.events.on('playback:pause', refresh),
        ctx.events.on('playback:complete', refresh), ctx.events.on('stage:targetsChanged', () => this.metadataChanged()),
        ctx.events.on('toolbar:editKeyframe', ({ layerId, frame }) => { this.focusAt(layerId, frame); }));
      for (const stage of ctx.stage.stages) {
        const remove = stage.targets?.subscribe?.(() => this.metadataChanged());
        if (remove !== undefined) this.cleanups.push(remove);
      }
    } catch (error) { this.destroy(); throw error; }
  };

  render(slot: HTMLElement): void {
    const ctx = this.context();
    ctx.container.classList.add(ROOT_CLASS);
    this.view = new PanelView(slot, (state, name, value) => this.commit(state, name, value));
    this.refresh();
  }

  destroy(): void {
    const ctx = this.ctx;
    this.ctx = undefined;
    ++this.focusToken;
    const view = this.view;
    this.view = undefined;
    view?.destroy();
    ctx?.container.classList.remove(ROOT_CLASS);
    const cleanups = this.cleanups;
    this.cleanups = [];
    cleanups.reverse().forEach((remove) => remove());
  }

  private context(): IEditorContext {
    if (this.ctx === undefined) throw new Error('properties.panel: used before init or after destroy.');
    return this.ctx;
  }

  private metadataChanged(): void { ++this.revision; this.refresh(); }

  private refresh(reset = false): void {
    const ctx = this.ctx;
    if (ctx === undefined || this.view === undefined) return;
    const view = this.view;
    const version = ++this.refreshVersion;
    const state = readPanelState(ctx, this.revision);
    if (this.ctx !== ctx || this.view !== view || this.refreshVersion !== version) return;
    if (!this.isCurrent(ctx, state)) { this.refresh(); return; }
    view.update(state, reset);
  }

  private commit(ticket: IPanelState, name: string, value: number): void {
    const ctx = this.ctx;
    if (ctx === undefined) return;
    const fresh = readPanelState(ctx, this.revision);
    if (this.ctx !== ctx) return;
    if (!this.isCurrent(ctx, fresh) || !samePanelContext(ticket, fresh) || fresh.reason !== '' || fresh.layerId === undefined ||
        !fresh.fields.some(({ descriptor }) => descriptor.name === name)) { this.refresh(); return; }
    // Re-querying W2 above and its command below both fail closed on metadata errors.
    ctx.services.require('tweens.propertyKeyframes').setProperty(fresh.layerId, name, value, { frame: fresh.frame });
    this.refresh(true);
  }

  /** Metadata and interpolation are developer callbacks; recheck without calling them again. */
  private isCurrent(ctx: IEditorContext, state: IPanelState): boolean {
    return this.ctx === ctx && ctx.document === state.document && ctx.playback.frame === state.frame &&
      ctx.playback.playing === state.playing && this.revision === state.revision &&
      JSON.stringify(ctx.services.require('layers.selection').selected()) === state.selection;
  }

  private focusAt(layerId: string, frame: number): boolean {
    const ctx = this.context();
    const doc = ctx.document;
    const beforeFrame = ctx.playback.frame;
    if (!this.validTarget(ctx, layerId, frame) || this.view === undefined) return false;
    const token = ++this.focusToken;
    const selection = ctx.services.require('layers.selection');
    selection.select([layerId]);
    const current = (expectedFrame: number): boolean => this.ctx === ctx && this.focusToken === token &&
      ctx.document === doc && ctx.playback.frame === expectedFrame &&
      selection.selected().length === 1 && selection.selected()[0] === layerId &&
      this.validTarget(ctx, layerId, frame);
    if (!current(beforeFrame)) return false;
    ctx.playback.seek(frame);
    if (!current(frame)) return false;
    this.refresh();
    if (!current(frame)) return false;
    this.view?.focus();
    if (!current(frame)) { this.refresh(); return false; }
    return true;
  }

  private validTarget(ctx: IEditorContext, layerId: string, frame: number): boolean {
    try { assertFrame(ctx.document, frame); return findLayer(ctx.document, layerId) !== undefined; }
    catch { return false; }
  }
}

export function createPropertiesPanelPlugin(): PropertiesPanelPlugin { return new PropertiesPanelPlugin(); }

