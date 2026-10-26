# W3 — Span easing presets

W3 adds the `tweens.easing` plugin to the v2 editor. The French preset dialog replaces the easing interaction of the legacy tween dialog for v2 callers; legacy sources remain unchanged. The plugin is registered with the tweens epic and exposed by the editor package.

## Service and command

`editor.getService('tweens.easing')` exposes:

- `canSetAt(layerId, frame)`: `{ enabled, reason? }`, with a French refusal reason.
- `setAt(layerId, frame, easing)`: an undoable span-wide change; `false` for a refused or identical choice.
- `openAt(layerId, frame)`: open the preset dialog for the containing tween, or return `false` for an unavailable target.
- `close()`: discard the pending dialog without editing the document.

The setter accepts runtime-valid `Easing` values, including imported `cubic-bezier(...)` strings, using the runtime parser. The dialog offers exactly the runtime presets: `linear`, `ease`, `ease-in`, `ease-out`, `ease-in-out`. An imported custom curve remains selected as a disabled placeholder; Apply stays disabled until the user explicitly chooses a preset. Opening or cancelling preserves the original curve byte for byte.

`createSetEasingCommand(layerId, frame, easing, expectedSpanId?)` and `setSpanEasing(...)` are available for command consumers. Only `span.easing` changes. Tracks, property keys, span IDs, layer fields and target references retain their identity. Effective linear-to-linear and identical explicit choices return the original document, creating no history entry. Undo restores the precise original layer, including absence of an explicit easing field; redo validates against the current document.

Frames must be integers in the document range and must belong to a tween. Missing layers, folders, blank/static spans, invalid easing and locks on the layer or any ancestor are refused atomically through `CommandRefusedError`. Commands resolve current data during `do`, including after `command:before`, and an expected span ID prevents editing a replacement span.

## Existing runtime semantics

The runtime continues to remap time across the **entire span** before reading each property track. A W2 property key stored at frame N therefore need not evaluate to its stored value at frame N after nonlinear easing is selected. W3 preserves the stored keys and uses the existing evaluator; it does not invert curves, move keys or introduce per-property easing. Span endpoints retain their values. Reference targets and value properties continue to use their existing stage and registry behavior.

## Dialog lifecycle and accessibility

The dialog has an associated title/description, a labelled native preset select, `role="dialog"` and `aria-modal="true"`. Initial focus goes to the select; Tab and Shift+Tab wrap within enabled controls. Escape and Cancel discard the choice. The connected prior focus is restored when this dialog owns focus; destroying another editor cannot steal focus from an active dialog.

Each editor owns its portal, service and listeners. The portal uses the host's `ownerDocument` and `defaultView`, and retains `.JsTimeLine` styling outside clipped editor containers. Any document load/change or frame/layer selection change closes pending confirmation. Confirm and command execution validate the current tween and locks again. Initialization failure and destruction remove subscriptions, DOM nodes and handlers.

## Validation evidence

Tests were authored first. No-op typed contracts produced a meaningful unit RED: **23 failed, 1 passed**. The built default-plugin browser fixture then produced browser RED: the expected focused preset combobox did not exist after the fixture's open button. A later multi-editor focus-steal regression was also reproduced as RED before correction.

Final focused results:

- **33 unit/integration tests** across commands, service, dialog lifecycle and exports.
- W3 coverage excluding tests: **97.93% statements, 89.58% branches, 100% functions, 99.49% lines**.
- **7 Chromium scenarios**, including real keyboard preset selection and Apply, changed middle-frame computed HTML and `editor.sample`, unchanged endpoints/tracks, exact undo/redo, Cancel/Escape/focus, and a lock changed while the dialog is open.
- Responsive dialog captures at **320, 768, 1024 and 1440 px**.
- Per-page error collectors check page errors, console warnings/errors and failed-request URLs without filtering.
- Editor, runtime-demo and E2E typechecks; scoped lint with zero warnings.

The permanent fixture is `demo/runtime/fixtures/easing.html`; the browser suite is `e2e/validation/easing.spec.ts`. Browser validation uses the built demos on `E2E_EDITOR_PORT=9352`, `E2E_RUNTIME_PORT=9353` and `CI=1`. Set `E2E_VALIDATION_ARTIFACT_DIR` to collect `w3-*.png`; otherwise artifacts go to Playwright's test output. Samples are attached as `w3-easing-samples.json`.

Run focused tests with:

```text
npm test --workspace packages/editor -- --runInBand --testPathPatterns=plugins/tweens/easing
npm run build:demo --workspace packages/editor
npm run build:demo --workspace demo/runtime
npm run e2e --workspace e2e -- validation/easing.spec.ts --retries=0
```

Final general, security and TypeScript reviews plus the full repository gate belong to the parent integration task. No publication is part of W3.
