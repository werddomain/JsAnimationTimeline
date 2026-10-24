// packages/editor/src/core/stage/editorHtmlStage.ts
/**
 * Scène HTML pour l'éditeur : `createHtmlStage` du runtime en mode `frame`
 * (styles en ligne, rien à reconstruire pendant un glisser), qui ne touche ni
 * ne propose jamais l'éditeur :
 * - le conteneur donné à `createEditor()` lui-même (un `<div id="timeline">`
 *   ne bouge pas sous un sélecteur `div`) ;
 * - tout le sous-arbre de l'éditeur (enfant `.JsTimeLine` du conteneur).
 * Les autres enfants du conteneur restent des cibles : il peut aussi contenir
 * la scène du développeur.
 *
 * Un sélecteur prend le premier élément qui correspond hors de l'éditeur ; il
 * est résolu ici puis passé à la scène sous la forme `{ element }`, pour que la
 * scène garde la sauvegarde de ses styles. Les cibles `{ ref, stage: 'html' }`
 * passent telles quelles : une ref désigne un élément choisi exprès.
 *
 * C'est la scène par défaut de l'éditeur ; elle sert aussi à combiner la scène
 * HTML avec d'autres (`stage: [createEditorHtmlStage(el), canvasStage]`).
 */

import { createHtmlStage, isRefTarget, isSelectorTarget, TARGET_ATTRIBUTE } from '@werddomain/timeline-runtime';
import type { HtmlStageRefs, IHtmlStage, ITargetInfo, LayerTarget } from '@werddomain/timeline-runtime';

/** Classe de l'élément racine de l'éditeur (même valeur que `EDITOR_ROOT_CLASS`). */
const EDITOR_ROOT_CLASS = 'JsTimeLine';

/** Options de `createEditorHtmlStage`. */
export interface IEditorHtmlStageOptions {
  /** Où chercher les cibles. Par défaut : le document du conteneur. */
  readonly root?: ParentNode;
  /** Éléments des cibles `{ ref, stage: 'html' }`, par ref. */
  readonly refs?: HtmlStageRefs;
}

/** Vrai pour le conteneur lui-même et pour le sous-arbre de l'éditeur qu'il contient. */
function createExclusion(container: Element): (element: Element) => boolean {
  return (element) => {
    if (element === container) return true;
    const editorRoot = element.closest(`.${EDITOR_ROOT_CLASS}`);
    return editorRoot !== null && editorRoot.parentElement === container;
  };
}

/** Premier élément de `selector` hors de l'éditeur ; `null` s'il n'y en a pas ou si le sélecteur est invalide. */
function queryOutside(root: ParentNode, selector: string, excluded: (element: Element) => boolean): Element | null {
  try {
    return Array.from(root.querySelectorAll(selector)).find((element) => !excluded(element)) ?? null;
  } catch {
    return null;
  }
}

/** Vrai si `info` désigne l'éditeur : le conteneur (id ou attribut de cible) ou un élément de son sous-arbre. */
function namesEditor(info: ITargetInfo, root: ParentNode, excluded: (element: Element) => boolean): boolean {
  const target = info.target;
  if (isSelectorTarget(target)) return queryOutside(root, target.selector, excluded) === null;
  if (isRefTarget(target)) {
    const marked = root.querySelectorAll(`[${TARGET_ATTRIBUTE}]`);
    const owners = Array.from(marked).filter((element) => element.getAttribute(TARGET_ATTRIBUTE) === target.ref);
    return owners.length > 0 && owners.every(excluded);
  }
  return false;
}

/**
 * Scène HTML en mode `frame` qui n'anime jamais `container` ni l'éditeur
 * qu'il contient (voir le commentaire du module).
 */
export function createEditorHtmlStage(container: Element, options: IEditorHtmlStageOptions = {}): IHtmlStage {
  const root = options.root ?? container.ownerDocument;
  const excluded = createExclusion(container);
  const inner = createHtmlStage({ root, mode: 'frame', refs: options.refs });
  return {
    ...inner,
    targets: {
      ...inner.targets,
      list: () => inner.targets.list().filter((info) => !namesEditor(info, root, excluded)),
      describe: (target) =>
        (isSelectorTarget(target) && queryOutside(root, target.selector, excluded) === null
          ? undefined
          : inner.targets.describe?.(target))
    },
    resolve(target: LayerTarget): Element | null {
      if (!isSelectorTarget(target)) return inner.resolve(target);
      const element = queryOutside(root, target.selector, excluded);
      return element === null ? null : inner.resolve({ element });
    },
    bind: (ref, element) => inner.bind(ref, element)
  };
}
