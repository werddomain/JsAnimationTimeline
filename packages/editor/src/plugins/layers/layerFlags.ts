// packages/editor/src/plugins/layers/layerFlags.ts
/**
 * Commandes annulables sur les drapeaux `visible` et `locked` des nœuds,
 * partagées par `layers.visibility` et `layers.lock` : un nœud (calque ou
 * dossier, à toute profondeur) ou tous les nœuds de premier niveau d'un coup.
 *
 * Les drapeaux ne sont que des données de l'éditeur : rien ici ne touche une
 * scène ou une cible. L'annulation rend à chaque nœud la valeur d'origine du
 * champ, y compris son absence (le nœud retrouvé est égal en profondeur à
 * l'original).
 */

import { findNodeById, resolveLocked, resolveVisible } from '@werddomain/timeline-runtime';
import type { ITimelineDocument, LayerNode } from '@werddomain/timeline-runtime';
import { createCommand } from '../../core/commands/createCommand';
import type { ICommand } from '../../core/commands/ICommand';
import { updateLayerNode } from './list/layerTree';

/** Un drapeau booléen d'un nœud : lecture brute, valeur effective et écriture immuable. */
export interface ILayerFlag {
  /** Valeur brute du champ (`undefined` s'il est absent). */
  readonly raw: (node: LayerNode) => boolean | undefined;
  /** Valeur effective (le défaut du modèle quand le champ est absent). */
  readonly resolve: (node: LayerNode) => boolean;
  /** Nœud avec le champ donné ; le champ est retiré pour `undefined`. Même nœud si rien ne change. */
  readonly write: (node: LayerNode, value: boolean | undefined) => LayerNode;
}

/** Drapeau `visible`. */
export const VISIBLE_FLAG: ILayerFlag = {
  raw: (node) => node.visible,
  resolve: resolveVisible,
  write: (node, value) => {
    if (node.visible === value) return node;
    if (value !== undefined) return { ...node, visible: value };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- retire le champ pour rendre le nœud d'origine
    const { visible: _removed, ...rest } = node;
    return rest;
  }
};

/** Drapeau `locked`. */
export const LOCKED_FLAG: ILayerFlag = {
  raw: (node) => node.locked,
  resolve: resolveLocked,
  write: (node, value) => {
    if (node.locked === value) return node;
    if (value !== undefined) return { ...node, locked: value };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- retire le champ pour rendre le nœud d'origine
    const { locked: _removed, ...rest } = node;
    return rest;
  }
};

/**
 * Commande qui donne la valeur `value` au drapeau du nœud `id`. Sans effet
 * (même document) si la valeur effective est déjà `value`.
 *
 * @throws Error si `id` ne désigne aucun nœud du document.
 */
export function createSetFlagCommand(
  doc: ITimelineDocument,
  flag: ILayerFlag,
  id: string,
  value: boolean,
  label: string
): ICommand {
  const node = findNodeById(doc.layers, id);
  if (node === undefined) throw new Error(`layers : le nœud « ${id} » est introuvable.`);
  const original = flag.raw(node);
  return createCommand(
    label,
    (current) =>
      updateLayerNode(current, id, (target) => (flag.resolve(target) === value ? target : flag.write(target, value))),
    (current) => updateLayerNode(current, id, (target) => flag.write(target, original))
  );
}

/** Valeur à donner au drapeau par le bouton d'en-tête : tout à vrai s'il en manque un, sinon tout à faux. */
export function nextAllValue(doc: ITimelineDocument, flag: ILayerFlag): boolean {
  return !allSet(doc, flag);
}

/** Vrai si tous les nœuds de premier niveau (au moins un) ont le drapeau à vrai. */
export function allSet(doc: ITimelineDocument, flag: ILayerFlag): boolean {
  return doc.layers.length > 0 && doc.layers.every((node) => flag.resolve(node));
}

/**
 * Commande qui donne la valeur `value` au drapeau de tous les nœuds de
 * premier niveau (une seule entrée d'historique). Les nœuds qui l'ont déjà
 * sont laissés tels quels ; sans aucun changement, la commande rend le même
 * document.
 */
export function createSetAllFlagCommand(
  doc: ITimelineDocument,
  flag: ILayerFlag,
  value: boolean,
  label: string
): ICommand {
  const originals = new Map<string, boolean | undefined>();
  doc.layers.forEach((node) => {
    if (flag.resolve(node) !== value) originals.set(node.id, flag.raw(node));
  });
  const mapLayers = (current: ITimelineDocument, next: (node: LayerNode) => LayerNode): ITimelineDocument => {
    const layers = current.layers.map(next);
    return layers.some((node, index) => node !== current.layers[index]) ? { ...current, layers } : current;
  };
  return createCommand(
    label,
    (current) => mapLayers(current, (node) => (flag.resolve(node) === value ? node : flag.write(node, value))),
    (current) => mapLayers(current, (node) => (originals.has(node.id) ? flag.write(node, originals.get(node.id)) : node))
  );
}
