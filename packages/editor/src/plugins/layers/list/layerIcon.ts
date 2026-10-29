// packages/editor/src/plugins/layers/list/layerIcon.ts
/**
 * Icône d'une ligne. Le champ `icon` d'un calque est un nom d'icône intégrée,
 * une classe CSS ou une URL d'image ; sans `icon`, la ligne prend l'icône de
 * son type (calque, dossier ouvert ou fermé). L'icône ne dit rien de la cible
 * animée : la liste ne suppose aucune scène.
 *
 * La valeur vient du document (donnée de l'utilisateur) : seules les URL
 * http(s), `data:image/`, `blob:` et les chemins relatifs sont acceptées, et
 * une classe CSS ne peut pas commencer par `jt-` (classes internes de
 * l'éditeur). Toute autre valeur donne l'icône par défaut. Une URL http(s)
 * est chargée par le navigateur à l'affichage, comme toute image.
 */

import { isFolder, resolveCollapsed } from '@kazo-ca/timeline-runtime';
import type { LayerNode } from '@kazo-ca/timeline-runtime';

/** Icônes intégrées : nom -> caractère affiché. */
export const BUILTIN_LAYER_ICONS: Readonly<Record<string, string>> = Object.freeze({
  layer: '▤',
  folder: '📁',
  folderOpen: '📂',
  shape: '◆',
  image: '🖼',
  text: 'T',
  sprite: '👾',
  audio: '♪',
  video: '🎞',
  camera: '🎥',
  light: '💡',
  group: '❖'
});

/** Classe de base de l'icône ; une icône intégrée ajoute `jt-layer-icon--<nom>`. */
export const LAYER_ICON_CLASS = 'jt-layer-icon';

/** http(s), image en `data:`, `blob:`, chemin `./`, `../` ou absolu (mais pas `//hôte`). */
const URL_PATTERN = /^(https?:\/\/|data:image\/|blob:|\.{1,2}\/|\/(?!\/))/i;
const CSS_CLASS = '-?[_a-zA-Z][_a-zA-Z0-9-]*';
const CSS_CLASSES_PATTERN = new RegExp(`^${CSS_CLASS}(\\s+${CSS_CLASS})*$`);
const INTERNAL_CLASS_PATTERN = /(^|\s)jt-/;

/** Nature d'une valeur d'icône. */
export type LayerIconKind = 'builtin' | 'url' | 'class' | 'invalid';

/** Classe une valeur d'icône : intégrée, URL acceptée, classes CSS (hors `jt-*`), ou invalide. */
export function classifyLayerIcon(icon: string): LayerIconKind {
  const value = icon.trim();
  if (Object.prototype.hasOwnProperty.call(BUILTIN_LAYER_ICONS, value)) return 'builtin';
  if (URL_PATTERN.test(value)) return 'url';
  if (CSS_CLASSES_PATTERN.test(value) && !INTERNAL_CLASS_PATTERN.test(value)) return 'class';
  return 'invalid';
}

/** Nom de l'icône par défaut du nœud (selon son type et, pour un dossier, son état replié). */
export function defaultLayerIcon(node: LayerNode): string {
  if (!isFolder(node)) return 'layer';
  return resolveCollapsed(node) ? 'folder' : 'folderOpen';
}

/** Valeur d'icône effective du nœud : `icon` du calque, sinon l'icône par défaut. */
export function effectiveLayerIcon(node: LayerNode): string {
  const icon = isFolder(node) ? undefined : node.icon;
  return icon === undefined || classifyLayerIcon(icon) === 'invalid' ? defaultLayerIcon(node) : icon.trim();
}

/** Classes posées sur l'élément pour une icône. */
function iconClasses(icon: string, kind: LayerIconKind): string[] {
  if (kind === 'builtin') return [LAYER_ICON_CLASS, `${LAYER_ICON_CLASS}--${icon}`];
  if (kind === 'class') return [LAYER_ICON_CLASS, ...icon.split(/\s+/)];
  return [LAYER_ICON_CLASS];
}

/**
 * Remplace le contenu de `element` par l'icône du nœud. Seules les classes
 * posées par l'appel précédent sont retirées : les autres classes de
 * l'élément sont gardées.
 */
export function renderLayerIcon(node: LayerNode, element: HTMLElement): void {
  const icon = effectiveLayerIcon(node);
  if (element.dataset.icon === icon) return;
  const previous = element.dataset.iconClasses;
  if (previous !== undefined && previous !== '') element.classList.remove(...previous.split(' '));
  const kind = classifyLayerIcon(icon);
  const added = iconClasses(icon, kind);
  element.classList.add(...added);
  element.dataset.iconClasses = added.join(' ');
  element.dataset.icon = icon;
  element.setAttribute('aria-hidden', 'true');
  element.replaceChildren();
  if (kind === 'builtin') {
    element.textContent = BUILTIN_LAYER_ICONS[icon] ?? '';
  } else if (kind === 'url') {
    const image = element.ownerDocument.createElement('img');
    image.src = icon;
    image.alt = '';
    image.draggable = false;
    element.appendChild(image);
  }
}
