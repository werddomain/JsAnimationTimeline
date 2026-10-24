# doc/v2/todo/Y4-target.md

# Y4 target selection: integration follow-up

Branch: `v2/Y4-followups-2`. Existing PR: #92, targeting `v2/base`.

## Rejected-pick regression resolved

A pick rejection used to call `onPickEnd` before `finally` released its picking
controller. If undo changed the target during that pick, the deferred rebuild
still saw `picking === true` and stayed queued. The popup displayed the stale
pre-undo target, and applying it could discard redo history.

The rejection path now releases its own controller before restoring focus and
notifying `onPickEnd`. The guarded `finally` cleanup remains safe if another pick
starts from a callback. Successful, aborted, and closed pick paths are unchanged.
The existing failure status is still assigned before the completion notification.

TDD evidence:

- RED: set the target to `sun`, start picking, undo to `hero`, then reject the
  pending pick. The rebuilt text was expected to be `hero` but remained `sun`.
- GREEN: all 62 target tests pass across five suites. The new combined scenario
  verifies the rebuilt target, pick-button focus, unchanged application preserving
  redo, and successful redo back to `sun`.
- `TargetPopup.ts` coverage: statements 96.11%, branches 84.89%, functions 98.18%,
  lines 98.34%.

## Integration acceptance

- ECC integration reviews must cover the repaired diff.
- The complete local integration gate and its result are required in #92 before
  merging into `v2/base`.

## Known non-blocking notes

- A refused or failed pick's status message is still lost when a deferred popup
  rebuild replays. This existing LOW limitation is separate from the fixed stale
  target and redo-history regression.
- Additional combinations of edited drafts across two consecutive rebuilds remain
  optional follow-up tests.
- The popup deliberately stays unchanged while a pick is active; a pick ending
  without application replays a pending rebuild once the picker is idle.
