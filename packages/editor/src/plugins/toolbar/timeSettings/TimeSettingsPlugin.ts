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
 * plage) reste dans son champ, marquée invalide (`aria-invalid`), et le
 * motif s'affiche à côté des champs : on peut la corriger. Échap, ou tout
 * changement du document, rétablit la valeur du document. Les champs suivent le
 * document (annuler, rétablir, chargement).
 */

import type { ITimelineDocument } from '@werddomain/timeline-runtime';
import { CANCELLED_REASON } from '../../../core/commands/commandEvents';
import type { ICommand } from '../../../core/commands/ICommand';
import type { EditorPlugin, IEditorContext } from '../../../core/context/IEditorContext';
import {
  MAX_FPS,
  MIN_FPS,
  MIN_TOTAL_FRAMES,
  createSetFpsCommand,
  createSetTotalFramesCommand,
  maxTotalFrames
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
  /** Maximum du champ pour le document (relu à chaque synchronisation). */
  readonly max: (doc: ITimelineDocument) => number;
  readonly read: (doc: ITimelineDocument) => number;
  readonly command: (value: number) => ICommand;
}

const FIELDS: readonly IFieldSpec[] = [
  {
    name: 'fps',
    label: 'Cadence',
    unit: 'img/s',
    min: MIN_FPS,
    max: () => MAX_FPS,
    read: (doc) => doc.settings.fps,
    command: createSetFpsCommand
  },
  {
    name: 'totalFrames',
    label: 'Durée',
    unit: 'images',
    min: MIN_TOTAL_FRAMES,
    max: maxTotalFrames,
    read: (doc) => doc.settings.totalFrames,
    command: createSetTotalFramesCommand
  }
];

/** Motif affiché quand un plugin a opposé un veto (`command:before`) à la modification. */
export const CANCELLED_MESSAGE = 'La modification a été refusée par un autre module de l\'éditeur.';

/** Compteur des identifiants de la zone de message (un par contrôle rendu). */
let messageCount = 0;

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
    // Un nouveau document (annuler, rétablir, chargement) efface aussi un ancien motif de refus.
    const sync = (): void => {
      this.showMessage(undefined);
      this.syncFields();
    };
    const cleanups = [
      ctx.events.on('document:loaded', sync),
      ctx.events.on('document:changed', sync),
      ctx.events.on('command:refused', (event) => {
        if (event.command !== this.pending) return;
        this.refusal = event.reason === CANCELLED_REASON ? CANCELLED_MESSAGE : event.reason;
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
    messageCount += 1;
    const messageId = `${TIME_SETTINGS_CLASS}-message-${messageCount}`;
    this.fields = FIELDS.map((spec) => this.renderField(element, spec, messageId));
    // Zone toujours présente (vide quand tout va bien) : un lecteur d'écran
    // annonce le texte qui y apparaît, ce qu'il ne ferait pas pour une zone
    // affichée au même moment.
    const message = element.ownerDocument.createElement('span');
    message.id = messageId;
    message.classList.add(`${TIME_SETTINGS_CLASS}__message`);
    message.setAttribute('role', 'status');
    message.setAttribute('aria-live', 'polite');
    element.appendChild(message);
    this.message = message;
    this.syncFields();
    return () => {
      this.fields = [];
      this.message = null;
    };
  }

  private renderField(host: HTMLElement, spec: IFieldSpec, messageId: string): IField {
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
    input.dataset.setting = spec.name;
    input.setAttribute('aria-describedby', messageId);
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
      this.clearMark(field);
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
    this.showMessage(this.refusal, field);
    // Une valeur refusée reste dans son champ pour être corrigée.
    this.syncFields(this.refusal === undefined ? undefined : field);
  }

  /** Recopie les valeurs et les maximums du document dans les champs (sauf `keep`). */
  private syncFields(keep?: IField): void {
    const ctx = this.ctx;
    if (ctx === null) return;
    this.fields.forEach((field) => {
      const { spec, input } = field;
      input.max = String(spec.max(ctx.document));
      if (field !== keep) input.value = String(spec.read(ctx.document));
    });
  }

  /**
   * Retire la marque d'erreur de `field` seul ; efface le message si plus
   * aucun champ ne garde une valeur refusée.
   */
  private clearMark(field: IField): void {
    field.input.removeAttribute('aria-invalid');
    if (this.fields.every(({ input }) => !input.hasAttribute('aria-invalid'))) this.showMessage(undefined);
  }

  /** Affiche `text` (ou efface le message) ; marque `field` invalide pendant que le motif est affiché. */
  private showMessage(text: string | undefined, field?: IField): void {
    if (this.message === null) return;
    this.message.textContent = text ?? '';
    this.fields.forEach(({ input }) => {
      if (text !== undefined && input === field?.input) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    });
  }
}

/** Crée le plugin `toolbar.timeSettings`. */
export function createTimeSettingsPlugin(): TimeSettingsPlugin {
  return new TimeSettingsPlugin();
}
