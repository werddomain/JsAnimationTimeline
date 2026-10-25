// packages/editor/src/plugins/playback/livePreview/LivePreviewPlugin.ts
/**
 * Plugin: playback.livePreview; epic: playback.
 * Requires playback and layout.playhead. The toolbar.main service is optional.
 * Listens to scrub start/end, frame renders and playback play/pause/complete;
 * emits playback:previewChanged.
 *
 * While scrubbing, live mode renders each display frame, throttled mode limits
 * scene renders using the editor clock, and onRelease mode waits for release.
 * Stage holds affect only scene sync/render; the playhead and frame events keep
 * following the pointer. Drag endings, playback start, mode changes and destroy
 * release the hold. Pause or completion during the same drag opens it again.
 *
 * If release precedes the pending display frame, release waits for frame:render
 * and cancels the trailing timer so it cannot render that frame in between.
 * In throttled mode, a timer that already fired BEFORE release may have flushed
 * the sought frame before its display frame. That display frame can render the
 * same output again: throttling does not guarantee unique scene renders.
 * Hidden editor layers still rely on the scene honoring editorVisible.
 *
 * The optional French Aperçu control is added immediately when toolbar.main is
 * available, or retried once at editor:ready for a later toolbar epic. Without
 * that service, or with toolbar: false, the plugin works without a control.
 */

import type { EditorPlugin, IEditorContext } from '../../../core/context/IEditorContext';
import type { IStageHold } from '../../../core/stage/types';
import '../../layout/playhead/PlayheadPlugin';
import { ToolbarGroupOrders } from '../../toolbar/main/ToolbarItems';
import { renderLivePreviewControl } from './livePreviewControl';
import { DEFAULT_PREVIEW_MAX_FPS, checkMaxFps, checkMode, remainingMs } from './previewSettings';
import type { ILivePreviewApi, ILivePreviewOptions, LivePreviewMode } from './types';

/** Identifiant du plugin (et de son service et de son contrôle). */
export const LIVE_PREVIEW_PLUGIN_ID = 'playback.livePreview';

export { DEFAULT_PREVIEW_MAX_FPS };

/** Glisser en cours, hors mode `'live'`. */
interface IPreviewSession {
  readonly hold: IStageHold;
  /** Instant (horloge de l'éditeur) du dernier rendu permis. */
  lastRender: number;
  /** Rendu de fin programmé (`setTimeout`), ou `null`. */
  timer: ReturnType<typeof setTimeout> | null;
}

/** Plugin `playback.livePreview` : aperçu de la scène pendant le glisser de la tête. */
export class LivePreviewPlugin implements EditorPlugin {
  readonly id = 'playback.livePreview';
  readonly dependencies: readonly string[] = ['playback', 'layout.playhead'];

  private mode: LivePreviewMode;
  private maxFps: number;
  private readonly toolbar: boolean;
  private ctx: IEditorContext | null = null;
  private session: IPreviewSession | null = null;
  /** Image courante au dernier `frame:render`, ou `null` avant le premier. */
  private renderedFrame: number | null = null;
  /** Fin de glisser reçue avant le rendu d'affichage de l'image atteinte : libération au prochain `frame:render`. */
  private releasePending = false;
  private cleanups: Array<() => void> = [];

  constructor(options: ILivePreviewOptions = {}) {
    this.mode = checkMode(options.mode ?? 'live');
    this.maxFps = checkMaxFps(options.maxFps ?? DEFAULT_PREVIEW_MAX_FPS);
    this.toolbar = options.toolbar !== false;
  }

  readonly init = (ctx: IEditorContext): void => {
    const cleanups: Array<() => void> = [];
    this.ctx = ctx;
    try {
      cleanups.push(ctx.events.on('playhead:scrubStart', () => this.open()));
      cleanups.push(ctx.events.on('playhead:scrubEnd', () => this.onScrubEnd()));
      cleanups.push(ctx.events.on('playback:play', () => this.close()));
      // Lecture arrêtée pendant le même glisser : la retenue se rouvre.
      cleanups.push(ctx.events.on('playback:pause', () => this.open()));
      cleanups.push(ctx.events.on('playback:complete', () => this.open()));
      cleanups.push(ctx.events.on('frame:render', () => this.onFrame()));
      cleanups.push(ctx.services.provide(LIVE_PREVIEW_PLUGIN_ID, this.createService()));
      // Retry once after all epics initialize; toolbar.main remains optional.
      if (this.toolbar && !this.addToolbarControl(ctx, cleanups)) {
        const off = ctx.events.on('editor:ready', () => {
          off();
          this.addToolbarControl(ctx, this.cleanups);
        });
        cleanups.push(off);
      }
    } catch (error) {
      cleanups.forEach((cleanup) => cleanup());
      this.ctx = null;
      throw error;
    }
    this.cleanups = cleanups;
  };

  /** Ajoute la liste « Aperçu » si `toolbar.main` est monté ; `false` sinon. */
  private addToolbarControl(ctx: IEditorContext, cleanups: Array<() => void>): boolean {
    const toolbar = ctx.services.get('toolbar.main');
    if (toolbar === undefined) return false;
    cleanups.push(
      toolbar.addControl({
        id: LIVE_PREVIEW_PLUGIN_ID,
        label: 'Aperçu',
        group: 'playback',
        order: ToolbarGroupOrders.playback + 2,
        render: (element) => renderLivePreviewControl(element, this.requireService(), ctx.events)
      })
    );
    return true;
  }

  destroy(): void {
    this.close();
    const cleanups = this.cleanups;
    this.cleanups = [];
    cleanups.forEach((cleanup) => cleanup());
    this.ctx = null;
  }

  /**
   * Ouvre la retenue d'un glisser (sauf en mode `'live'`, pendant la lecture
   * ou sans glisser réel de `layout.playhead` : un `playhead:scrubStart`
   * émis par un autre plugin ne retient rien). Sans scène, la retenue est
   * inerte : pas de session.
   */
  private open(): void {
    const ctx = this.ctx;
    if (ctx === null || ctx.services.get('layout.playhead')?.isScrubbing() !== true) return;
    // Nouveau glisser avant le rendu en attente : la retenue en cours continue.
    this.releasePending = false;
    if (this.session !== null || this.mode === 'live' || ctx.playback.playing) return;
    const hold = ctx.stage.hold();
    if (!hold.active) return;
    this.session = { hold, lastRender: Number.NEGATIVE_INFINITY, timer: null };
  }

  /** Fin du glisser : libère tout de suite, ou après le `frame:render` en attente de l'image atteinte. */
  private onScrubEnd(): void {
    const ctx = this.ctx;
    if (this.session !== null && ctx !== null && ctx.playback.frame !== this.renderedFrame) {
      // A trailing flush must not overtake the pending display frame after release.
      if (this.session.timer !== null) {
        clearTimeout(this.session.timer);
        this.session.timer = null;
      }
      this.releasePending = true;
      return;
    }
    this.close();
  }

  /** Ferme la retenue : rend l'image courante si un rendu a été retenu. */
  private close(): void {
    const session = this.session;
    this.releasePending = false;
    if (session === null) return;
    this.session = null;
    if (session.timer !== null) clearTimeout(session.timer);
    session.hold.release();
  }

  /** Mode `'throttled'` : rend l'image courante si l'intervalle est écoulé, sinon programme un rendu de fin. */
  private onFrame(): void {
    const session = this.session;
    const ctx = this.ctx;
    if (ctx !== null) this.renderedFrame = ctx.playback.frame;
    if (this.releasePending) {
      this.close();
      return;
    }
    if (session === null || ctx === null || this.mode !== 'throttled') return;
    const wait = remainingMs(ctx.playback.now(), session.lastRender, this.maxFps);
    if (wait === 0) {
      this.renderNow(session);
      return;
    }
    if (session.timer === null) {
      session.timer = setTimeout(() => {
        session.timer = null;
        if (this.session === session) this.renderNow(session);
      }, wait);
    }
  }

  private renderNow(session: IPreviewSession): void {
    if (session.timer !== null) {
      clearTimeout(session.timer);
      session.timer = null;
    }
    session.lastRender = this.ctx?.playback.now() ?? session.lastRender;
    session.hold.flush();
  }

  private setMode(mode: LivePreviewMode): void {
    const next = checkMode(mode);
    if (next === this.mode) return;
    const scrubbing = this.ctx?.services.get('layout.playhead')?.isScrubbing() === true;
    this.close();
    this.mode = next;
    if (scrubbing) this.open();
    this.announce();
  }

  private setMaxFps(maxFps: number): void {
    const next = checkMaxFps(maxFps);
    if (next === this.maxFps) return;
    this.maxFps = next;
    this.announce();
  }

  private announce(): void {
    this.ctx?.events.emit('playback:previewChanged', { mode: this.mode, maxFps: this.maxFps });
  }

  private createService(): ILivePreviewApi {
    const read = (): { mode: LivePreviewMode; maxFps: number } => ({ mode: this.mode, maxFps: this.maxFps });
    return Object.freeze({
      get mode(): LivePreviewMode {
        return read().mode;
      },
      get maxFps(): number {
        return read().maxFps;
      },
      setMode: (mode: LivePreviewMode) => this.setMode(mode),
      setMaxFps: (maxFps: number) => this.setMaxFps(maxFps)
    } satisfies ILivePreviewApi);
  }

  private requireService(): ILivePreviewApi {
    const service = this.ctx?.services.get(LIVE_PREVIEW_PLUGIN_ID);
    if (service === undefined) throw new Error("playback.livePreview : le plugin n'est pas initialisé.");
    return service;
  }
}

/** Crée le plugin `playback.livePreview` (voir `ILivePreviewOptions`). */
export function createLivePreviewPlugin(options: ILivePreviewOptions = {}): LivePreviewPlugin {
  return new LivePreviewPlugin(options);
}
