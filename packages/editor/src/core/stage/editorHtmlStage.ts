// packages/editor/src/core/stage/editorHtmlStage.ts
import { createHtmlStage } from '@kazo-ca/timeline-runtime';
import type { HtmlStageRefs, IHtmlStage, IHtmlAnimationContext } from '@kazo-ca/timeline-runtime';

const EDITOR_ROOT_CLASS = 'JsTimeLine';

export interface IEditorHtmlStageOptions {
  readonly root?: ParentNode;
  readonly refs?: HtmlStageRefs;
  readonly animationContext?: IHtmlAnimationContext;
}

/** Every selector match is filtered, preserving groups without targeting editor UI or ancestors. */
export function createEditorHtmlStage(container: Element, options: IEditorHtmlStageOptions = {}): IHtmlStage {
  return createHtmlStage({ ...options, root: options.root ?? container.ownerDocument, mode: 'frame',
    excludeElement: (element) => element.contains(container) || Array.from(container.children).some(
      (child) => child.classList.contains(EDITOR_ROOT_CLASS) && child.contains(element)
    )
  });
}
