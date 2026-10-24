// packages/editor/src/plugins/layers/reorder/moveAnnouncement.ts
/**
 * Texte annoncé (zone `aria-live`) après un déplacement au clavier, en
 * français : « Héros » déplacé : position 2 sur 5, ou dans « Dossier 1 ».
 */

import { findNodeById } from '@werddomain/timeline-runtime';
import type { ITimelineDocument } from '@werddomain/timeline-runtime';
import { childrenOf, findNodeLocation, topMostIds } from './treeMoves';

/** Phrase décrivant la place des nœuds `ids` dans `doc` (après le déplacement) ; vide si aucun n'existe. */
export function describeMove(doc: ITimelineDocument, ids: readonly string[]): string {
  const top = topMostIds(doc.layers, ids);
  const first = top[0];
  if (first === undefined) return '';
  const location = findNodeLocation(doc.layers, first);
  const node = findNodeById(doc.layers, first);
  if (location === undefined || node === undefined) return '';
  const total = childrenOf(doc.layers, location.parentId)?.length ?? 0;
  const parent = location.parentId === undefined ? undefined : findNodeById(doc.layers, location.parentId);
  const subject = top.length === 1 ? `« ${node.name} » déplacé` : `${top.length} calques déplacés`;
  const where = parent === undefined ? '' : ` dans « ${parent.name} »`;
  return `${subject}${where} : position ${location.index + 1} sur ${total}`;
}
