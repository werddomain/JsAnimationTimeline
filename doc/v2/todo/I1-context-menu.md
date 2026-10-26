<!-- doc/v2/todo/I1-context-menu.md -->
# I1: context menus

Base: `63e77d5ab8d3281437b555615a09eda23b54c594`, branch
`v2/I1-context-menu`. The parent owns default registration, public exports,
Vite inputs and final review. I1 remains pending the actual W3 base merge and
its optional easing action; no future service declaration or cast was added.

## Behavior

- `interaction.contextMenu` handles the owned frame grid and layer rows. A right
  click on a selected cell/row preserves the multiple selection; an outside
  target becomes the selection before action availability is computed. Native
  inputs, textareas, selects and contenteditable areas retain browser menus.
- Frame commands delegate to `frames.keyframes`, `tweens.motion` and optional
  `frames.clipboard` (existing memory clipboard). Delete uses T2's
  `computeKeyframeActionsState`: property-only, mixed and whole-tween targets
  preserve the existing command semantics and French labels.
- Layer creation, deletion, folders, grouping, ungrouping and inline rename
  delegate to the corresponding services. Rename and deletion remain permitted
  on locked layers. Layer/ancestor locks protect image mutations through the
  existing service verdicts.
- Show/hide/lock-other actions exclude selected node IDs and visit the other
  document nodes recursively, following the legacy scope. Unchanged flags are
  filtered before beginning a command group. A real refusal rolls back the
  whole batch; success creates one undo entry. An existing group is never
  joined, ended or cancelled by I1.
- Shift+F10 and ContextMenu open the same menu. ARIA menu/menuitem semantics,
  arrows, Home/End, Enter/Space and Escape support keyboard use. Disabled
  reasons use `aria-description`; activation rereads the current services.
  Closing restores connected focus only while focus still belongs to this
  menu. Restoration happens before invoking actions that move focus, such as
  inline rename or the future W3 dialog.
- Outside presses/focus, actual scrolling, resize, document/selection
  invalidation and destruction remove the portal and listeners. All menu
  styles remain under `.JsTimeLine`, including the viewport-bounded portal.

## TDD and browser regressions

The initial real-editor RED had three failing assertions: opening/selecting a
row, the other-layer undo batch and Shift+F10 focus. The first implementation
passed those four tests.

Two later browser defects received independent unit RED/GREEN evidence:

1. The layer selection service flushes pending row focus after contextmenu
   reaches the editor. Its event can change only `focused`, with identical
   selected IDs. Closing on that event removed a legitimate multiple-selection
   menu. I1 now invalidates only when the selected IDs change.
2. Scrolling a target into view can queue a scroll event that arrives after
   menu opening. I1 records positions at opening and ignores a notification
   with no subsequent movement. A real page/editor scroll still closes it.

Logs are under
`C:/Users/clefw/.codex/visualizations/2026/10/24/01a16ee6-87dd-73f0-a391-90854a1767c5/next-editor-validation/`:

- `i1-focus-red.log`: one failing focus-flush regression, four passes.
- `i1-focus-green.log`: 23 passes after the focus fix.
- `i1-scroll-red.log`: one failing queued-scroll regression, nine passes.
- `i1-scroll-green.log`: 24 passes after the scroll fix.
- `i1-unit-coverage.log`: 26 passes; 98.58% statements, 92.24% branches,
  100% functions, 99.13% lines. Every production module exceeds 80% in all
  four metrics.
- `i1-browser.log`: 14 passing Chromium tests, no retries. The permanent suite exercises real right clicks,
  multiple selection, F6/F7, undo/redo, sample and rendered motion, deletion
  routing, memory copy/paste, layers/groups/rename, locks, grouped flags,
  native editing, keyboard, dismissal and two-editor isolation.
- `i1-build-demo.log`, `i1-lint.log` and `i1-conventions.log`: runtime demo
  build, scoped ESLint and repository header conventions.

The permanent fixture is `demo/runtime/fixtures/context-menu.html`, with a
typed read-only `window.contextMenuReview` inspection handle. The Playwright
suite is `e2e/validation/context-menu.spec.ts`, run with `CI=1`, one worker,
no retries and dedicated ports 9354/9355. Console warnings/errors, page errors,
failed requests including URLs, and HTTP errors are collected per Page.
Viewport screenshots are preserved at 320/768/1024/1440 under `i1-playwright`.
Full-page capture would resize the viewport and correctly dismiss a fixed
menu, so menu captures use the actual viewport.

The motion assertion follows W1's existing span contract: the generated first
span runs from frame 1 through frame 8, so at frame 3 its position is
`120 * 2 / 7`. Both runtime sampling and the rendered transform are checked
with an explicit floating-point tolerance.

Editor, demo/runtime and e2e typechecks passed. Browser coverage in this pass
is Chromium only. General, security and TypeScript reviews, the complete
repository gate and PR creation remain the parent's responsibility. This
record does not claim those reviews or completion of the pending W3 action.
