// packages/runtime/src/playback/html/parseHtmlPlayback.ts
import { clonePlaybackJson, freezePlaybackJson } from '../json';
import { MAX_PLAYBACK_CELLS, MAX_PLAYBACK_OBJECTS } from '../limits';
import { parsePlayback } from '../parsePlayback';
import type { IHtmlPlaybackDocument, IHtmlPlaybackFrame, IHtmlPlaybackGroup } from './types';

function record(value: unknown, description: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${description} doit être un objet JSON.`);
  return value as Record<string, unknown>;
}
function fields(value: Record<string, unknown>, names: readonly string[]): void {
  if (Object.keys(value).length !== names.length || names.some((name) => !Object.prototype.hasOwnProperty.call(value, name))) throw new Error('Les champs du document HTML sont invalides.');
}
function selectors(value: unknown, required: boolean): readonly string[] {
  if (!Array.isArray(value) || required && value.length === 0 || value.some((item) => typeof item !== 'string' || item.trim() === '' || item.length > 4096)
    || new Set(value).size !== value.length) throw new Error('Les sélecteurs du groupe HTML sont invalides.');
  return value as string[];
}
function declarations(value: unknown): Readonly<Record<string, string>> {
  const input = record(value, 'Les déclarations'); const result: Record<string, string> = Object.create(null) as Record<string, string>;
  for (const [name, text] of Object.entries(input)) {
    if (!/^(?:--|-?[a-zA-Z])[\w-]*$/.test(name) || typeof text !== 'string' || text.length === 0 || text.length > 65536 || /[;{}]|(?:expression\s*\(|javascript\s*:|@import)/i.test(text)
      || Array.from(text).some((char) => char.charCodeAt(0) < 32 && !'\t\n\r'.includes(char))) throw new Error('Une déclaration CSS exportée est invalide.');
    result[name] = text;
  }
  return result;
}

/** Strict detached JSON boundary; selectors are checked by the destination browser before writes. */
export function parseHtmlPlayback(input: unknown): IHtmlPlaybackDocument {
  const data = record(clonePlaybackJson(input), 'Le document HTML');
  fields(data, ['version', 'sampling', 'source', 'groups', 'frames']);
  if (data.version !== 1 || data.sampling !== 'frames') throw new Error('La version ou le mode de lecture HTML est inconnu.');
  const source = parsePlayback(data.source);
  const sourceSelectors = Object.values(source.objects).map((object) => {
    if (object.target === undefined || !('selector' in object.target)) throw new Error('La lecture HTML exige des objets à sélecteur.');
    return object.target.selector;
  });
  if (!Array.isArray(data.groups) || data.groups.length > MAX_PLAYBACK_OBJECTS) throw new Error('Les groupes HTML sont invalides.');
  const groups: IHtmlPlaybackGroup[] = data.groups.map((entry: unknown) => {
    const group = record(entry, 'Le groupe'); fields(group, ['id', 'include', 'exclude', 'count']);
    if (typeof group.id !== 'string' || !/^group-[1-9]\d*$/.test(group.id) || !Number.isSafeInteger(group.count) || (group.count as number) < 1) throw new Error('L’identité ou le nombre d’éléments du groupe est invalide.');
    const include = selectors(group.include, true); const exclude = selectors(group.exclude, false);
    if (include.some((selector) => exclude.includes(selector))) throw new Error('Un sélecteur ne peut pas être inclus et exclu.');
    if (!include.some((selector) => sourceSelectors.includes(selector)) || sourceSelectors.some((selector) => !include.includes(selector) && !exclude.includes(selector))) throw new Error('Le groupe doit préciser son appartenance à chaque cible source.');
    return { id: group.id, include, exclude, count: group.count as number };
  });
  if (new Set(groups.map((group) => group.id)).size !== groups.length) throw new Error('Les identités de groupe sont répétées.');
  const frames = record(data.frames, 'Les images');
  if (Object.keys(frames).length !== source.totalFrames) throw new Error('Le dictionnaire d’images HTML est incomplet.');
  const result: Record<string, IHtmlPlaybackFrame> = Object.create(null) as Record<string, IHtmlPlaybackFrame>;
  let cells = Object.values(source.frames).reduce((sum, frame) => sum + 1 + Object.values(frame)
    .reduce((count, state) => count + 1 + Object.keys(state.values).length, 0), 0);
  for (let frame = 1; frame <= source.totalFrames; frame++) {
    const entries = record(frames[String(frame)], 'L’image'); fields(entries, groups.map((group) => group.id));
    const output: Record<string, Readonly<Record<string, string>>> = Object.create(null) as Record<string, Readonly<Record<string, string>>>;
    for (const group of groups) {
      const css = declarations(entries[group.id]); cells += Math.max(1, Object.keys(css).length) * group.count;
      if (cells > MAX_PLAYBACK_CELLS) throw new Error('Le budget de lecture HTML est dépassé.');
      output[group.id] = css;
    }
    result[String(frame)] = output;
  }
  return freezePlaybackJson({ version: 1, sampling: 'frames', source, groups, frames: result });
}
