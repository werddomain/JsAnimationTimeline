<!-- schema/README.md -->
# Timeline document format v2

`timeline.schema.json` (JSON Schema draft 2020-12) describes the documents
edited by `editor` and played by `runtime`. It follows the Flash CS4
**motion tween** model (see `doc/v2/rapport-analyse.md`, section 4.1). The
TypeScript types live in `packages/runtime/src/model/` and are exported by the
`runtime` package.

`html-animation-context.schema.json` separately describes the optional version-1
HTML context saved beside that document: CSS bindings, stable gradient definitions
and explicit conflict decisions. It adds no HTML fields to the generic timeline or
its .NET models. Validate its JSON shape with this schema, then call
`cloneHtmlAnimationContext()` for gradient/stop cross-references, unique gradient,
stop and conflict identifiers, and safe detached in-memory data. The runtime also
rejects accessors, cycles and non-finite values. Conflict signatures and the
applicability of a `beforeFirst` decision are rechecked against the actual document
by the HTML resolution plan; schema validation alone cannot authorize a stale
decision. The host owns the context's project history and persistence.

`playback-document.schema.json` describes the separate version-1 compiled playback
format. It stores `sampling: "frames"`, timing, distinct source objects and a full
snapshot of recorded properties at every integer frame. `parsePlayback()` also
checks exact object/frame coverage, stable property kinds, resource budgets and
safe detached data. Seeking uses the preceding integer frame; this format does
not replace the editable document or its exact fractional evaluation.

`html-playback-document.schema.json` adds a separate HTML playback document. Its
`source` is a generic playback document; its selector groups and resolved CSS
frame table are the rendering authority for HTML, including priority decisions.
Load both playback schemas into a schema validator to resolve that reference.
`parseHtmlPlayback()` checks group/frame references and aggregate budgets; the
HTML player verifies actual selector matches and browser CSS support before
writing managed inline declarations. These formats add no fields to the editable
timeline or its .NET model.

## Structure

```text
ITimelineDocument  { version: "2.x.y", settings: { fps, totalFrames }, layers: LayerNode[] }
LayerNode          = Layer | Folder            (discriminated by "type")
Layer   (type "layer")   id, name, color?, visible?, locked?, icon?, target?: { selector } | { ref, stage? }, spans: Span[]
Folder  (type "folder")  id, name, color?, visible?, locked?, collapsed?, children: LayerNode[]
Span                     id, start, end, kind: "static" | "blank" | "tween", easing?, tracks?
tracks                   { [propertyName]: { frame, value }[] }
easing                   "linear" | "ease" | "ease-in" | "ease-out" | "ease-in-out" | "cubic-bezier(x1, y1, x2, y2)"
```

- `static`: content keyframe; the target holds the values set at `start`.
- `blank`: the target is hidden during the span (no tracks, no easing).
- `tween`: motion tween; each property has its own keyframes (the diamonds),
  and the easing applies to the whole span.

Examples: `examples/minimal.json`, `examples/tween-and-static.json` (the example
of the analysis report), `examples/folders.json`.

## Independent property timelines

Layers may add `propertyTimelines`, a dictionary keyed by property name. These
tracks use explicit typed values and do not require a browser or a property
registry. Legacy `spans` remain supported unchanged. One property cannot appear
in both `propertyTimelines` and a legacy span's `tracks` in the same layer.

```json
{
  "propertyTimelines": {
    "opacity": {
      "initialValue": { "kind": "number", "value": 1 },
      "keys": [
        { "frame": 1, "value": { "kind": "number", "value": 0 } },
        { "frame": 100, "value": { "kind": "number", "value": 1 } }
      ],
      "transitions": [{
        "id": "fade", "fromFrame": 1, "toFrame": 100,
        "easing": { "kind": "effect", "family": "sine", "mode": "in-out" }
      }]
    }
  }
}
```

Values are closed objects: `{kind:"number",value:number}`,
`{kind:"text",value:string}`, `{kind:"boolean",value:boolean}`, or
`{kind:"color",r,g,b,a}` with every channel normalized to 0..1. Numbers are
finite. A property's value kind remains the same across its initial value,
keys, and preserved curve sources. `label` and `group` are optional metadata.

Keys use strictly increasing absolute frames in 1..`totalFrames`. A key holds
its value until the next key; interpolation happens only through an explicit
transition connecting two consecutive keys of that property. Before the first
key, `beforeFirst: "initial"` (the default) uses `initialValue`;
`beforeFirst: "first-key"` uses the first key's value. With no keys, both use
`initialValue`. Transitions have unique ids and cannot overlap. Only number
and color properties support transitions; text and boolean keys are discrete.

A transition's optional `source` preserves an original curve after splitting:
`{start,end,keys,easing?}`. It contains the transition interval, has keys at both
bounds, and shares the property's value kind. This snapshot has no nested
source and preserves the original timing curve instead of restarting it for
each piece. Runtime state carries these values in optional `propertyValues`,
alongside the existing numeric `values` projection. The .NET stage bridge
preserves both fields and omits `propertyValues` for legacy layers.

A numeric source migrated from a legacy span uses `legacyEasing` (the original
CSS easing string) instead of `source.easing`. These two fields are mutually
exclusive. Such a source retains the original numeric keys and absolute frame
domain, including the legacy interpolator's arithmetic order. Editable keys
contain the values actually evaluated at their frames. This distinction prevents
an explicit migration or a subsequent split from changing fractional-frame
results. The transition may also retain the equivalent modern `easing` for
future edits that intentionally detach its preserved source.

Modern easing is either `{kind:"bezier",x1,y1,x2,y2}` or
`{kind:"effect",family,mode,parameters?}`. Bezier x coordinates are 0..1 and y
coordinates are -100..100. Modes are `in`, `out`, and `in-out`. Families are
`linear`, `sine`, `circle`, `quadratic`, `cubic`, `quartic`, `quintic`, `power`,
`exponential`, `back`, `bounce`, and `elastic`. Only the chosen family's
parameters are accepted:

| Family | Parameters and limits | Defaults |
| --- | --- | --- |
| power | power 0.1..20 | 2 |
| exponential | exponent 0..30 | 2 |
| back | amplitude 0..10 | 1 |
| bounce | integer bounces 0..32; bounciness 1..10 | 3; 2 |
| elastic | integer oscillations 0..32; springiness 0..30 | 3; 3 |
| Other families | No parameters | — |

All modern model objects reject unknown fields. JSON Schema checks structure,
types, and easing parameters; `validateDocument` additionally checks frame
ordering, duration, kind consistency, transition adjacency/overlap, preserved
source bounds, global identifier uniqueness, and legacy/modern conflicts.

## Legacy span decisions

- **Frames are absolute and 1-based** (like Flash), in spans and in keyframes;
  they are never relative to their span. Frames go from 1 to `settings.totalFrames`.
- **Spans of a layer are contiguous from frame 1**: sorted by `start`, each one
  starting at `previous.end + 1`. A gap is represented by a `blank` span. The
  layer may stop before `totalFrames` and may have no span at all.
- **Two serialised target forms, told apart by their key**: `{ "selector": "#logo" }`
  (HTML stage) and `{ "ref": "hero", "stage": "canvas" }` (resolved by a stage;
  `stage` is optional). The `{ element }` form exists only at runtime
  (`IElementTarget`) and is not part of the schema. A target has exactly one of
  the keys `selector`, `ref`, `element`; any future form gets its own key.
- **Property names** follow `^[a-zA-Z][a-zA-Z0-9]*$`, and `constructor` and
  `prototype` are reserved, so an imported file can never create a track that
  touches an object prototype. The runtime registry uses the same rule
  (`isValidPropertyName`). Names are checked against the registry by the
  runtime, not here; a name may be a CSS property or a plain `value` property
  (no CSS name, read by a stage).
- **Defaults** (applied by the `resolve*` helpers, never written into the document):
  `visible: true`, `locked: false`, `collapsed: false`, `easing: "linear"`, no tracks.
  `color` and `icon` have no default; the editor chooses.
- A property with no value in a span takes the last known value, otherwise the
  property default (evaluation rules belong to the runtime, task R2).
- `version` follows semver with major 2; this package writes `2.0.0` (`SCHEMA_VERSION`).

## Semantic invariants

`validateDocument(doc, { allowLiveTargets? })` accepts any value (e.g. a parsed
file) and returns `{ path, code, message }` issues (paths are JSON-pointer-like,
e.g. `/layers/0/spans/1/start`). It first runs a hand-written **shape check**
(`checkDocumentShape`, no ajv at runtime) that agrees with this schema (a test
runs both on the same documents): `invalid-type`, `missing-field`,
`unknown-field`, `invalid-version`, `out-of-range` (fps 1 to 240, totalFrames
and frames >= 1), `invalid-value`, `invalid-target`, `live-target`,
`invalid-property-name`, `non-finite-value`. `allowLiveTargets` defaults to
`true` (the player accepts `{ element }`); stores and importers pass `false`.

Only a well-formed document then gets the semantic rules the schema cannot
express:

| Code | Rule |
|---|---|
| `duplicate-id` | Ids are unique across the whole document (layers, folders, spans). |
| `span-invalid-range` | `end >= start`. |
| `spans-unsorted` | Spans of a layer are sorted by `start`. |
| `spans-not-contiguous` | `next.start === previous.end + 1` (no gap, no overlap). |
| `first-span-not-at-frame-1` | The first span of a layer starts at frame 1. |
| `span-exceeds-total-frames` | `end <= settings.totalFrames`. |
| `keyframe-out-of-span` | Each keyframe frame lies within its span `[start, end]`. |
| `keyframes-not-increasing` | Within a track, frames are strictly increasing (no duplicates). |
| `static-keyframe-not-at-start` | In a `static` span every keyframe is at `start` (so at most one per property). |
| `tracks-not-allowed` | A `blank` span has no tracks (also enforced by the schema). |
| `easing-not-allowed` | Only `tween` spans have an easing (also enforced by the schema). |
| `invalid-easing` | The easing parses (`parseEasing`); for `cubic-bezier`, x1 and x2 are in `[0, 1]`. |
