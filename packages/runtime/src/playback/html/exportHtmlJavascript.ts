// packages/runtime/src/playback/html/exportHtmlJavascript.ts
import { createInlineStyleKeeper } from '../../stage/html/inlineStyles';
import { htmlPlaybackFactory } from './htmlPlaybackFactory';
import { parseHtmlPlayback } from './parseHtmlPlayback';

/** An ES module with a single createPlayer(options) export; no network dependency or code from the JSON. */
export function exportHtmlJavascript(input: unknown): string {
  const data = JSON.stringify(parseHtmlPlayback(input)).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  return `// JsAnimationTimeline HTML playback: integer frames, held between samples.\nexport function createPlayer(options) {\n` +
    `  return (${htmlPlaybackFactory.toString()})(${data}, options, ${createInlineStyleKeeper.toString()});\n}\n`;
}
