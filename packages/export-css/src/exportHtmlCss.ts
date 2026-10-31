// packages/export-css/src/exportHtmlCss.ts
import type { ITimelineDocument } from '@kazo-ca/timeline-runtime';
import type { HtmlCssExportResult, IExportHtmlCssOptions, IHtmlCssExportDiagnostic } from './htmlTypes';
import { prepareHtmlCssScene } from './continuous/htmlScene';
import { continuousStylesheet } from './continuous/stylesheet';
import { compileContinuousTarget } from './continuous/target';
import { ContinuousCssError } from './continuous/timeline';

const MAX_KEYFRAMES = 10_000;
function refused(diagnostics: readonly IHtmlCssExportDiagnostic[]): HtmlCssExportResult {
  return { status: 'refused', css: '', html: '', diagnostics, alternatives: ['javascript', 'json'] };
}

/** All-or-nothing continuous CSS export: unsupported curves never become fitted samples. */
export function exportHtmlCss(document: ITimelineDocument, options: IExportHtmlCssOptions): HtmlCssExportResult {
  try {
    const maxKeyframes = options.maxKeyframes ?? MAX_KEYFRAMES;
    const prefix = options.prefix ?? 'jst-';
    if (!Number.isInteger(maxKeyframes) || maxKeyframes < 1 || maxKeyframes > MAX_KEYFRAMES) {
      throw new ContinuousCssError('resource-limit', `La limite de clés CSS doit être comprise entre 1 et ${MAX_KEYFRAMES}.`);
    }
    if (typeof prefix !== 'string' || !/^[A-Za-z_][A-Za-z0-9_-]{0,63}$/.test(prefix)) {
      throw new ContinuousCssError('invalid-prefix', 'Le préfixe CSS doit être un identifiant simple de 1 à 64 caractères.');
    }
    if (options.loop !== undefined && typeof options.loop !== 'boolean') throw new ContinuousCssError('invalid-options', 'L’option de boucle doit être un booléen.');
    const prepared = prepareHtmlCssScene(document, options);
    if (prepared.status === 'refused') return refused(prepared.diagnostics);
    const { totalFrames, fps } = prepared.data.document.settings;
    let count = 0;
    const targets = prepared.data.targets.map((target) => {
      const animations = compileContinuousTarget(target, totalFrames, maxKeyframes - count);
      count += animations.reduce((sum, animation) => sum + animation.frames.length, 0);
      if (count > maxKeyframes) throw new ContinuousCssError('resource-limit', 'La feuille de style dépasse la limite de clés CSS. Utilisez JavaScript ou JSON.');
      return { selector: target.selector, animations };
    });
    const css = continuousStylesheet(targets, totalFrames, fps, prefix, options.loop ?? false, prepared.data.existingKeyframeNames);
    return { status: 'exported', fidelity: 'continuous', css, html: css === '' ? '' : `<style>\n${css}\n</style>`, diagnostics: prepared.diagnostics };
  } catch (error) {
    return refused([{ code: error instanceof ContinuousCssError ? error.code : 'css-export-refused',
      message: error instanceof Error ? error.message : 'Le document ne peut pas être exporté en CSS.',
      ...(error instanceof ContinuousCssError ? { layerId: error.layerId, property: error.property, fromFrame: error.fromFrame, toFrame: error.toFrame } : {}) }]);
  }
}
