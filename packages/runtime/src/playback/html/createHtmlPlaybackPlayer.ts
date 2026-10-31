// packages/runtime/src/playback/html/createHtmlPlaybackPlayer.ts
import { createInlineStyleKeeper } from '../../stage/html/inlineStyles';
import { htmlPlaybackFactory } from './htmlPlaybackFactory';
import { parseHtmlPlayback } from './parseHtmlPlayback';
import type { IHtmlPlaybackPlayer, IHtmlPlaybackPlayerOptions } from './types';

export function createHtmlPlaybackPlayer(input: unknown, options: IHtmlPlaybackPlayerOptions): IHtmlPlaybackPlayer {
  return htmlPlaybackFactory(parseHtmlPlayback(input), options, createInlineStyleKeeper);
}
