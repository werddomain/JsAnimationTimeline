// packages/editor/src/core/stage/resolveStages.ts
/**
 * Scènes de l'éditeur à partir des options : celles du développeur, aucune
 * (`stage: false`), ou la scène HTML par défaut (`createEditorHtmlStage`).
 */

import type { IStage } from '@werddomain/timeline-runtime';
import type { EditorStageOption } from './types';

/** Options qui choisissent les scènes. */
export interface IStageChoice {
  readonly stage?: EditorStageOption;
  readonly root?: ParentNode;
}

function isStageList(option: IStage | readonly IStage[]): option is readonly IStage[] {
  return Array.isArray(option);
}

/** Scènes du développeur, `[]` pour `stage: false`, ou `null` pour la scène HTML par défaut. */
export function resolveUserStages(options: IStageChoice): readonly IStage[] | null {
  const option = options.stage;
  if (option === undefined) return null;
  if (options.root !== undefined) {
    throw new Error('createEditor : donnez « root » ou « stage », pas les deux (root sert seulement à la scène HTML par défaut).');
  }
  if (option === false) return [];
  const stages: readonly IStage[] = isStageList(option) ? option.slice() : [option];
  if (stages.length === 0) {
    throw new Error('createEditor : « stage » demande au moins une scène (ou false pour la timeline seule).');
  }
  return stages;
}
