// packages/export-css/src/htmlTypes.ts
import type { IHtmlAnimationContext, PropertyRegistry } from '@kazo-ca/timeline-runtime';

/** Export against the source HTML scene, outside an active preview when supplied. */
export interface IExportHtmlCssOptions {
  readonly root: ParentNode;
  readonly animationContext?: IHtmlAnimationContext;
  readonly registry?: PropertyRegistry;
  readonly sourceStage?: { withSourceStyles<T>(action: () => T): T };
  readonly selectorForElement?: (element: Element) => string | undefined;
  readonly rootSelector?: string;
  readonly prefix?: string;
  readonly loop?: boolean;
  readonly maxKeyframes?: number;
}

/** A French explanation with the authored location when it can be identified. */
export interface IHtmlCssExportDiagnostic {
  readonly code: string;
  readonly message: string;
  readonly layerId?: string;
  readonly property?: string;
  readonly fromFrame?: number;
  readonly toFrame?: number;
}

/** A refused export never provides a stylesheet that silently omits content. */
export type HtmlCssExportResult =
  | {
    readonly status: 'exported';
    readonly fidelity: 'continuous';
    readonly css: string;
    readonly html: string;
    readonly diagnostics: readonly IHtmlCssExportDiagnostic[];
  }
  | {
    readonly status: 'refused';
    readonly css: '';
    readonly html: '';
    readonly diagnostics: readonly IHtmlCssExportDiagnostic[];
    readonly alternatives: readonly ['javascript', 'json'];
  };
