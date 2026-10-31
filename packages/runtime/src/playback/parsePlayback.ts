// packages/runtime/src/playback/parsePlayback.ts
import type { IPlaybackDocument } from './types';
import { isValidPropertyName } from '../model/names';
import type { TimelinePropertyValue } from '../model/propertyTimeline';
import { clonePlaybackJson, freezePlaybackJson } from './json';
import { MAX_PLAYBACK_CELLS, MAX_PLAYBACK_FRAMES, MAX_PLAYBACK_OBJECTS } from './limits';

const validated = new WeakSet<object>();
type Data = Record<string, unknown>;

function record(value: unknown, label: string): Data {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} doit être un objet.`);
  return value as Data;
}

function fields(value: Data, required: readonly string[], optional: readonly string[] = []): void {
  if (required.some((key) => !Object.prototype.hasOwnProperty.call(value, key)) || Object.keys(value).some((key) => !required.includes(key) && !optional.includes(key))) {
    throw new TypeError('Champs absents ou inconnus dans le document de lecture.');
  }
}

function nonEmptyText(value: unknown, label: string): void {
  if (typeof value !== 'string' || value.length === 0) throw new TypeError(`${label} doit être un texte non vide.`);
}

function target(value: unknown): void {
  const item = record(value, 'La cible');
  if (Object.prototype.hasOwnProperty.call(item, 'selector')) { fields(item, ['selector']); nonEmptyText(item.selector, 'Le sélecteur'); return; }
  fields(item, ['ref'], ['stage']);
  nonEmptyText(item.ref, 'La référence');
  if (Object.prototype.hasOwnProperty.call(item, 'stage')) nonEmptyText(item.stage, 'La scène');
}

function typedValue(value: unknown): TimelinePropertyValue['kind'] {
  const item = record(value, 'La valeur');
  if (item.kind === 'color') {
    fields(item, ['kind', 'r', 'g', 'b', 'a']);
    if (['r', 'g', 'b', 'a'].some((channel) => typeof item[channel] !== 'number' || item[channel] < 0 || item[channel] > 1)) {
      throw new TypeError('Les composantes de couleur doivent être comprises entre 0 et 1.');
    }
    return 'color';
  }
  fields(item, ['kind', 'value']);
  if (item.kind !== 'number' && item.kind !== 'text' && item.kind !== 'boolean' || typeof item.value !== (item.kind === 'text' ? 'string' : item.kind)) {
    throw new TypeError('Le type de valeur de lecture est invalide.');
  }
  return item.kind;
}

function objectTable(value: unknown): Data {
  const objects = record(value, 'Les objets');
  if (Object.keys(objects).length > MAX_PLAYBACK_OBJECTS) throw new TypeError('Trop d’objets dans le document de lecture.');
  for (const [id, value] of Object.entries(objects)) {
    nonEmptyText(id, 'L’identité');
    const object = record(value, 'L’objet');
    fields(object, ['name'], ['target']);
    if (typeof object.name !== 'string') throw new TypeError('Le nom de l’objet doit être un texte.');
    if (Object.prototype.hasOwnProperty.call(object, 'target')) target(object.target);
  }
  return objects;
}

function frameTable(value: unknown, objects: Data, totalFrames: number): void {
  const frames = record(value, 'Les images');
  if (Object.keys(frames).length !== totalFrames) throw new TypeError('Chaque image entière doit posséder un état de lecture.');
  const identities = Object.keys(objects);
  const propertyKinds = new Map<string, Map<string, TimelinePropertyValue['kind']>>();
  let cells = totalFrames;
  for (let frame = 1; frame <= totalFrames; frame++) {
    if (!Object.prototype.hasOwnProperty.call(frames, String(frame))) throw new TypeError('Les images doivent être numérotées de 1 à la durée.');
    const states = record(frames[String(frame)], 'Les états');
    if (Object.keys(states).length !== identities.length || identities.some((id) => !Object.prototype.hasOwnProperty.call(states, id))) throw new TypeError('Chaque image doit contenir exactement les objets déclarés.');
    for (const id of identities) {
      const state = record(states[id], 'L’état');
      fields(state, ['active', 'values']);
      if (typeof state.active !== 'boolean') throw new TypeError('La visibilité de lecture doit être booléenne.');
      const values = record(state.values, 'Les propriétés');
      const entries = Object.entries(values);
      cells += 1 + entries.length;
      if (cells > MAX_PLAYBACK_CELLS) throw new TypeError('Le document de lecture dépasse la limite de cellules.');
      const kinds = new Map(entries.map(([name, value]) => {
        if (!isValidPropertyName(name)) throw new TypeError('Le nom de propriété de lecture est invalide.');
        return [name, typedValue(value)] as const;
      }));
      const initial = propertyKinds.get(id);
      if (initial === undefined) propertyKinds.set(id, kinds);
      else if (initial.size !== kinds.size || [...initial].some(([name, kind]) => kinds.get(name) !== kind)) {
        throw new TypeError('Chaque image doit conserver les propriétés et types de l’objet.');
      }
    }
  }
}

/** Validate and detach once; the returned frozen tree is safe for repeated direct lookup. */
export function parsePlayback(input: unknown): IPlaybackDocument {
  if (typeof input === 'object' && input !== null && validated.has(input)) return input as IPlaybackDocument;
  const data = record(clonePlaybackJson(input), 'Le document de lecture');
  fields(data, ['version', 'sampling', 'fps', 'totalFrames', 'objects', 'frames']);
  if (data.version !== 1 || data.sampling !== 'frames') throw new TypeError('Version ou échantillonnage du document de lecture non pris en charge.');
  if (typeof data.fps !== 'number' || !Number.isInteger(data.fps) || data.fps < 1 || data.fps > 240) throw new TypeError('La cadence doit être un entier de 1 à 240.');
  if (typeof data.totalFrames !== 'number' || !Number.isInteger(data.totalFrames) || data.totalFrames < 1 || data.totalFrames > MAX_PLAYBACK_FRAMES) throw new TypeError('La durée du document de lecture est invalide ou dépasse la limite.');
  const objects = objectTable(data.objects);
  frameTable(data.frames, objects, data.totalFrames);
  const document = freezePlaybackJson(data) as unknown as IPlaybackDocument;
  validated.add(document);
  return document;
}
