# Timeline document format v2

`timeline.schema.json` (JSON Schema draft 2020-12) describes the documents
edited by `editor` and played by `runtime`. It follows the Flash CS4
**motion tween** model (see `doc/v2/rapport-analyse.md`, section 4.1). The
TypeScript types live in `packages/runtime/src/model/` and are exported by the
`runtime` package.

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

## Decisions

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
