<!-- doc/v2/api.md -->
# v2 integration and API

The workspaces are built locally with `npm run build`. Runtime and CSS export are currently private packages; this repository does not imply an npm release. The demos use Vite aliases to workspace sources. The editor exports `@werddomain/timeline-editor/timeline-editor.css`; import that stylesheet in a bundler or serve the built CSS separately. See the [root README](../../README.md) for setup and the [schema](../../schema/README.md) for the document format.

## Runtime

`@werddomain/timeline-runtime` exports the v2 model, validation and v1 migration, property registry and evaluation, player, transport and stages. Its entry point is [runtime/src/index.ts](../../packages/runtime/src/index.ts). A document contains settings (`fps`, `totalFrames`) and a layer tree with spans and property tracks. Frames are numbered from 1. Targets are serializable selectors or references; live objects belong in a stage, not the document.

`createPlayer(document, options)` uses a Web Animations HTML stage by default. Set `root` to scope selectors, or supply `stage` (one `IStage` or an array), but not both. Options include `autoplay`, `loop`, positive `speed`, a property `registry`, `clock`, and `onListenerError`. The player exposes `play`, `pause`, `seek`, `update`, `refreshTargets`, `destroy`, current time and state, `missingTargets` and `warnings`. `update` keeps time and playback state. `on` returns an unsubscribe function; events include `frame`, `tick`, `play`, `pause`, `loop`, and `complete`. `destroy` releases layers and detaches stages. See the [runtime demo](../../demo/runtime/src/main.ts) and [document fixture](../../demo/runtime/src/animation.ts).

## Editor

`createEditor(host, options)` creates the editor in an HTML element. Its default plugin set can be replaced with `defaultPlugins: false` or an array; `plugins` adds plugins. `createPropertiesPanelPlugin()` is optional. The editor's default HTML stage resolves selectors under `root`; `stage: false` creates a timeline without a stage, while `stage` accepts developer stages. `root` and `stage` cannot be combined. The editor copies its property registry at creation, incorporates stage descriptors, and can use a manual clock. `data` and documents passed to `load` are validated and frozen in place: use `structuredClone` first when a mutable copy is needed.

Read `document` or `toJSON()`, replace it with `load` (which clears history), and use `sample(frame)` or `onFrame` for sampled values. `playback` controls the playhead; `refreshTargets` retries missing targets. `on` and `once` return unsubscribe functions. `destroy()` is idempotent and releases the editor; supplied stage objects remain owned by the host. After destruction only `destroy` and `isDestroyed` remain usable. See [editor API types](../../packages/editor/src/core/editor/types.ts) and the [editor demo](../../demo/editor/src/main.ts).

Document changes must use `execute(command)` or an API that creates a command, such as `setProperty(layerId, name, value, { frame })`. `undo`, `redo`, `canUndo` and `canRedo` expose history; `execute` returns false for a no-op or refusal. Commands implement `ICommand` with a label and immutable `do` and `undo` transforms. `load` is a replacement rather than an undoable edit. `setProperty` can refuse invalid, locked or unavailable edits and emits `command:refused`; its return value indicates whether the document changed. For the precise contracts see [ICommand](../../packages/editor/src/core/commands/ICommand.ts) and [editor API types](../../packages/editor/src/core/editor/types.ts).

Plugins receive `IEditorContext`, declare their dependencies and register services, event handlers or UI in slots. Their initialisation is ordered by dependencies; cleanup occurs in reverse order. The public plugin and service types are exported by the [editor entry point](../../packages/editor/src/index.ts). Ordinary event subscriptions are distinct from cancellable plugin event subscriptions; handlers for a cancellable event can cancel it, and a thrown handler error also cancels it. See [EventBus](../../packages/editor/src/core/events/EventBus.ts) and [plugin context](../../packages/editor/src/core/context/IEditorContext.ts).

## Developer-owned scenes

An `IStage` identifies itself, decides whether it accepts a target, resolves it to an object, and implements `sync`, `render`, or both. Optional lifecycle hooks attach, update, release and detach layers; the host owns the underlying objects. A stage can describe targets and property descriptors for the editor. A missing target appears in `missingTargets`; call `refreshTargets` after late creation, or implement target subscriptions. Stage errors are reported and playback continues, except for a `StageDocumentError` from `update`, which rejects the document. See [IStage](../../packages/runtime/src/stage/types.ts) and the [scene design](scene-developpeur.md).

The [runtime object-stage demo](../../demo/runtime/src/objectStage/) combines canvas, audio and HTML. The [editor scene demo](../../demo/editor/src/scene.ts) demonstrates both supplied stages and `stage: false` with `sample`/`onFrame`. Those demos also show custom value descriptors; the scene applies the sampled values and decides how visibility affects its objects.

## CSS export

`@werddomain/timeline-export-css` exports `exportCss(document, options)` returning `{ css, html, warnings }`. Options include a keyframe `prefix`, a property `registry` and `loop`. Inspect warnings before using the result: unsupported or unsafe selectors, non-CSS and unknown properties, invalid layers and invalid documents can be skipped. The exporter does not render developer-owned objects. See [export options and warnings](../../packages/export-css/src/types.ts) and the [CSS parity browser test](../../e2e/export-css/).

## Blazor

The Razor class library targets .NET 8 and later. [Its README](../../dotnet/JsTimeline.Blazor/README.md) documents document serialization, player and editor lifecycle, callbacks, errors and the C# stage bridge. `TimelinePlayer` supports the HTML stage; `TimelineEditor` also supports `TimelineStageOption.None()`, `JsModule(...)` and `DotNet(...)`. The editor requires its CSS and an import map for the runtime module. A JavaScript stage module path must come from trusted configuration. The [sample application](../../dotnet/samples/BlazorSample/README.md) exercises integration. A new editor `Data` instance replaces the document and clears history; `ImportAsync` is undoable. Stage changes recreate the editor and history.

## Demos and retained material

The static Pages build includes the editor and runtime demos, their validation pages and fixtures. Legacy v1 demo sources and tests remain in [archive](../../archive/). The demos and browser tests are executable examples rather than published packages; follow the [demo instructions](../../README.md#try-the-demos-locally) and [browser test guide](../../e2e/README.md).
