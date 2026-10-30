<!-- doc/integration/timeline-ha3-api.md -->
# HA3: production property editing UI

Status: implementation on `v2/HA3-property-rows-selection`, based on HA2
(`afcdb6b`). Local verification and ECC reviews are complete. This document describes
implemented interfaces, not an npm release. HA-TL-001 remains the target contract.

## Shared editing context

Plugins receive `ctx.propertyTimelines` during `init`. It is the same instance as
`editor.propertyTimelines`; changes have one shared undo stack and one
`property:changed` notification per committed property diff.

`propertyTimelines.guarded(isCurrent)` derives a facade for a UI confirmation.
Its read-only predicate runs before and after the initial command evaluation.
False or an exception refuses the edit without adding history. This protects
against host metadata callbacks changing selection, time, document or lifecycle
while a dialog or inspector is confirming a draft. Redo still checks permissions
but does not require the obsolete UI selection. Derived facades share observers;
calling `guarded` does not install another event subscription.

## Rows and selection

`frames.grid.rows()` returns `IVisibleRow` entries:

- Nodes: `kind: 'layer' | 'folder'`, with their document ID.
- Properties: `kind: 'property'`, opaque `id`, real `layerId`, `property`,
  `parentId`, `depth` and geometric `index`.

Resolve a row through this projection. Never parse a property row ID or pass it
as a layer ID to an editing command. Property rows exist only for tracks with
explicit keys. Names use the track label or property metadata, then the property
identifier as a fallback.

`layers.list.rows()`, `row()` and `rowIdAt()` remain node-only APIs. Its
`visibleRows()` includes property geometry; `setPropertiesExpanded(layerId,
expanded)` changes the manual view preference. Selecting an object temporarily
expands its properties, then restores its manual preference on deselection.
Selection and expansion do not mutate the document or enter undo history.

`frames.selection.cells()` keeps the existing `rowId/frame` shape. Modern
selection carries its owning layer and property. `propertyKeyframes()` returns
`ISelectedPropertyKeyframe` entries with `rowId`, `layerId`, `property`, `frame`.
The existing `keyframes()` returns only historical span keys with real `spanId`s.
Selecting a property also selects its owner in `layers.selection`.

## Editing and easing

F6 captures the evaluated value on the property row. Inserting inside an existing
transition preserves its source curve exactly. Dragging a property key uses the
HA2 move command; Escape, blur or changed selection cancels the preview. Deleting
a key attached to a transition is refused until that transition is removed.

The MotionTween action requires exactly two adjacent keys of the same property.
Toolbar, context menu and service use the same capability checks. Three keys,
multiple properties, locked objects and noninterpolable values are refused.
Independent transition notifications are `tweens:propertyMotionCreated` and
`tweens:propertyMotionRemoved`, with `PropertyMotionTweenEvent`; they do not invent
a historical span ID.

`tweens.easing` adds the following methods alongside the historical span methods:

```ts
interface IPropertyEasingTarget {
  readonly layerId: string;
  readonly property: string;
  readonly transitionId: string;
}
// availability includes a French reason when disabled
service.canSetProperty(target);
service.openProperty(target);
service.setProperty(target, easing); // omit easing for linear
```

The context menu opens the production dialog for the clicked transition. It
offers all HA1 families, three modes, validated parameters and custom Bézier
points. The graph uses the runtime evaluator and displays overshoot. A retained
split curve is shown as its actual segment; opening, cancelling or confirming
an unchanged dialog preserves that source. Applying a changed effect affects
only the selected transition and creates one undo entry.

The optional numeric inspector edits existing independent numeric tracks,
including custom properties without a registry descriptor. It reads the evaluated
value and respects current host capabilities. Rich CSS property controls remain
the responsibility of HtmlAnimation's reusable inspector.

## Current boundaries and reusable demonstration

Modern F5/F7 and the historical span clipboard do not represent independent
properties: they refuse these rows rather than silently changing legacy data.
The HTML adapter and selector precedence work are HA4; exports are HA5/HA6.
HA3 does not claim these later capabilities or change package versions.

`demo/editor/property-editor.html` uses the production plugins and a generic
object stage rendered on canvas. The API-only demonstration is retained at
`property-timelines.html`. Playwright scenarios in `property-editor.spec.ts` and
`property-editor-easing.spec.ts` operate the real controls and preserve screenshots
and JSON evidence for demonstrations.
