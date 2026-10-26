<!-- doc/v2/todo/S1-properties-panel.md -->
# S1 — Optional property panel

The optional `properties.panel` plugin adds a persistent inspector beside the timeline. Add `createPropertiesPanelPlugin()` to `EditorOptions.plugins`; `defaultPlugins()` deliberately remains unchanged. Public exports are `PropertiesPanelPlugin`, `PROPERTIES_PANEL_PLUGIN_ID`, `createPropertiesPanelPlugin` and the type `IPropertiesPanelService`.

## Behavior and integration

- Dependencies: `layout.shell`, `layers.selection`, `tweens.propertyKeyframes`. Rendering uses the existing `ROOT_SLOT`; the inspector is the root's second child. The plugin owns its root class, DOM, handlers and service. No new core, slot or runtime contract is introduced.
- Normal inspection uses exactly one layer selection and the integer playback frame. Frame-grid selection is independent. Folders, missing selection and multiple selection have French explanatory states.
- `focusAt(layerId, frame): boolean` validates the real layer and integer frame, explicitly selects the layer, verifies the accepted selection, seeks and focuses the inspector. `toolbar:editKeyframe` calls this method; `inTween` never grants access. Synchronous callbacks after selection, seek, metadata/sample reads and focus can invalidate the operation.
- Property discovery and writes exclusively use W2 `propertiesFor()` and `setProperty(..., { frame })`. Fresh descriptors reflect routed target permissions. Absent target metadata retains the existing W2 registry fallback; an explicitly empty permission list permits no properties. No target object is resolved by the panel.
- Values come from `ctx.playback.sample(frame).layer(layerId)`, exactly as `editor.sample(frame)`. Missing own properties use the descriptor default with a visible origin note. Built-in labels have French fallbacks; nonblank custom registry labels and units are preserved. Blank custom labels fall back to the property name to keep inputs accessible. Own-property checks support names such as `toString`.
- Fields show evaluated values and a stored-key note when present. Nonlinear easing is never inverted. Numeric input accepts finite numbers; it adds no clamp or HTML min/max. Runtime evaluation remains authoritative, including existing static/tween semantics.
- Input creates a draft even when its number equals the sample. Only Apply or Enter submits it. Focus, untouched Enter and blur do not write. Escape restores the latest display. A new explicit key equal to the sample changes history; an identical existing key does not. Static edits retain the static span and write at its start through W2.
- Playing, direct/inherited locks and blank/missing content remain inspectable but readonly. Pause and natural completion refresh the panel through existing playback events. There is no panel timer.
- Document, selected IDs, integer frame, playback and stage metadata changes invalidate drafts. A focus-only event with the same selected IDs preserves a draft. Direct subscriptions to each stage's `targets.subscribe` handle capability-only changes that do not emit `stage:targetsChanged`.
- Context tickets are checked after developer metadata/interpolation callbacks and before writing. Nested refreshes cannot repaint an obsolete target. Removed controls lose their handlers; retained services reject use after destruction. Ordinary refresh and commit preserve an existing input's focus.
- The plugin's scoped LESS reserves a right column (default 280px, `--jt-properties-width`) and places the inspector below the timeline below 768px. Both the inspector and narrow toolbar can scroll.

## Permanent validation assets

- Unit/integration: `packages/editor/src/plugins/properties/panel/__tests__/PropertiesPanelPlugin.test.ts`.
- Built browser fixture: `demo/runtime/fixtures/properties-panel.html`, with real HTML and object stages (custom volume property), plus an independent `stage: false` editor.
- Browser scenarios: `e2e/validation/properties-panel.spec.ts`. Strict per-page error arrays collect every page error, console warning/error and failed request URL without filtering.
- Responsive captures: 320, 768, 1024 and 1440px, including keyboard Apply, real undo/redo shortcuts and scroll reachability.
- Persisted `pagehide/pageshow` transitions are modeled with synthetic events. These tests do not claim a native browser BFCache round trip.
- Browser coverage currently uses the repository's Chromium project; Firefox, WebKit and a separate automated accessibility scanner have not been run for this scoped change.

## RED / GREEN evidence

1. Initial RED: after a minimal typed contract, the permanent test failed because the root's second child `.jt-properties-panel` was absent (expected `true`, received `undefined`). The first implementation produced GREEN.
2. Reentrancy RED: metadata callbacks changing selection, document or frame during confirmation created an unwanted history entry (expected `canUndo === false`, received `true`). A pure post-read context check and refresh generation guard fixed all three cases; related playback and nested repaint regressions also pass.
3. Responsive RED: at 320px the narrow toolbar made `document.scrollWidth === 402` for a 320px viewport. Plugin-owned toolbar overflow fixed the issue without changing the shell plugin.
4. Accessibility RED: a custom descriptor with an empty or whitespace-only label produced an input without an accessible name. Two permanent regressions now pass with the property-name fallback.
5. Focused Jest GREEN: 47 tests pass. Coverage of panel TypeScript files: statements 96.20%, branches 91.28%, functions 98.03%, lines 99.57%.
6. Focused Chromium GREEN: all 14 scenarios pass with no captured browser problems, followed by three consecutive repetitions (42/42, no retries).

Commands executed from the isolated S1 worktree (ordinary shells):

```powershell
npm test --workspace packages/editor -- --runInBand --runTestsByPath src/plugins/properties/panel/__tests__/PropertiesPanelPlugin.test.ts --coverage --collectCoverageFrom=src/plugins/properties/panel/*.ts
npm run typecheck --workspace packages/editor
npm run typecheck --workspace demo/runtime
npm run typecheck --workspace e2e
npx eslint packages/editor/src/plugins/properties/panel demo/runtime/src/fixtures/propertiesPanel.ts demo/runtime/src/fixtures/propertiesPanelTypes.ts e2e/validation/properties-panel.spec.ts
npm run build --workspace packages/editor
npm run build:demo --workspace packages/editor
npm run build:demo --workspace demo/runtime
$env:CI='1'
$env:E2E_EDITOR_PORT='9350'
$env:E2E_RUNTIME_PORT='9351'
npm run e2e --workspace e2e -- validation/properties-panel.spec.ts --workers=1 --retries=0 --repeat-each=3
```

The parent owns shared exports, exact export tests, Vite input, demo navigation, the plan checkbox, full repository gates and independent ECC reviews. This implementation role does not claim those reviews, commit or create a PR.


