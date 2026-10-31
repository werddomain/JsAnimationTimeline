// packages/runtime/src/playback/compileWork.ts
import { MAX_PLAYBACK_CELLS, MAX_PLAYBACK_COMPILE_WORK, MAX_PLAYBACK_FRAMES, MAX_PLAYBACK_OBJECTS } from './limits';

type JsonRecord = Readonly<Record<string, unknown>>;
interface IWorkBudget { readonly frames: number; readonly maxCells: number; work: number; cells: number; objects: number }
const EMPTY: JsonRecord = Object.freeze(Object.create(null) as Record<string, unknown>);
const record = (value: unknown): JsonRecord => typeof value === 'object' && value !== null && !Array.isArray(value) ? value as JsonRecord : EMPTY;
const list = (value: unknown): readonly unknown[] => Array.isArray(value) ? value : [];

function addWork(budget: IWorkBudget, validation: number, perFrame: number): void {
  budget.work += validation + budget.frames * perFrame;
  if (budget.work > MAX_PLAYBACK_COMPILE_WORK) {
    throw new Error(`Le document dépasse la limite de travail de compilation (${MAX_PLAYBACK_COMPILE_WORK} unités).`);
  }
}

function addCells(budget: IWorkBudget, properties: number): void {
  budget.cells += budget.frames * (1 + properties);
  if (++budget.objects > MAX_PLAYBACK_OBJECTS || budget.cells > budget.maxCells) {
    throw new Error('Le document dépasse la limite de compilation image par image.');
  }
}

function countTimeline(value: unknown, spans: number, budget: IWorkBudget): void {
  const track = record(value);
  const keyCount = list(track.keys).length;
  const transitions = list(track.transitions);
  const count = transitions.length;
  // Validation searches the key array per transition and compares preceding transitions.
  // Each sample scans keys/transitions again; retained source scans are additional work.
  addWork(budget, keyCount + count * (2 * keyCount + count) + spans, 5 + 2 * keyCount + count);
  for (const transition of transitions) {
    const sourceKeys = list(record(record(transition).source).keys).length;
    addWork(budget, 3 * sourceKeys, 2 * sourceKeys);
  }
}

function countLayer(layer: JsonRecord, budget: IWorkBudget): void {
  const spans = list(layer.spans);
  const properties = new Set<string>();
  let legacyKeys = 0;
  let legacyTracks = 0;
  for (const span of spans) {
    for (const [name, keys] of Object.entries(record(record(span).tracks))) {
      properties.add(name);
      legacyTracks++;
      legacyKeys += list(keys).length;
    }
  }
  // Legacy evaluation repeatedly discovers track names and copies carried values per span.
  addWork(budget, spans.length + legacyTracks + legacyKeys,
    4 * spans.length + 4 * legacyTracks + 2 * legacyKeys + (spans.length + 4) * properties.size);
  for (const [name, timeline] of Object.entries(record(layer.propertyTimelines))) {
    properties.add(name);
    countTimeline(timeline, spans.length, budget);
  }
  addCells(budget, properties.size);
}

function countNodes(nodes: readonly unknown[], budget: IWorkBudget): void {
  for (const value of nodes) {
    addWork(budget, 1, 1);
    const node = record(value);
    if (node.type === 'folder') countNodes(list(node.children), budget);
    else if (node.type === 'layer') countLayer(node, budget);
  }
}

/**
 * Runs only on the strict JSON clone, before shape/semantic validation or evaluation.
 * This linear structural pass tolerates malformed fields so normal validation still
 * reports them. The conservative estimate may refuse expensive but valid documents;
 * it bounds our evaluator scans, not execution time of host-provided interpolators.
 */
export function assertPlaybackCompileBudget(input: unknown, maxCells = MAX_PLAYBACK_CELLS): void {
  if (!Number.isInteger(maxCells) || maxCells < 1 || maxCells > MAX_PLAYBACK_CELLS) {
    throw new Error(`La limite de cellules doit être comprise entre 1 et ${MAX_PLAYBACK_CELLS}.`);
  }
  const doc = record(input);
  const totalFrames = record(doc.settings).totalFrames;
  if (typeof totalFrames === 'number' && totalFrames > MAX_PLAYBACK_FRAMES) {
    throw new Error('Le document dépasse la limite de compilation image par image.');
  }
  const frames = typeof totalFrames === 'number' && Number.isInteger(totalFrames) && totalFrames > 0 ? totalFrames : 1;
  const budget: IWorkBudget = { frames, maxCells, work: frames, cells: frames, objects: 0 };
  if (frames > maxCells) throw new Error('Le document dépasse la limite de compilation image par image.');
  countNodes(list(doc.layers), budget);
}
