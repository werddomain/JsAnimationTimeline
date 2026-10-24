// packages/editor/src/plugins/playback/controls/PlaybackControlsPlugin.ts
/**
 * Plugin : playback.controls
 * Epic : playback
 * Dépend de : playback, toolbar.main, interaction.shortcuts
 * Écoute : playback:play, playback:pause, playback:loop, playback:complete, playhead:changed
 * Émet : —
 *
 * Contrôles de lecture dans le groupe `playback` de la barre d'outils :
 * - Lire / Pause (une seule touche, Entrée comme dans Flash) ;
 * - Boucle (bouton à bascule, `aria-pressed`) ;
 * - Vitesse (liste de `PLAYBACK_SPEEDS`).
 *
 * Tout passe par `ctx.playback` : la lecture marche avec ou sans scène.
 * Les contrôles suivent l'état de la lecture par ses événements (icône
 * Lire / Pause). Le noyau n'annonce pas un changement de boucle ou de
 * vitesse fait ailleurs : les contrôles les relisent à chaque événement de
 * lecture et à chaque déplacement de la tête de lecture.
 *
 * Le raccourci est déclaré auprès de `interaction.shortcuts` (aucun
 * écouteur clavier global). Entrée garde son sens dans un champ de saisie
 * et sur un bouton ou un lien qui a le focus (il l'active).
 */

import type { EditorPlugin, IEditorContext } from '../../../core/context/IEditorContext';
import type { IEditorPlayback } from '../../../core/playback/types';
import { ToolbarGroupOrders } from '../../toolbar/main/ToolbarItems';
import './PlaybackControls.less';

/** Identifiant du plugin (et de son contrôle dans la barre d'outils). */
export const PLAYBACK_CONTROLS_PLUGIN_ID = 'playback.controls';

/** Classe du contrôle de lecture. */
export const PLAYBACK_CONTROLS_CLASS = 'jt-playbackControls';

/** Identifiant du raccourci Lire / Pause. */
export const PLAYBACK_TOGGLE_SHORTCUT_ID = 'playback.controls.toggle';

/** Combinaison du raccourci Lire / Pause (Entrée, comme dans Flash). */
export const PLAYBACK_TOGGLE_KEYS = 'Enter';

/** Vitesses proposées dans la liste. */
export const PLAYBACK_SPEEDS: readonly number[] = Object.freeze([0.25, 0.5, 1, 1.5, 2]);

/**
 * Libellé français d'une vitesse (`1.5` -> `×1,5`). Le bruit des flottants
 * est arrondi au centième (`0.1 + 0.2` -> `×0,3`). Une vitesse qui n'est pas
 * un centième juste s'écrit en entier, avec tous ses chiffres (`1.0005` ->
 * `×1,0005`, `10.001` -> `×10,001`) : deux vitesses différentes n'ont jamais
 * le même libellé.
 */
export function formatSpeed(speed: number): string {
  const rounded = Math.round(speed * 100) / 100;
  const shown = Math.abs(rounded - speed) < 1e-9 ? rounded : speed;
  return `×${String(shown).replace('.', ',')}`;
}

/** Éléments qu'Entrée active déjà : le raccourci leur laisse la touche. */
const ENTER_ACTIVATED_SELECTOR = 'button, a[href], summary, [role="button"], [role="link"], [role="menuitem"], [role="tab"]';

/**
 * Vrai si Entrée sur `target` active déjà un élément (bouton, lien...).
 * Teste `nodeType` plutôt que `instanceof Element` : un élément d'une
 * iframe (une scène, par exemple) a son propre constructeur `Element`.
 */
export function isEnterActivated(target: EventTarget | null): boolean {
  if (target === null || (target as Partial<Node>).nodeType !== 1) return false;
  return (target as Element).closest(ENTER_ACTIVATED_SELECTOR) !== null;
}

/** Éléments du contrôle rendu. */
interface IControlsView {
  readonly toggle: HTMLButtonElement;
  readonly toggleIcon: HTMLElement;
  readonly loop: HTMLButtonElement;
  readonly speed: HTMLSelectElement;
}

function createButton(doc: Document, role: string, icon: string): { button: HTMLButtonElement; icon: HTMLElement } {
  const button = doc.createElement('button');
  button.type = 'button';
  button.classList.add('jt-toolbar__button', `${PLAYBACK_CONTROLS_CLASS}__${role}`);
  button.dataset.playback = role;
  const iconElement = doc.createElement('span');
  iconElement.classList.add('jt-toolbar__icon');
  iconElement.setAttribute('aria-hidden', 'true');
  iconElement.textContent = icon;
  button.appendChild(iconElement);
  return { button, icon: iconElement };
}

function speedOption(doc: Document, speed: number): HTMLOptionElement {
  const option = doc.createElement('option');
  option.value = String(speed);
  option.textContent = formatSpeed(speed);
  return option;
}

/** Plugin `playback.controls` : lire, pause, boucle et vitesse dans la barre d'outils. */
export class PlaybackControlsPlugin implements EditorPlugin {
  readonly id = 'playback.controls';
  readonly dependencies: readonly string[] = ['playback', 'toolbar.main', 'interaction.shortcuts'];

  private playback: IEditorPlayback | null = null;
  private toggleKeys = PLAYBACK_TOGGLE_KEYS;
  private view: IControlsView | null = null;
  private cleanups: Array<() => void> = [];

  readonly init = (ctx: IEditorContext): void => {
    const shortcuts = ctx.services.require('interaction.shortcuts');
    const update = (): void => this.update();
    const cleanups: Array<() => void> = [];
    this.playback = ctx.playback;
    this.toggleKeys = shortcuts.format(PLAYBACK_TOGGLE_KEYS);
    try {
      cleanups.push(ctx.events.on('playback:play', update));
      cleanups.push(ctx.events.on('playback:pause', update));
      cleanups.push(ctx.events.on('playback:loop', update));
      cleanups.push(ctx.events.on('playback:complete', update));
      cleanups.push(ctx.events.on('playhead:changed', update));
      cleanups.push(
        shortcuts.register({
          id: PLAYBACK_TOGGLE_SHORTCUT_ID,
          keys: PLAYBACK_TOGGLE_KEYS,
          label: 'Lire / Pause',
          run: (event) => {
            // `false` : touche laissée au navigateur, qui active le bouton ou le lien.
            if (isEnterActivated(event.target)) return false;
            // Touche maintenue : une seule bascule, et pas de `shortcut:triggered`
            // par répétition. La répétition reste consommée : l'hôte ne la voit
            // pas comme une touche Entrée libre.
            if (event.repeat) {
              event.preventDefault();
              return false;
            }
            ctx.playback.toggle();
            return true;
          }
        })
      );
      cleanups.push(
        ctx.services.require('toolbar.main').addControl({
          id: PLAYBACK_CONTROLS_PLUGIN_ID,
          label: 'Lecture',
          group: 'playback',
          order: ToolbarGroupOrders.playback + 1,
          render: (element) => this.renderControls(element)
        })
      );
    } catch (error) {
      cleanups.forEach((cleanup) => cleanup());
      this.playback = null;
      throw error;
    }
    this.cleanups = cleanups;
  };

  destroy(): void {
    const cleanups = this.cleanups;
    this.cleanups = [];
    cleanups.forEach((cleanup) => cleanup());
    this.view = null;
    this.playback = null;
  }

  private renderControls(element: HTMLElement): () => void {
    const playback = this.requirePlayback();
    const doc = element.ownerDocument;
    element.classList.add(PLAYBACK_CONTROLS_CLASS);
    const toggle = createButton(doc, 'toggle', '▶');
    const loop = createButton(doc, 'loop', '⟳');
    loop.button.setAttribute('aria-label', 'Boucle');
    loop.button.title = 'Boucle';
    const speed = doc.createElement('select');
    speed.classList.add(`${PLAYBACK_CONTROLS_CLASS}__speed`);
    speed.setAttribute('aria-label', 'Vitesse de lecture');
    speed.title = 'Vitesse de lecture';
    PLAYBACK_SPEEDS.forEach((value) => speed.appendChild(speedOption(doc, value)));
    element.append(toggle.button, loop.button, speed);

    const onToggle = (): void => playback.toggle();
    const onLoop = (): void => {
      try {
        playback.loop = !playback.loop;
      } finally {
        this.update();
      }
    };
    const onSpeed = (): void => {
      try {
        playback.speed = Number(speed.value);
      } finally {
        this.update();
      }
    };
    toggle.button.addEventListener('click', onToggle);
    loop.button.addEventListener('click', onLoop);
    speed.addEventListener('change', onSpeed);
    this.view = { toggle: toggle.button, toggleIcon: toggle.icon, loop: loop.button, speed };
    this.update();
    return () => {
      toggle.button.removeEventListener('click', onToggle);
      loop.button.removeEventListener('click', onLoop);
      speed.removeEventListener('change', onSpeed);
      this.view = null;
    };
  }

  /** Recopie l'état de la lecture dans les contrôles (icône, boucle, vitesse). */
  private update(): void {
    const view = this.view;
    const playback = this.playback;
    if (view === null || playback === null) return;
    const label = playback.playing ? 'Pause' : 'Lire';
    view.toggle.setAttribute('aria-label', label);
    view.toggle.title = `${label} (${this.toggleKeys})`;
    view.toggleIcon.textContent = playback.playing ? '❚❚' : '▶';
    view.toggle.classList.toggle(`${PLAYBACK_CONTROLS_CLASS}__toggle--playing`, playback.playing);
    view.loop.setAttribute('aria-pressed', String(playback.loop));
    const speed = String(playback.speed);
    const options = Array.from(view.speed.options);
    if (!options.some((option) => option.value === speed)) {
      // Vitesse fixée ailleurs : nouvelle option rangée à sa place.
      const next = options.find((option) => Number(option.value) > playback.speed) ?? null;
      view.speed.insertBefore(speedOption(view.speed.ownerDocument, playback.speed), next);
    }
    view.speed.value = speed;
  }

  private requirePlayback(): IEditorPlayback {
    if (this.playback === null) throw new Error("playback.controls : le plugin n'est pas initialisé.");
    return this.playback;
  }
}

/** Crée le plugin `playback.controls`. */
export function createPlaybackControlsPlugin(): PlaybackControlsPlugin {
  return new PlaybackControlsPlugin();
}
