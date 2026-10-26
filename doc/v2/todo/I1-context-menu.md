<!-- doc/v2/todo/I1-context-menu.md -->
# I1: context menus

Base: `63e77d5ab8d3281437b555615a09eda23b54c594`, branch
`v2/I1-context-menu`. The parent owns default registration, public exports,
Vite inputs and final review. W2/W3 were integrated from the actual base at
`0bc812de704fd5565900f74a4c48b59e6d73ec3d`; I1 now consumes the real optional
`tweens.easing` service without a hard plugin dependency or duplicate contract.

## Behavior

- `interaction.contextMenu` handles the owned frame grid and layer rows. A right
  click on a selected cell/row preserves the multiple selection; an outside
  target becomes the selection before action availability is computed. Native
  inputs, textareas, selects and contenteditable areas retain browser menus.
- Frame commands delegate to `frames.keyframes`, `tweens.motion` and optional
  `frames.clipboard` (existing memory clipboard). Delete uses T2's
  `computeKeyframeActionsState`: property-only, mixed and whole-tween targets
  preserve the existing command semantics and French labels.
- On a tween, optional `tweens.easing` adds `Modifier l’accélération`, using
  its current `canSetAt` verdict and refusal reason. It targets only the span
  under the context click, preserving any multiple selection. Without W3 or
  outside a tween, the entry is absent. The menu closes and restores focus
  before `openAt`, so the new dialog keeps focus.
- Layer creation, deletion, folders, grouping, ungrouping and inline rename
  delegate to the corresponding services. Rename and deletion remain permitted
  on locked layers. Layer/ancestor locks protect image mutations through the
  existing service verdicts.
- Show/hide/lock-other actions protect selected nodes, all their ancestors
  and the complete subtree of each selected folder. Unselected sibling
  branches remain eligible. Unchanged flags are filtered before beginning
  a command group. A real refusal rolls back the whole batch; success creates
  one undo entry. An existing group is never joined, ended or cancelled by I1.
- Shift+F10 and ContextMenu open the same menu. ARIA menu/menuitem semantics,
  arrows, Home/End, Enter/Space and Escape support keyboard use. Disabled
  reasons use `aria-description`; activation rereads the current services.
  Closing restores connected focus only while focus still belongs to this
  menu. Restoration happens before invoking actions that move focus, such as
  inline rename or the W3 dialog.
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
record does not claim those reviews.

## Detached DOM cleanup, 2026-10-26

The parent checkpoint `5f6f4bb40330865cf2b93a1b8fc1211447d86b92`
included the newly reproduced stale-DOM regression. Removed menu elements
still retained their click/keydown handlers: an old button reference could
invoke an action, attempt focus navigation or close a subsequently opened menu.
`MenuController.close()` now unregisters both element handlers through the
same cleanup list as its document/window subscriptions.

The added keyboard regression verifies that stale Home/Escape events are not
handled, never attempt focus and leave the current menu/focus intact. Evidence
in the same artifact folder:

- `i1-stale-dom-red.log`: original click regression, one failure.
- `i1-stale-dom-focus-red.log`: click and keyboard regressions, two failures.
- `i1-stale-dom-green-coverage.log`: 28 tests pass. Coverage is 98.61%
  statements, 92.24% branches, 100% functions and 99.15% lines; every production
  module remains above 80% in every metric.
- `i1-stale-dom-browser.log`: 14 Chromium tests pass, one worker, no retries,
  with strict per-page collectors. New viewport captures are under
  `i1-stale-dom-playwright`.
- `i1-stale-dom-build.log`, `i1-stale-dom-typecheck.log` and
  `i1-stale-dom-lint.log`: demo rebuild, editor typecheck and scoped lint pass.

That cleanup pass changed only MenuController, its test and this record. The
parent committed it as `ff432da` before integrating the actual W3 base.

## Optional W3 integration, 2026-10-26

The action imports the real W3 type augmentation and obtains its service
through `services.get('tweens.easing')`. It never requires or declares a future
service. A two-tween multiple-selection regression clicks the second tween and
proves the first is unchanged, while preserving all selected cells. Layer and
ancestor locks use W3's current availability and accessible disabled reason.

A separate lifecycle RED confirmed that restoring focus could synchronously
remove the editor before the captured action ran. After closing the menu,
activation checks that its editor root remains connected. The review follow-up
below additionally cancels activation when restoration invalidates the target.
The regression verifies that no menu portal or retained event handler remains.

Final focused evidence in the artifact folder above:

- `i1-easing-red.log`: four meaningful failures (missing action/availability
  and focus-restoration lifecycle), with 15 passes.
- `i1-easing-green.log`: 33 unit tests pass.
- `i1-easing-coverage.log`: 98.64% statements, 92.43% branches, 100% functions,
  99.16% lines. Each production module exceeds 80% in every metric.
- `i1-easing-browser.log`: 16 Chromium tests pass on ports 9354/9355, with
  `CI=1`, one worker, no retries and empty per-page problem collectors.
- `i1-easing-build.log`: the runtime demonstration rebuild passes.

The new real-browser path opens the context menu on a tween while multiple
cells are selected, enters W3's dialog, applies `ease-in`, compares runtime
sampling with the rendered transform, preserves tracks/other layers and
restores exact documents with undo/redo. Cancel and Escape preserve the
document and focus. No W3 fixture was changed.

The navigation regression starts from the runtime index, verifies the four
preserved support links and enters the context-menu fixture through its link.
The parent owns the accompanying changes to `demo/runtime/index.html` and
`doc/v2/validation/README.md`; those shared files belong in the final review.

Editor, demo/runtime and e2e typechecks and scoped ESLint pass. No commit, PR,
complete repository gate or recursive review was performed in this pass.

## Review corrections after checkpoint 22a9775, 2026-10-26

Two P2 findings were reproduced before changing production code:

- Selecting an inner child and hiding or locking other layers also modified
  its parent folders, so inherited flags affected the selected child itself.
  The exclusion set now includes every selected node's ancestors and the
  descendants of selected folders. It does not exclude unselected siblings
  merely because their parent is protected. Nested unit regressions cover
  show/hide/lock and verify an image edit on the protected child succeeds,
  with exact undo for both that edit and the single flag batch.
- Focus restoration could synchronously select B after opening Delete on A,
  while the editor stayed connected; the previously resolved action then
  deleted B. Every close now advances a generation before restoring focus and
  returns that captured token. Activation requires an unchanged token after
  restoration. Selection/document invalidation or a new menu cancels the old
  activation; it never resolves the action again against a new selection.
  Focus-only changes with identical selected IDs remain valid.

Opening another menu from a focus handler also exposed a bubbling older
`focusin` notification that closed the newly opened menu. Focus dismissal
now checks the current DOM active element, preserving that newer menu.

Evidence in the same artifact directory:

- `i1-review-red.log`: eight failing assertions and two passes before the
  production corrections; actual wrong inherited flags, deletion of B,
  deletion after document change, and execution after a new menu opened.
- `i1-review-browser-red.log`: the real right-click hide-other action changes
  the selected child's folder to `visible: false`.
- `i1-review-focus-red.log`: the newer-menu focus regression fails while the
  other nine review regressions pass.
- `i1-review-green.log` and `i1-review-coverage.log`: 43 passing unit tests,
  98.68% statements, 92.63% branches, 100% functions, 99.19% lines. Each
  production module remains above 80% in every metric.
- `i1-review-browser-green.log`: 17 Chromium tests pass, one worker, no
  retries, `CI=1`, ports 9354/9355, strict per-page collectors empty.
- `i1-review-build.log`, `i1-review-typechecks.log` and `i1-review-lint.log`:
  demo rebuild, editor/demo/e2e typechecks and scoped ESLint pass.

The I1 fixture gives its existing child a real HTML target while retaining
the initially locked ancestor. The new browser test unlocks that ancestor
through its real menu, selects either the child or folder, hides/locks others,
checks actual child visibility and image editing, and undoes each batch to
the exact baseline. The initial unlock is then undone to the initial document.
Viewport captures remain under `i1-review-playwright` at the four widths.

This pass changes only context-menu production/tests, its fixture, its
Playwright suite and this record. No shared integration file, commit, PR or
complete repository gate was changed or run by the worker.
