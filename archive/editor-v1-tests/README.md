<!-- archive/editor-v1-tests/README.md -->
# Archive des tests de l’éditeur v1

Les huit suites et leurs deux fichiers de support sont conservés octet pour octet depuis `packages/editor/src/legacy/__tests__`. Ils ne sont plus exécutés : ils dépendent du code v1 retiré. `demo-renders.spec.ts` conserve aussi le smoke v1 remplacé par `e2e/demo/demo-renders.spec.ts`.

| Suite v1 | Couverture v2 active correspondante |
| --- | --- |
| EventManager | `packages/editor/src/core/events/__tests__/EventBus.test.ts`, `EventBus.cancellable.test.ts` |
| KeyframeManager | `packages/editor/src/model/spans/__tests__/insertKeyframe.test.ts`, `deleteKeyframe.test.ts`, `moveKeyframe.test.ts` ; `plugins/frames/clipboard/__tests__/clipboardOps.test.ts` |
| LayerManager | `packages/editor/src/plugins/layers/toolbar/__tests__/toolbarCommands.test.ts`, `plugins/layers/reorder/__tests__/moveNodes.test.ts`, `plugins/layers/groups/__tests__/groupCommands.test.ts` |
| PlaybackEngine | `packages/editor/src/core/playback/__tests__/PlaybackController.test.ts`, `plugins/playback/controls/__tests__/PlaybackControlsPlugin.test.ts` |
| SelectionManager | `packages/editor/src/plugins/frames/selection/__tests__/frameSelection.test.ts`, `FramesSelectionPlugin.test.ts`, `plugins/layers/selection/__tests__/selectionModel.test.ts` |
| StateManager | `packages/editor/src/core/commands/__tests__/CommandStack.test.ts`, `core/store/__tests__/Store.test.ts` |
| TweenManager | `packages/editor/src/plugins/tweens/motion/__tests__/createMotionTween.test.ts`, `removeMotionTween.test.ts`, `motionTweenCommands.test.ts` |
| TimelineData | `packages/editor/src/plugins/persistence/json/__tests__/readDocument.test.ts`, `writeDocument.test.ts`, `packages/runtime/src` tests de migration et validation |

Ces correspondances portent sur les comportements v2 applicables, dont les modèles et événements diffèrent de v1 ; elles ne prétendent pas préserver les signatures ou événements v1. Les interactions de la démo et annulations sont également exercées par `e2e/editor/editor-demo.spec.ts`.
