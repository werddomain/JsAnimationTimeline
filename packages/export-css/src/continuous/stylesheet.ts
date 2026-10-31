// packages/export-css/src/continuous/stylesheet.ts
import { isSafeSelector, keyframesName } from '../cssNames';
import type { IContinuousCssAnimation } from './target';
import { ContinuousCssError } from './timeline';

export interface IContinuousCssTarget { readonly selector: string; readonly animations: readonly IContinuousCssAnimation[] }

/** Preserve floating-point precision; a key at frame N still precedes the final hold. */
export function continuousStylesheet(targets: readonly IContinuousCssTarget[], totalFrames: number, fps: number, prefix: string, loop: boolean,
  existingKeyframeNames: readonly string[] = []): string {
  const blocks: string[] = [];
  const rules: string[] = [];
  const used = new Set<string>();
  const existing = new Set(existingKeyframeNames);
  for (const [index, target] of targets.entries()) {
    if (!isSafeSelector(target.selector)) throw new ContinuousCssError('unsafe-selector', 'Le sélecteur ne peut pas être écrit dans une feuille de style.');
    const names = target.animations.map((animation) => {
      const name = keyframesName(prefix, `${index + 1}-${animation.property}`, used);
      if (existing.has(name)) throw new ContinuousCssError('keyframes-name-conflict', `Le nom d’animation « ${name} » existe déjà dans la page. Choisissez un préfixe distinct pour cet export.`);
      const frames = animation.frames.map((frame) => `  ${(frame.frame - 1) * 100 / totalFrames}% { ${animation.property}: ${frame.value}; animation-timing-function: ${frame.timing}; }`);
      blocks.push(`@keyframes ${name} {\n${frames.join('\n')}\n}`);
      return name;
    });
    if (names.length === 0) continue;
    rules.push(`${target.selector} {\n  animation-name: ${names.join(', ')};\n  animation-duration: ${totalFrames / fps}s;\n  animation-timing-function: linear;\n  animation-delay: 0s;\n  animation-direction: normal;\n  animation-fill-mode: both;\n  animation-iteration-count: ${loop ? 'infinite' : '1'};\n  animation-play-state: running;\n  animation-composition: replace;\n}`);
  }
  return [...blocks, ...rules].join('\n\n');
}
