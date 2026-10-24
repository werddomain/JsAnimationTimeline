// packages/editor/src/plugins/toolbar/timeSettings/TimeSettingsPlugin.ts
/**
 * Plugin : toolbar.timeSettings
 * Epic : toolbar
 * Dépend de : toolbar, toolbar.main
 * Écoute : document:loaded, document:changed, command:refused
 * Émet : —
 *
 * Réglages du temps dans la barre d'outils : deux champs, la cadence (images
 * par seconde) et la durée (en images). Une valeur validée (Entrée ou perte
 * du focus) passe par une commande annulable (`timeSettingsCommands.ts`).
 * Une valeur refusée (hors limites, ou durée plus courte que la fin d'une
 * plage) est remplacée par celle du document et le motif s'affiche à côté
 * des champs. Échap rétablit la valeur du document. Les champs suivent le
 * document (annuler, rétablir, chargement).
 */

import type { ITimelineDocument } from '@werddomain/timeline-runtime';
import type { ICommand } from '../../../core/commands/ICommand';
import type { EditorPlugin, IEditorContext } from '../../../core/context/IEditorContext';
import {
  MAX_FPS,
  MIN_FPS,
  MIN_TOTAL_FRAMES,
  createSetFpsCommand,
  createSetTotalFramesCommand
} from './timeSettingsCommands';
import { ToolbarGroupOrders } from '../main/ToolbarItems';
import './TimeSettings.less';

/** Identifiant du plugin (et de son contrôle dans la barre d'outils). */
export const TIME_SETTINGS_PLUGIN_ID = 'toolbar.timeSettings';

/** Classe du contrôle des réglages du temps. */
export const TIME_SETTINGS_CLASS = 'jt-timeSettings';

/** Description d'un champ : libellé, unité, limites, lecture et commande. */
interface IFieldSpec {
  readonly name: 'fps' | 'totalFrames';
  readonly label: string;
  readonly unit: string;
  readonly min: number;
  readonly max?: number;
  readonly read: (doc: ITimelineDocument) => number;
  readonly command: (value: number) => ICommand;
}

const FIELDS: readonly IFieldSpec[] = [
  {
    name: 'fps',
    label: 'Cadence',
    unit: 'img/s',
    min: MIN_FPS,
    max: MAX_FPS,
    read: (doc) => doc.settings.fps,
    command: createSetFpsCommand
  },
  {
    name: 'totalFrames',
    label: 'Durée',
    unit: 'images',
    min: MIN_TOTAL_FRAMES,
    read: (doc) => doc.settings.totalFrames,
    command: createSetTotalFramesCommand
  }
];

/** Un champ rendu et sa description. */
interface IField {
  readonly spec: IFieldSpec;
  readonly input: HTMLInputElement;
}

/** Plugin `toolbar.timeSettings` : cadence et durée du document, en commandes. */
export class TimeSettingsPlugin implements EditorPlugin {
  readonly id = 'toolbar.timeSettings';
  readonly dependencies: readonly string[] = ['toolbar', 'toolbar.main'];

  private ctx: IEditorContext | null = null;
  private fields: IField[] = [];
  private message: HTMLElement | null = null;
  /** Commande en cours d'exécution depuis un champ (pour reconnaître son refus). */
  private pending: ICommand | null = null;
  private refusal: string | undefined;
  private cleanups: Array<() => void> = [];

  readonly init = (ctx: IEditorContext): void => {
    const sync = (): void => this.syncFields();
    const cleanups = [
      ctx.events.on('document:loaded', sync),
      ctx.events.on('document:changed', sync),
      ctx.events.on('command:refused', (event) => {
        if (event.command === this.pending) this.refusal = event.reason;
      })
    ];
    this.ctx = ctx;
    try {
      cleanups.push(
        ctx.services.require('toolbar.main').addControl({
          id: TIME_SETTINGS_PLUGIN_ID,
          label: 'Réglages du temps',
          group: 'time',
          order: ToolbarGroupOrders.time + 1,
          render: (element) => this.renderControl(element)
        })
      );
    } catch (error) {
      this.ctx = null;
      cleanups.forEach((cleanup) => cleanup());
      throw error;
    }
    this.cleanups = cleanups;
  };

  destroy(): void {
    const cleanups = this.cleanups;
    this.cleanups = [];
    cleanups.forEach((cleanup) => cleanup());
    this.ctx = null;
  }

  private renderControl(element: HTMLElement): () => void {
    element.classList.add(TIME_SETTINGS_CLASS);
    this.fields = FIELDS.map((spec) => this.renderField(element, spec));
    const message = element.ownerDocument.createElement('span');
    message.classList.add(`${TIME_SETTINGS_CLASS}__message`);
    message.setAttribute('role', 'status');
    message.setAttribute('aria-live', 'polite');
    message.hidden = true;
    element.appendChild(message);
    this.message = message;
    this.syncFields();
    return () => {
      this.fields = [];
      this.message = null;
    };
  }

  private renderField(host: HTMLElement, spec: IFieldSpec): IField {
    const doc = host.ownerDocument;
    const label = doc.createElement('label');
    label.classList.add(`${TIME_SETTINGS_CLASS}__field`);
    const text = doc.createElement('span');
    text.textContent = spec.label;
    const input = doc.createElement('input');
    input.type = 'number';
    input.name = spec.name;
    input.step = '1';
    input.min = String(spec.min);
    if (spec.max !== undefined) input.max = String(spec.max);
    input.dataset.setting = spec.name;
    const unit = doc.createElement('span');
    unit.classList.add(`${TIME_SETTINGS_CLASS}__unit`);
    unit.textContent = spec.unit;
    label.append(text, input, unit);
    host.appendChild(label);
    const field = { spec, input };
    input.addEventListener('change', () => this.commit(field));
    input.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      this.showMessage(undefined);
      this.syncFields();
    });
    return field;
  }

  /** Applique la valeur saisie par une commande ; en cas de refus, affiche le motif. */
  private commit(field: IField): void {
    const ctx = this.ctx;
    if (ctx === null) return;
    const raw = field.input.value.trim();
    const value = raw === '' ? Number.NaN : Number(raw);
    if (value === field.spec.read(ctx.document)) {
      this.showMessage(undefined);
      return;
    }
    const command = field.spec.command(value);
    this.pending = command;
    this.refusal = undefined;
    try {
      ctx.commands.execute(command);
    } finally {
      this.pending = null;
    }
    this.showMessage(this.refusal);
    this.syncFields();
  }

  /** Recopie les valeurs du document dans les champs. */
  private syncFields(): void {
    const ctx = this.ctx;
    if (ctx === null) return;
    this.fields.forEach(({ spec, input }) => {
      input.value = String(spec.read(ctx.document));
    });
  }

  private showMessage(text: string | undefined): void {
    if (this.message === null) return;
    this.message.textContent = text ?? '';
    this.message.hidden = text === undefined;
  }
}

/** Crée le plugin `toolbar.timeSettings`. */
export function createTimeSettingsPlugin(): TimeSettingsPlugin {
  return new TimeSettingsPlugin();
}
