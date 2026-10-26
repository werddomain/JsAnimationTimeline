<!-- doc/v2/todo/W2a-property-contract.md -->
# W2a — Core property edit contract

This prerequisite establishes `IEditor.setProperty()` before the W2 property
controls. It does not complete W2 or add its plugin.

```ts
editor.setProperty(layerId, name, value, { frame: 6 });
editor.setProperty(layerId, name, value); // current integer playback frame
```

The method works with `defaultPlugins: false` and with `stage: false`. It
returns `true` only when the document changes. A valid edit is one undoable
command in the editor's existing history. After destruction it throws, as do
the editor's other public methods.

## Stored document behavior

- The requested frame must be an integer in `1..totalFrames`. No duration
  growth or automatic frame clamping occurs.
- In a tween, only the requested property's key is inserted or replaced at
  that absolute frame. Keys remain sorted and unique. Other tracks, span
  boundaries, IDs and easing remain unchanged.
- In a static span, the property value is written at `span.start`. The span
  remains static, without splitting or conversion to a tween.
- An existing key with the identical numeric value is a no-op: `false`, no
  history entry, no `command:refused`. Inserting a new explicit key changes
  the document even when its value equals the current interpolated value.
- Names must exist in the editor's registry and values must be finite
  numbers. Stored values are not clamped to descriptor bounds; evaluation
  and rendering keep their existing semantics.
- A missing layer, a folder, a layer locked directly or through an ancestor,
  a blank span, or an uncovered frame is refused. Refusals return `false`,
  preserve the document and history, and emit `command:refused` with a French
  reason. Plugins may also veto through `command:before`.

Nonlinear easing remaps time across a tween. A key written at frame N does
not promise that `sample(N)` returns its value. The command stores the key at
N and preserves easing; it does not invert or replace the runtime curve.

## Shared implementation and target policy

`model/properties/propertyValue.ts` contains the immutable operation;
`SetPropertyCommand.ts` adapts it to undo/redo. The command checks the current
document, including locks and the current layer target, on every execution
and redo. Undo restores the exact previous layer without reevaluating its
permissions. A refused redo leaves the redo entry available for retry.

`getTargetPropertyNames()` in `targetProperties.ts` is the central permission
policy for this API and the future W2 controls. Registry and runtime metadata
queries are injected through `IPropertyEditContext`; the model does not depend
on plugins or on DOM resolution.

The policy reads `stage.describe(target).properties`, then falls back to a
matching `stage.listTargets()` entry if the described property list is absent.
Matching uses the runtime's structural `sameTarget()` helper. An explicit
list restricts edits to its registered names: both strings and property info
objects are accepted, unknown names are excluded, and `[]` denies all edits.
Without a property list, all registered names are allowed. This supports the
real HTML stage, whose target metadata has no property lists, and editors
without a stage. No permission list is cached between commands.

Property-track access checks own properties, so a registered `toString` name
works even when no corresponding own track exists.

## Permanent validation

The focused Jest suites cover pure edits, no-ops, validation, inherited names,
unchanged neighboring tracks, easing, locks, current target metadata, fallback
lists, undo/redo restoration and atomic refused redo. Public editor tests also
cover `defaultPlugins: false`, stage-free operation, current-frame defaults,
document freezing, reentrant lock changes and destruction.

`demo/runtime/fixtures/property-api.html` is a permanent browser fixture with
typed `window.propertyApi` handles. It creates a real HTML editor, an editor
without a stage and an editor using the runtime's real `createObjectStage()`
with replaceable property metadata. `e2e/validation/property-api.spec.ts`
checks public edits against document keys, `sample()`, computed HTML transforms,
undo/redo, static spans, refusals, inherited locks and dynamic object permissions.

The first preimplementation public API test failed at runtime because
`setProperty` was undefined. The implemented focused Jest suites pass, with
100% statement, branch, function and line coverage of the three property
modules. Browser results and integration checks are recorded with the change's
validation artifacts; W2 remains pending.

The editor host resolves target metadata within the actually routed stage. Its
list can fill absent descriptions or absent property capabilities, including
unscoped ref aliases, while retaining an explicit empty permission list and any
directly described label. A second stage publishing the same ref never supplies
the first stage's capabilities. Standalone query helpers retain exact target
matching rather than guessing a route from a global target list.

The fixture's page-cache test models persisted transitions explicitly and checks
all three editors remain usable, then a nonpersisted departure destroys them.
This does not claim native BFCache coverage. The strict error collectors retain
failed-request URLs and capture an independent error array for each page.
