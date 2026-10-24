// packages/editor/src/plugins/layout/shell/layoutSlots.ts
/**
 * Contrat des emplacements de rendu de la coquille (`layout.shell`).
 *
 * La coquille ne contient que la timeline : elle n'a jamais de zone de
 * scène. La scène (HTML, canvas, audio...) reste au développeur, en dehors
 * de l'éditeur.
 *
 * Disposition (grille CSS) :
 *
 * ```
 * ┌───────────────────────────────────────────────┐
 * │ toolbar                                       │
 * ├──────────────┬────────────────────────────────┤
 * │ layersHeader │ ruler          (défile en X)   │
 * ├──────────────┼────────────────────────────────┤
 * │ layers       │ frames         (défile en X/Y) │
 * │ (défile en Y)│                                │
 * ├──────────────┼────────────────────────────────┤
 * │ layersFooter │ framesFooter                   │
 * └──────────────┴────────────────────────────────┘
 * ```
 *
 * Les quatre zones principales sont `toolbar`, `layers`, `ruler` et
 * `frames`. Les trois cellules d'appoint (`layersHeader`, `layersFooter`,
 * `framesFooter`) ne défilent jamais : en-tête des colonnes de calques
 * (œil, cadenas...), boutons des calques et barre d'état.
 *
 * Seule la zone `frames` a des barres de défilement. `ruler` et `layers`
 * masquent leur débordement : `layout.scrollSync` recopie la position de
 * `frames` dans ces deux zones.
 */

/** Nom court d'une zone de la coquille. */
export type LayoutZone =
  | 'toolbar'
  | 'layersHeader'
  | 'ruler'
  | 'layers'
  | 'frames'
  | 'layersFooter'
  | 'framesFooter';

/** Nom de l'emplacement de rendu de chaque zone (à passer dans `slot` d'un plugin). */
export const LAYOUT_SLOTS: Readonly<Record<LayoutZone, string>> = Object.freeze({
  toolbar: 'layout.toolbar',
  layersHeader: 'layout.layersHeader',
  ruler: 'layout.ruler',
  layers: 'layout.layers',
  frames: 'layout.frames',
  layersFooter: 'layout.layersFooter',
  framesFooter: 'layout.framesFooter'
});

/** Zones dans l'ordre du DOM (ordre de lecture : ligne par ligne, de gauche à droite). */
export const LAYOUT_ZONES: readonly LayoutZone[] = Object.freeze([
  'toolbar',
  'layersHeader',
  'ruler',
  'layers',
  'frames',
  'layersFooter',
  'framesFooter'
]);

/** Classe de l'élément de la coquille (la grille). */
export const SHELL_CLASS = 'jt-shell';

/** Classe commune à toutes les zones ; chaque zone ajoute `jt-zone--<zone>`. */
export const ZONE_CLASS = 'jt-zone';

/** Libellés accessibles des zones (texte visible par l'utilisateur : en français). */
export const ZONE_LABELS: Readonly<Record<LayoutZone, string>> = Object.freeze({
  toolbar: "Barre d'outils de la timeline",
  layersHeader: 'En-tête des calques',
  ruler: 'Règle des images',
  layers: 'Calques',
  frames: 'Images',
  layersFooter: 'Outils des calques',
  framesFooter: "Barre d'état"
});
