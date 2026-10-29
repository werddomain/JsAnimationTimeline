// packages/export-css/src/cssTracks.ts
/**
 * Copie d'un calque réduite à ses pistes CSS : seules les propriétés que le
 * registre connaît comme `transform` ou `style` sont gardées. Les autres
 * pistes sont retirées (une seule fois signalées par calque et par nom), ce
 * qui permet d'évaluer le calque sans jamais échouer sur une piste inconnue.
 */

import type { ILayer, ISpan, PropertyRegistry, PropertyTracks } from '@kazo-ca/timeline-runtime';
import type { IExportCssWarning } from './types';

type TrackVerdict = 'css' | 'non-css-property' | 'unknown-property';

function verdictOf(name: string, registry: PropertyRegistry): TrackVerdict {
  const descriptor = registry.get(name);
  if (descriptor === undefined) {
    return 'unknown-property';
  }
  // Compared as a plain string: the registry may know non-CSS kinds (`value`).
  const kind: string = descriptor.kind;
  return kind === 'transform' || kind === 'style' ? 'css' : 'non-css-property';
}

function warningFor(layerId: string, property: string, code: Exclude<TrackVerdict, 'css'>): IExportCssWarning {
  const message =
    code === 'unknown-property'
      ? `Calque « ${layerId} » : la propriété « ${property} » est inconnue du registre, sa piste est ignorée.`
      : `Calque « ${layerId} » : la propriété « ${property} » n'est pas une propriété CSS, sa piste est ignorée.`;
  return { code, layerId, property, message };
}

/** Result of `keepCssTracks`. */
export interface ICssTracksResult {
  readonly layer: ILayer;
  readonly warnings: readonly IExportCssWarning[];
}

/**
 * Copy of `layer` keeping only the CSS tracks known to `registry`, with one
 * warning per skipped track name. `layer` itself is never modified.
 */
export function keepCssTracks(layer: ILayer, registry: PropertyRegistry): ICssTracksResult {
  const skipped = new Map<string, Exclude<TrackVerdict, 'css'>>();
  const spans = layer.spans.map((span): ISpan => {
    if (span.tracks === undefined) {
      return span;
    }
    const tracks: Record<string, PropertyTracks[string]> = {};
    for (const [name, track] of Object.entries(span.tracks)) {
      const verdict = verdictOf(name, registry);
      if (verdict === 'css') {
        tracks[name] = track;
      } else if (!skipped.has(name)) {
        skipped.set(name, verdict);
      }
    }
    return { ...span, tracks };
  });
  const warnings = Array.from(skipped, ([name, code]) => warningFor(layer.id, name, code));
  return { layer: { ...layer, spans }, warnings };
}
