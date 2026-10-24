// packages/editor/src/core/stage/stageFacade.ts
/**
 * Façade `IEditorStage` donnée aux plugins (`ctx.stage`) et à l'hôte
 * (`editor.stage`) : objet figé de fermetures, sans référence vers le
 * `StageHost`. `refreshTargets` passe par `assertActive` (erreur après la
 * destruction de l'éditeur) ; les lectures restent permises, et `hold()`
 * rend alors une retenue inerte.
 */

import type { IStage, IStageReport, ITargetInfo, LayerTarget } from '@werddomain/timeline-runtime';
import type { EditorStageHost } from './EditorStageHost';
import type { IEditorStage, IStageHold } from './types';

/** Construit la façade de `host`, gardée par `assertActive(operation)`. */
export function createStageFacade(host: EditorStageHost, assertActive: (operation: string) => void): IEditorStage {
  return Object.freeze<IEditorStage>({
    get stages(): readonly IStage[] {
      return host.stages;
    },
    get missingTargets(): readonly string[] {
      return host.missingTargets;
    },
    get warnings(): readonly IStageReport[] {
      return host.warnings;
    },
    listTargets: (): readonly ITargetInfo[] => host.listTargets(),
    describe: (target: LayerTarget): ITargetInfo | undefined => host.describe(target),
    refreshTargets: (layerId?: string): void => {
      assertActive('stage.refreshTargets');
      host.refreshTargets(layerId);
    },
    hold: (): IStageHold => host.hold()
  });
}
