// packages/runtime/src/playback/samplePlayback.ts
import type { IPlaybackDocument, IPlaybackFrame } from './types';
import { clonePlaybackJson } from './json';
import { parsePlayback } from './parsePlayback';

/** Fractional positions use their preceding integer sample; no interpolation is invented. */
export function samplePlayback(data: IPlaybackDocument, frame: number): IPlaybackFrame {
  if (!Number.isFinite(frame)) throw new TypeError('L’image de lecture doit être un nombre fini.');
  const document = parsePlayback(data);
  const at = Math.max(1, Math.min(document.totalFrames, Math.floor(frame)));
  return clonePlaybackJson(document.frames[String(at)]) as IPlaybackFrame;
}
