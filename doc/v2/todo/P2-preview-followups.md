<!-- doc/v2/todo/P2-preview-followups.md -->
# P2 preview follow-ups

Preserved source: `v2/P2-followups-2` at `0a2e4213067d510b3045a93f8c10a8b961c2907e`. That branch mixed P2 and T2. `v2/P2-preview-followups` contains only the existing preview follow-ups and this completion record; T2 is isolated in `v2/T2-keyframe-followups`. Target any eventual P2 PR at `v2/base`, never `main`.

## Completed and verified

- Release before the pending display frame keeps the scene held until `frame:render`. Both release tests now assert there is no premature scene render, as well as the exact final render sequence.
- A pending throttled timer is cancelled when release waits for that display frame. Otherwise it can flush the sought frame between release and display, causing another render of the same frame. The new deterministic regression failed before the fix and passed after the timer cancellation.
- A toolbar epic initialized after playback adds Aperçu at `editor:ready`. Directly destroying the preview plugin while leaving the toolbar alive removes the item and the detached select listener; the service is removed and repeated destruction is safe.
- The real-default-editor test registers its editor with the fixture before its assertion. A temporary intentionally failing assertion probe confirmed the existing `afterEach` destroys that editor and removes its DOM; the probe was removed after the run.
- The header and a deterministic test record the remaining throttled-mode caveat: a trailing timer that fires before release can already render the sought frame before its pending display frame. That display frame can render identical output again. The plugin does not promise unique scene renders.

## TDD and focused validation (2026-10-24)

Evidence is preserved under `C:/Users/clefw/.codex/visualizations/2026/10/24/01a16ee6-87dd-73f0-a391-90854a1767c5/phase3-validation/`, in the `p2-*` files. The ECC TDD guide role and the common, TypeScript and web rule packs were read as shared read-only references.

| Check | Result | Evidence |
| --- | --- | --- |
| New timer-between-release-and-display regression against isolated source `95d915d` | RED: 1 failed, 34 passed; frame 6 rendered before display | `p2-red-pending-release.log` |
| Strengthened release tests with historical immediate-release source `95967b3` | RED: both fail on premature frame-6 renders | `p2-red-historical-immediate-release.log` |
| Late-toolbar tests with base source `dee9e5f` | RED: both fail because Aperçu is absent | `p2-red-historical-late-toolbar.log` |
| Real-default-editor assertion-failure probe | Intentional test failure; later `afterEach` verified destroyed editor and removed DOM | `p2-teardown-failure-probe.log` |
| Live preview suite after minimal fix | GREEN: 35/35 | `p2-green-livePreview.log` |
| Live preview, stage-hold and playhead suites with preview-module coverage | GREEN: 87/87 across 3 suites | `p2-focused-coverage.log` |
| Editor typecheck | PASS | `p2-editor-typecheck.log` |
| ESLint on the three preview TypeScript files, `--max-warnings 0` | PASS | `p2-focused-lint.log` |

Preview-module coverage: 95.47% statements, 84.76% branches, 83.33% functions, 98.19% lines. `LivePreviewPlugin.ts`: 93.23%, 84.61%, 93.75%, 97.29%, respectively. The initialization error cleanup remains uncovered by these focused tests; the unchanged select's invalid-value branches are also outside this regression scope. No browser or full-repository validation is claimed by this record.

## Structured header review correction (2026-10-25)

The general review found that the prose-only English header no longer satisfied the repository convention checker. The header now uses separate `Plugin`, `Epic`, `Depends on`, `Listens` and `Emits` fields. Its dependencies match the literal `['playback', 'layout.playhead']`; the event list includes the optional-toolbar retry on `editor:ready`. Only the structured comment changed; runtime behavior and the throttled duplicate-render caveat remain unchanged.

- RED: `npm test --workspace tools/conventions -- --runInBand --runTestsByPath src/__tests__/repo.test.ts` failed with the missing `Depends on` field and the mismatched plugin id. This used the existing real-repository test, without a replacement or mirrored checker (`p2-header-conventions-red.log`).
- GREEN: `npm test --workspace tools/conventions -- --runInBand --runTestsByPath src/__tests__/repo.test.ts src/__tests__/pluginHeader.test.ts` passed 20/20 tests (`p2-header-conventions-green.log`).
- Existing preview, stage-hold and playhead suites passed again: 87/87 tests (`p2-header-focused-tests.log`). `git diff --check` passed. The earlier coverage and typecheck records remain evidence for the behavior change; they were not rerun for this comment-only correction.

## Remaining integration gates

P2 and T2 may be prepared and independently reviewed, but phase-5 merges wait for the user's phase-4 validation after K3 and the W1 documentation follow-up. No P2 PR, push or merge was performed in this completion step.

The parent owns independent ECC general, TypeScript and security review, followed by the full gate before any PR: clean dist, npm ci, zero-error lint, typecheck, npm test, build, build:demo, CI=1 E2E with worktree-specific clean ports, .NET Release with zero warnings, .NET tests and local package validation. Publish nothing. Review results must be recorded when those reviews actually run; earlier ECC results do not cover this integration.

The original `phase5-toolbar-playback.md` remains on the source branch. S1 and E1 still await Benoit's agreement. No new plan task was started.
