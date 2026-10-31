// packages/export-css/src/types.ts
/**
 * Types publics de l'export CSS : options, résultat et avertissements.
 */

import type { PropertyRegistry } from '@kazo-ca/timeline-runtime';

/**
 * Why the complete historical export was refused:
 * - `unsupported-target`: the layer has no `{ selector }` target (no target,
 *   a live `{ element }`, a `{ ref }` of a developer stage...), or its
 *   selector cannot be written safely in a style sheet;
 * - `non-css-property`: the track's property exists but is not CSS
 *   (`kind` other than `transform` / `style`);
 * - `unknown-property`: the track's property is not in the registry;
 * - `invalid-layer`: the layer could not be evaluated (invalid easing...);
 * - `unsupported-property-timeline`: modern independent property tracks need
 *   exportHtmlCss and a source HTML scene; the complete export is refused;
 * - `invalid-document`: `fps` or `totalFrames` is not a positive number, or
 *   `layers` is not an array;
 *   nothing is exported.
 */
export type ExportCssWarningCode = 'unsupported-target' | 'non-css-property' | 'unknown-property' | 'invalid-layer'
  | 'invalid-document' | 'unsupported-property-timeline';

/** A reason the historical export refuses the complete document. */
export interface IExportCssWarning {
  readonly code: ExportCssWarningCode;
  /** Layer concerned; empty for `invalid-document`. */
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
  /** Style sheet: one `@keyframes` block per exported layer, then one rule per selector. */
  readonly css: string;
  /** The same style sheet in a `<style>` element, ready to paste in a page. */
  readonly html: string;
  /** Refusal reasons, in document order; any entry means css/html are empty. */
  readonly warnings: readonly IExportCssWarning[];
}
