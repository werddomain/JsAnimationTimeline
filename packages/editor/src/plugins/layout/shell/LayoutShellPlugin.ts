// packages/editor/src/plugins/layout/shell/LayoutShellPlugin.ts
/**
 * Plugin : layout.shell
 * Epic : layout
 * Dépend de : layout
 * Écoute : —
 * Émet : —
 *
 * Coquille de la timeline : une grille de zones (barre d'outils, calques,
 * règle, images et cellules d'appoint), chacune définie comme emplacement de
 * rendu nommé (`LAYOUT_SLOTS`). Les autres plugins dessinent dans ces
 * emplacements en déclarant `slot: LAYOUT_SLOTS.<zone>` et en dépendant de
 * `layout.shell`.
 *
 * La coquille ne suppose aucune scène ni cible HTML : elle ne contient que
 * la timeline. Elle publie le service `layout.shell` (éléments des zones),
 * disponible une fois son rendu fait.
 */

import type { EditorPlugin, IEditorContext } from '../../../core/context/IEditorContext';
import {
  LAYOUT_SLOTS,
  LAYOUT_ZONES,
  SHELL_CLASS,
  ZONE_CLASS,
  ZONE_LABELS
} from './layoutSlots';
import type { LayoutZone } from './layoutSlots';
import './LayoutShell.less';

/** API publiée sous le service `layout.shell`. */
export interface ILayoutShellApi {
  /** Élément de la grille, ou `undefined` avant le rendu et après la destruction. */
  readonly element: () => HTMLElement | undefined;
  /** Élément de la zone `zone`, ou `undefined` avant le rendu et après la destruction. */
  readonly zone: (zone: LayoutZone) => HTMLElement | undefined;
}

declare module '../../../core/context/IEditorContext' {
  interface EditorServiceMap {
    'layout.shell': ILayoutShellApi;
  }
}

/** Crée l'élément d'une zone (classes, attribut `data-zone`, rôle et libellé accessibles). */
function createZone(doc: Document, zone: LayoutZone): HTMLElement {
  const element = doc.createElement('div');
  element.classList.add(ZONE_CLASS, `${ZONE_CLASS}--${zone}`);
  element.dataset.zone = zone;
  element.setAttribute('role', zone === 'toolbar' ? 'toolbar' : 'group');
  element.setAttribute('aria-label', ZONE_LABELS[zone]);
  return element;
}

/** Coquille de la timeline : grille de zones exposées comme emplacements de rendu. */
export class LayoutShellPlugin implements EditorPlugin {
  readonly id = 'layout.shell';
  readonly dependencies: readonly string[] = ['layout'];

  private ctx: IEditorContext | undefined;
  private shell: HTMLElement | undefined;
  private zones: Partial<Record<LayoutZone, HTMLElement>> = {};
  private cleanups: Array<() => void> = [];

  readonly init = (ctx: IEditorContext): void => {
    this.ctx = ctx;
    const removeService = ctx.services.provide('layout.shell', {
      element: () => this.shell,
      zone: (zone) => this.zones[zone]
    });
    this.cleanups = [removeService];
  };

  render(slot: HTMLElement): void {
    const ctx = this.requireContext();
    const shell = slot.ownerDocument.createElement('div');
    shell.classList.add(SHELL_CLASS);
    const zones: Partial<Record<LayoutZone, HTMLElement>> = {};
    for (const zone of LAYOUT_ZONES) {
      const element = createZone(slot.ownerDocument, zone);
      shell.appendChild(element);
      zones[zone] = element;
    }
    slot.appendChild(shell);
    this.shell = shell;
    this.zones = zones;
    for (const zone of LAYOUT_ZONES) {
      const element = zones[zone];
      if (element !== undefined) this.cleanups.push(ctx.slots.define(LAYOUT_SLOTS[zone], element));
    }
  }

  destroy(): void {
    const cleanups = this.cleanups;
    this.cleanups = [];
    cleanups.forEach((cleanup) => cleanup());
    this.shell?.remove();
    this.shell = undefined;
    this.zones = {};
    this.ctx = undefined;
  }

  private requireContext(): IEditorContext {
    if (this.ctx === undefined) throw new Error('layout.shell : render appelé avant init.');
    return this.ctx;
  }
}
