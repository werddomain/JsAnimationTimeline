// packages/export-css/src/types.ts
/**
 * Types publics de l'export CSS : options, résultat et avertissements.
 */

import type { PropertyRegistry } from '@werddomain/timeline-runtime';

/**
 * Why part of a document was left out of the CSS:
 * - `unsupported-target`: the layer has no `{ selector }` target (no target,
 *   a live `{ element }`, a `{ ref }` of a developer stage...), or its
 *   selector cannot be written safely in a style sheet;
 * - `non-css-property`: the track's property exists but is not CSS
 *   (`kind` other than `transform` / `style`);
 * - `unknown-property`: the track's property is not in the registry;
 * - `invalid-layer`: the layer could not be evaluated (invalid easing...).
 */
export type ExportCssWarningCode = 'unsupported-target' | 'non-css-property' | 'unknown-property' | 'invalid-layer';

/** Something the export skipped; the rest of the document is still exported. */
export interface IExportCssWarning {
  readonly code: ExportCssWarningCode;
  readonly layerId: string;
  /** Track name, for the property codes. */
  readonly property?: string;
  /** Explanation for the user, in French. */
  readonly message: string;
}

/** Options of `exportCss`. */
export interface IExportCssOptions {
  /** Prefix of the `@keyframes` names; defaults to `tl-`. */
  readonly prefix?: string;
  /** Registry that knows the tracks; defaults to `defaultPropertyRegistry`. */
  readonly registry?: PropertyRegistry;
  /** Repeat forever (`animation-iteration-count: infinite`); defaults to false. */
  readonly loop?: boolean;
}

/** Result of `exportCss`. */
export interface IExportCssResult {
  /** Style sheet: one `@keyframes` block and one rule per exported layer. */
  readonly css: string;
  /** The same style sheet in a `<style>` element, ready to paste in a page. */
  readonly html: string;
  /** What was skipped, in document order. */
  readonly warnings: readonly IExportCssWarning[];
}
