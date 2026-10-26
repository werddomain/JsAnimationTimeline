<!-- doc/v2/todo/W2-property-keyframes.md -->
# W2 — Property keyframes service

`PropertyKeyframesPlugin` publishes `tweens.propertyKeyframes` after its
`tweens.motion` dependency. It adds no panel, slot or renderer. The existing
frame grid renders diamonds from the document's tween property tracks;
multiple properties keyed at one frame produce one diamond.

```ts
const properties = editor.getService('tweens.propertyKeyframes');
properties?.propertiesFor('logo');
properties?.setProperty('logo', 'x', 75, { frame: 6 });
```

## Service contract

`propertiesFor(layerId)` returns fresh registered property descriptors allowed
by that layer's current target metadata. Missing layers and folders return an
empty list. Locks do not hide capabilities: inspection remains available for
locked layers, while mutations still respect direct and ancestor locks.
Descriptors come from the editor's registry, in registry order. The returned
list is frozen; per-target labels and units do not replace registry descriptors.

`setProperty(layerId, name, value, options?)` executes the exact core
`SetPropertyCommand`. It shares the public editor API's validation, immutable
document updates, no-op detection and undo history. Omitting `options.frame`
uses the current integer frame. Tween edits add or replace only the requested
property key at that absolute frame; static edits use the span's start. No
span splitting, duration growth or easing conversion occurs. A new explicit
key changes the document even when its value matches the sampled value.

The service is removed on destruction, and retained service handles reject
subsequent queries and edits. Core `IEditor.setProperty()` continues working
with `defaultPlugins: false` and `stage: false` independently of this plugin.

## Shared target metadata lookup

`core/stage/targetInfo.ts` is an internal extraction of the core host's existing
strict target lookup. It is not a root package export and adds no member to
`IEditorContext`. The core host and plugin use the same routing and metadata
rules, without calling `resolve()` or inspecting animated objects.

The lookup chooses the routed stage first, then reads its `describe()` metadata
and falls back to that stage's own target list when properties are absent.
Scoped and unscoped references alias each other only within that chosen stage.
Capabilities are never borrowed from another stage that happens to publish the
same reference. Missing property metadata allows registered properties; an
explicit list restricts edits to registered listed names, and `[]` denies all.
No capability list is cached between calls or command executions.

An exception in `accepts`, `describe` or `list` makes service discovery throw
`PropertyOperationError`. The shared command converts the same failure during
mutation into `command:refused`, preserving document and history. A refused
redo remains retryable once metadata is repaired. The core public description
query retains its guarded reporting behavior; strict core edits report the
underlying stage failure once and refuse the edit.

## Permanent validation

The preimplementation Jest test failed at runtime because the default editor
had no `tweens.propertyKeyframes` service. Focused tests cover command identity,
one-track edits, explicit-key/no-op semantics, static writes, custom inherited
property names, frozen descriptors/documents, history restoration, permissions,
target changes, aliases, scene collisions, metadata failures and destruction.
The existing core property API suite checks the extracted lookup for regressions.

`demo/runtime/fixtures/property-keyframes.html` exposes typed
`window.propertyKeyframes` handles and French controls for both API and service
edits. It runs the real editor grid, real HTML stage and real object stage. Its
metrics count actual stage `render()` calls. The corresponding permanent
`e2e/validation/property-keyframes.spec.ts` checks visible diamond geometry,
deduplication across properties, unchanged tracks/bounds, sampled and rendered
values, undo/redo, restrictions, ancestor locks and keyboard shortcuts.

The fixture's `pagehide` handler preserves editors on persisted transitions and
destroys them on final departure. Browser tests use per-page strict collectors
for page errors, console errors and failed requests, without error filtering.

The property panel remains S1 scope. Runtime evaluation, easing time mapping,
legacy behavior and keyframe dragging are unchanged by this task.
