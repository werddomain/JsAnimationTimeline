// packages/editor/src/plugins/layers/icon/iconChoices.ts
/**
 * Entrées du menu d'icônes : les icônes intégrées, « Icône par défaut » et
 * « Personnalisée… ». Fonction pure : le menu (DOM) les affiche.
 */

import { BUILTIN_LAYER_ICONS } from '../list/layerIcon';

/** Textes du menu (en français). */
export const LAYER_ICON_TEXTS = Object.freeze({
  menuLabel: 'Icône du calque',
  dialogLabel: "Choisir l'icône",
  defaultIcon: 'Icône par défaut',
  custom: 'Personnalisée…',
  customLabel: 'URL ou classes CSS',
  apply: 'Appliquer'
});

/** Libellés français des icônes intégrées (nom -> texte du menu). */
export const BUILTIN_ICON_LABELS: Readonly<Record<string, string>> = Object.freeze({
  layer: 'Calque',
  folder: 'Dossier',
  folderOpen: 'Dossier ouvert',
  shape: 'Forme',
  image: 'Image',
  text: 'Texte',
  sprite: 'Sprite',
  audio: 'Audio',
  video: 'Vidéo',
  camera: 'Caméra',
  light: 'Lumière',
  group: 'Groupe'
});

/** Libellé français d'une icône intégrée (le nom lui-même si inconnu). */
export function builtinIconLabel(name: string): string {
  return BUILTIN_ICON_LABELS[name] ?? name;
}

/** Une entrée du menu. */
export type IconChoice =
  | { readonly kind: 'builtin'; readonly icon: string; readonly glyph: string; readonly current: boolean }
  | { readonly kind: 'default'; readonly current: boolean }
  | { readonly kind: 'custom'; readonly current: boolean };

/**
 * Entrées du menu pour un calque dont l'icône actuelle est `current`
 * (`undefined` : icône par défaut). Une icône actuelle qui n'est pas
 * intégrée marque « Personnalisée… ».
 */
export function iconChoices(current: string | undefined): readonly IconChoice[] {
  const builtin = Object.entries(BUILTIN_LAYER_ICONS)
    .map(([icon, glyph]): IconChoice => ({ kind: 'builtin', icon, glyph, current: current === icon }));
  const isCustom = current !== undefined && !Object.prototype.hasOwnProperty.call(BUILTIN_LAYER_ICONS, current);
  return [
    { kind: 'default', current: current === undefined },
    ...builtin,
    { kind: 'custom', current: isCustom }
  ];
}
