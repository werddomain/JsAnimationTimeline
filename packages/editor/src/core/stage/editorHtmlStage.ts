// packages/editor/src/core/stage/editorHtmlStage.ts
/**
 * Scène HTML pour l'éditeur : `createHtmlStage` du runtime en mode `frame`
 * (styles en ligne, rien à reconstruire pendant un glisser), qui ne touche ni
 * ne propose jamais l'éditeur :
 * - le conteneur donné à `createEditor()` lui-même (un `<div id="timeline">`
 *   ne bouge pas sous un sélecteur `div`) ;
 * - tout le sous-arbre de l'éditeur (enfant `.JsTimeLine` direct du conteneur).
 * Les autres enfants du conteneur restent des cibles : il peut aussi contenir
 * la scène du développeur.
 *
 * Un sélecteur prend le premier élément qui correspond hors de l'éditeur ; il
 * est résolu ici puis passé à la scène sous la forme `{ element }`, pour que la
 * scène garde la sauvegarde de ses styles. Une ref (table `refs`, `bind`, ou
 * attribut `data-timeline-target`) ou un `{ element }` qui désigne l'éditeur ne
 * se résout pas non plus. `resolve`, `targets.list()` et `targets.describe()`
 * suivent la même règle.
 *
 * C'est la scène par défaut de l'éditeur ; elle sert aussi à combiner la scène
 * HTML avec d'autres (`stage: [createEditorHtmlStage(el), canvasStage]`).
 */

import {
  createHtmlStage,
  isElementTarget,
  isRefTarget,
  isSelectorTarget,
  TARGET_ATTRIBUTE
} from '@werddomain/timeline-runtime';
import type { HtmlStageRefs, IHtmlStage, ITargetInfo, LayerTarget } from '@werddomain/timeline-runtime';

/**
 * Classe de l'élément racine de l'éditeur. Même valeur que `EDITOR_ROOT_CLASS`
 * (`core/editor/createEditor.ts`), recopiée pour ne pas créer d'import
 * circulaire avec `createEditor`.
 */
const EDITOR_ROOT_CLASS = 'JsTimeLine';

/** Options de `createEditorHtmlStage`. */
export interface IEditorHtmlStageOptions {
  /** Où chercher les cibles. Par défaut : le document du conteneur. */
  readonly root?: ParentNode;
  /** Éléments des cibles `{ ref, stage: 'html' }`, par ref. */
  readonly refs?: HtmlStageRefs;
}

/** Vrai pour le conteneur lui-même et pour tout élément du sous-arbre de l'éditeur. */
function createExclusion(container: Element): (element: Element) => boolean {
  return (element) => {
    if (element === container) return true;
    return Array.from(container.children).some(
      (child) => child.classList.contains(EDITOR_ROOT_CLASS) && child.contains(element)
    );
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

function initialRefs(refs: HtmlStageRefs | undefined): Map<string, Element> {
  if (refs === undefined) return new Map();
  return refs instanceof Map ? new Map(refs) : new Map(Object.entries(refs));
}

/**
 * Scène HTML en mode `frame` qui n'anime jamais `container` ni l'éditeur
 * qu'il contient (voir le commentaire du module).
 */
export function createEditorHtmlStage(container: Element, options: IEditorHtmlStageOptions = {}): IHtmlStage {
  const root = options.root ?? container.ownerDocument;
  const excluded = createExclusion(container);
  const inner = createHtmlStage({ root, mode: 'frame', refs: options.refs });
  // Copie de la table des refs de la scène, pour savoir quel élément une ref désigne.
  const refs = initialRefs(options.refs);

  const elementOfRef = (ref: string): Element | null => {
    const bound = refs.get(ref);
    if (bound !== undefined) return bound;
    const marked = Array.from(root.querySelectorAll(`[${TARGET_ATTRIBUTE}]`));
    return marked.find((element) => element.getAttribute(TARGET_ATTRIBUTE) === ref) ?? null;
  };

  /**
   * Cible à passer à la scène : le premier élément hors de l'éditeur pour un
   * sélecteur, la cible telle quelle sinon ; `null` si elle désigne l'éditeur.
   */
  const toInner = (target: LayerTarget): LayerTarget | null => {
    if (isSelectorTarget(target)) {
      const element = queryOutside(root, target.selector, excluded);
      return element === null ? null : { element };
    }
    const element = isElementTarget(target) ? target.element : isRefTarget(target) ? elementOfRef(target.ref) : null;
    return element !== null && excluded(element) ? null : target;
  };

  return {
    ...inner,
    targets: {
      ...inner.targets,
      list: () => inner.targets.list().filter((info: ITargetInfo) => toInner(info.target) !== null),
      describe: (target) => {
        const resolved = toInner(target);
        if (resolved === null) return undefined;
        const info = inner.targets.describe?.(resolved);
        return info === undefined ? undefined : { ...info, target };
      }
    },
    resolve(target: LayerTarget): Element | null {
      const resolved = toInner(target);
      return resolved === null ? null : inner.resolve(resolved);
    },
    bind(ref: string, element: Element | null): void {
      if (element === null) refs.delete(ref);
      else refs.set(ref, element);
      inner.bind(ref, element);
    }
  };
}
