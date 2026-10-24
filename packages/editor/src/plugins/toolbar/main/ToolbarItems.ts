// packages/editor/src/plugins/toolbar/main/ToolbarItems.ts
/**
 * Registre des éléments de la barre d'outils, sans DOM : validation des
 * définitions, unicité des identifiants et ordre d'affichage (groupes, puis
 * rang dans le groupe, puis ordre d'ajout).
 */

import { ToolbarError } from './ToolbarError';
import type {
  IToolbarButtonDefinition,
  IToolbarControlDefinition,
  IToolbarItemDefinition,
  IToolbarItemInfo
} from './types';

/** Groupe des éléments ajoutés sans `group`. */
export const DEFAULT_TOOLBAR_GROUP = 'main';

/**
 * Rangs de départ des groupes des plugins de la barre. `order` est global :
 * un groupe se place par le plus petit rang de ses éléments. Chaque plugin
 * range ses éléments à partir du rang de son groupe
 * (`ToolbarGroupOrders.history + 1`...), pour que l'ordre des groupes ne
 * dépende pas de l'ordre d'initialisation des plugins.
 */
export const ToolbarGroupOrders = Object.freeze({
  keyframes: 100,
  history: 200,
  time: 300,
  playback: 400,
  zoom: 500
});

/** Élément enregistré : sa définition, sa description et son rang d'ajout. */
export type ToolbarEntry =
  | { readonly kind: 'button'; readonly definition: IToolbarButtonDefinition; readonly info: IToolbarItemInfo; readonly seq: number }
  | { readonly kind: 'control'; readonly definition: IToolbarControlDefinition; readonly info: IToolbarItemInfo; readonly seq: number };

/** Un groupe et ses éléments, dans l'ordre d'affichage. */
export interface IToolbarGroupLayout {
  readonly group: string;
  readonly entries: readonly ToolbarEntry[];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

/** Vérifie les champs communs ; lève `invalid-definition` avec un message français. */
function checkCommon(definition: IToolbarItemDefinition): void {
  const id = isNonEmptyString(definition.id) ? definition.id : undefined;
  const fail = (detail: string): never => {
    throw new ToolbarError('invalid-definition', `Élément de barre d'outils invalide : ${detail}.`, id);
  };
  if (id === undefined) fail("l'identifiant doit être une chaîne non vide");
  if (!isNonEmptyString(definition.label)) fail(`le libellé de « ${id} » doit être une chaîne non vide`);
  if (definition.group !== undefined && !isNonEmptyString(definition.group)) {
    fail(`le groupe de « ${id} » doit être une chaîne non vide`);
  }
  if (definition.order !== undefined && !Number.isFinite(definition.order)) {
    fail(`le rang de « ${id} » doit être un nombre fini`);
  }
}

function checkFunction(id: string, name: string, value: unknown, required: boolean): void {
  if (value === undefined && !required) return;
  if (typeof value !== 'function') {
    throw new ToolbarError('invalid-definition', `Élément de barre d'outils invalide : « ${name} » de « ${id} » doit être une fonction.`, id);
  }
}

function infoOf(definition: IToolbarItemDefinition, kind: IToolbarItemInfo['kind']): IToolbarItemInfo {
  return Object.freeze({
    id: definition.id,
    kind,
    label: definition.label,
    group: definition.group ?? DEFAULT_TOOLBAR_GROUP,
    order: definition.order ?? 0
  });
}

function byOrder(a: ToolbarEntry, b: ToolbarEntry): number {
  return a.info.order - b.info.order || a.seq - b.seq;
}

/** Registre des éléments de la barre d'outils. */
export class ToolbarItems {
  private readonly entries = new Map<string, ToolbarEntry>();
  private nextSeq = 0;

  /** Valide et enregistre un bouton. */
  addButton(definition: IToolbarButtonDefinition): ToolbarEntry {
    checkCommon(definition);
    checkFunction(definition.id, 'onClick', definition.onClick, true);
    checkFunction(definition.id, 'enabled', definition.enabled, false);
    if (definition.icon !== undefined && !isNonEmptyString(definition.icon)) {
      throw new ToolbarError('invalid-definition', `Élément de barre d'outils invalide : l'icône de « ${definition.id} » doit être une chaîne non vide.`, definition.id);
    }
    return this.store({ kind: 'button', definition, info: infoOf(definition, 'button'), seq: this.takeSeq() });
  }

  /** Valide et enregistre un contrôle libre. */
  addControl(definition: IToolbarControlDefinition): ToolbarEntry {
    checkCommon(definition);
    checkFunction(definition.id, 'render', definition.render, true);
    return this.store({ kind: 'control', definition, info: infoOf(definition, 'control'), seq: this.takeSeq() });
  }

  /** Retire `entry` ; `false` s'il n'était plus enregistré. */
  remove(entry: ToolbarEntry): boolean {
    if (this.entries.get(entry.info.id) !== entry) return false;
    this.entries.delete(entry.info.id);
    return true;
  }

  /** Vrai si `entry` est toujours enregistré. */
  has(entry: ToolbarEntry): boolean {
    return this.entries.get(entry.info.id) === entry;
  }

  /** Éléments par groupe, dans l'ordre d'affichage. */
  layout(): readonly IToolbarGroupLayout[] {
    const groups = new Map<string, ToolbarEntry[]>();
    Array.from(this.entries.values())
      .sort(byOrder)
      .forEach((entry) => {
        const list = groups.get(entry.info.group);
        if (list === undefined) groups.set(entry.info.group, [entry]);
        else list.push(entry);
      });
    // Les éléments étant triés, le premier de chaque groupe porte son rang.
    return Array.from(groups.entries())
      .map(([group, entries]) => ({ group, entries }))
      .sort((a, b) => byOrder(a.entries[0], b.entries[0]));
  }

  /** Descriptions des éléments, dans l'ordre d'affichage. */
  list(): readonly IToolbarItemInfo[] {
    const infos: IToolbarItemInfo[] = [];
    this.layout().forEach(({ entries }) => entries.forEach((entry) => infos.push(entry.info)));
    return infos;
  }

  /** Tous les éléments enregistrés (ordre d'ajout). */
  all(): readonly ToolbarEntry[] {
    return Array.from(this.entries.values());
  }

  /** Vide le registre. */
  clear(): void {
    this.entries.clear();
  }

  private takeSeq(): number {
    const seq = this.nextSeq;
    this.nextSeq += 1;
    return seq;
  }

  private store(entry: ToolbarEntry): ToolbarEntry {
    const { id } = entry.info;
    if (this.entries.has(id)) {
      throw new ToolbarError('duplicate-id', `L'élément de barre d'outils « ${id} » existe déjà.`, id);
    }
    this.entries.set(id, entry);
    return entry;
  }
}
