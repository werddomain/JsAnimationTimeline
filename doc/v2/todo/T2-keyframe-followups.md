<!-- doc/v2/todo/T2-keyframe-followups.md -->
# T2: keyframe action follow-ups

Preserved source: `v2/P2-followups-2` at `0a2e4213067d510b3045a93f8c10a8b961c2907e`.
`v2/T2-keyframe-followups` contains only the four files in
`toolbar/keyframeActions/` and this follow-up record. P2 remains isolated in
`v2/P2-preview-followups`. No new plan task was started.

## Behavior and scope

- Mixed selections containing a property keyframe and a tween start still use
  `frames.keyframes.deleteKeyframe()` over all targets. Existing CS4 semantics
  merge the targeted span into its predecessor and discard its tracks. This
  work changes the toolbar's label, not that command or its target set:
  property-only targets use `Supprimer l'image clé de propriété`; mixed
  targets use exactly `Supprimer l'image clé`. The integration regression
  checks the full resulting document and a single undo/redo history entry.
- Disabled tooltips name the action and give its reason. Delete is disabled
  on an ordinary frame, including playhead fallback with only a layer selected.
- Playhead ticks do not calculate toolbar state during playback, or while
  selected cells determine the target. Pause refreshes synchronously in both
  directions between ordinary frames and keyframes. Completion also refreshes
  when the final integer frame was already rendered during playback.
- Failed initialization removes all subscriptions without destroying the live
  editor. Every fixture editor is destroyed in `afterEach`, and each fixture
  returns its own event emitter.
- The obsolete W1 todo is now a regression for the existing W1 contract:
  creating the same two-keyframe tween again is unavailable; undo re-enables
  creation and redo disables it. `MotionTweenPlugin.test.ts` already specifies
  this refusal, and `createMotionTween.ts` implements `ALREADY_TWEEN`. No W1
  production code or contract was changed.

## TDD evidence

The isolated implementation was already present when this pass began: baseline
58 passing tests and one todo. New regressions were added before validating
the inherited fixes against their previous behavior; no additional model fix
was needed.

Logs are under
`C:/Users/clefw/.codex/visualizations/2026/10/24/01a16ee6-87dd-73f0-a391-90854a1767c5/phase3-validation/`:

- `t2-baseline.log`: 58 passed, one todo.
- `t2-red-base.log`: the two production sources temporarily restored from base
  `dee9e5f` produced 22 failures, 41 passes and one todo. The original isolated
  sources were restored immediately afterward.
- `t2-red-subscriptions.log`: removing only the pause/complete subscriptions
  caused both pause cases and the completion case to fail (three failures).
- `t2-red-rollback.log`: removing only initialization rollback caused its
  live-editor cleanup regression to fail (one failure).
- `t2-green-coverage.log`: final focused suite and coverage.
- `t2-typecheck.log` and `t2-lint.log`: editor typecheck and scoped lint.

Initial focused result: 64 passed, no todo. Combined coverage for the two production
modules: 97.26% statements, 89.52% branches, 98.07% functions and 99.44% lines.
Each module exceeds 80% in all four metrics. These checks cover T2 only.

## Review corrections, 2026-10-25

- Restored the structured English header keys accepted by the repository
  checker: `Depends on` and `Listens`. Dependencies match the literal array;
  the event list contains all eight subscriptions on one line because the
  existing parser reads single-line values only.
- The unchanged-state regression now emits an unchanged availability event
  through its fixture, asserts one state calculation, and observes attribute
  additions/removals and title setters on all four buttons. Frames 3 and 5
  exercise both unavailable and available keyframe actions. Repeating an
  identical selection no longer serves as the refresh trigger.
- `t2-review-red-conventions.log`: the existing repository convention test
  failed on the unrecognized dependency header before correction.
- `t2-review-red-dom-writes.log`: temporarily removing the three DOM-write
  guards caused both regression cases to fail; all guards were restored.
- `t2-review-green-conventions.log`: repository convention test passed.
- `t2-review-green-coverage.log`: 65 focused tests passed, no todo; coverage
  remains 97.26% statements, 89.52% branches, 98.07% functions, 99.44% lines.
- `t2-review-typecheck.log` and `t2-review-lint.log`: editor typecheck and
  scoped ESLint passed. No production behavior or public contract changed.

## Remaining integration work

Independent general, TypeScript and security reviews and the full repository
gate belong to the parent task. No PR, push or merge was performed here.
The phase 5 T2 merge waits for the user's phase 4 validation after K3 and the
W1 documentation follow-up. The original `phase5-toolbar-playback.md` remains
on the preserved source branch.

Before PR, the parent still owns clean dist/install checks, full lint,
typecheck, tests, build, demo build, CI E2E with worktree-specific ports, .NET
Release without warnings, .NET tests and local packaging. Nothing is published.
