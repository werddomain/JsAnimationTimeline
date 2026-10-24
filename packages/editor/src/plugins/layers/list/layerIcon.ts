// packages/editor/src/plugins/layers/list/layerIcon.ts
/**
 * Icône d'une ligne. Le champ `icon` d'un calque est un nom d'icône intégrée,
 * une classe CSS ou une URL d'image ; sans `icon`, la ligne prend l'icône de
 * son type (calque, dossier ouvert ou fermé). L'icône ne dit rien de la cible
 * animée : la liste ne suppose aucune scène.
 */

import { isFolder, resolveCollapsed } from '@werddomain/timeline-runtime';
import type { LayerNode } from '@werddomain/timeline-runtime';

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

const URL_PATTERN = /^(https?:\/\/|data:image\/|blob:|\.{0,2}\/)/i;
const CSS_CLASSES_PATTERN = /^-?[_a-zA-Z][_a-zA-Z0-9-]*(\s+-?[_a-zA-Z][_a-zA-Z0-9-]*)*$/;

/** Nature d'une valeur d'icône. */
export type LayerIconKind = 'builtin' | 'url' | 'class' | 'invalid';

/** Classe une valeur d'icône : intégrée, URL (http, https, data:image, blob, chemin), classes CSS, ou invalide. */
export function classifyLayerIcon(icon: string): LayerIconKind {
  const value = icon.trim();
  if (Object.prototype.hasOwnProperty.call(BUILTIN_LAYER_ICONS, value)) return 'builtin';
  if (URL_PATTERN.test(value)) return 'url';
  if (CSS_CLASSES_PATTERN.test(value)) return 'class';
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

/** Remplace le contenu de `element` par l'icône du nœud. */
export function renderLayerIcon(node: LayerNode, element: HTMLElement): void {
  const icon = effectiveLayerIcon(node);
  if (element.dataset.icon === icon) return;
  element.dataset.icon = icon;
  element.className = LAYER_ICON_CLASS;
  element.replaceChildren();
  element.setAttribute('aria-hidden', 'true');
  switch (classifyLayerIcon(icon)) {
    case 'builtin':
      element.classList.add(`${LAYER_ICON_CLASS}--${icon}`);
      element.textContent = BUILTIN_LAYER_ICONS[icon] ?? '';
      break;
    case 'url': {
      const image = element.ownerDocument.createElement('img');
      image.src = icon;
      image.alt = '';
      image.draggable = false;
      element.appendChild(image);
      break;
    }
    default:
      element.classList.add(...icon.split(/\s+/));
  }
}
