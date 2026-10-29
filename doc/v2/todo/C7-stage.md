# doc/v2/todo/C7-stage.md

# C7 editor stages: report-feed integration follow-up

This follow-up to #78 is delivered through #93 into `v2/base`.

## Report lifetime contract

- Load-time warnings are rebuilt on each load and are announced again when they
  disappear and return, including delete/undo while a stage hold is active.
- Only after-load warning keys are carried until a complete sync/render pass.
  A hold catch-up also completes that pass.
- The synced flag is set before stage callbacks, so a reentrant command can load
  a new document and correctly leave that new document unsynchronized.

## Accepted non-blocking limit

Warnings raised by retries or rollback inside `host.load` count as load-time.
A rare sequence can therefore announce a diagnostic warning twice. This does not
modify the document or its history. Distinguishing the initial load from nested
retries remains a possible follow-up, rather than part of this correction.

## Integration acceptance

ECC general, TypeScript, and security reviews cover this contract and its tests.
The complete local npm, Playwright, and .NET gate is required on the exact merge
tree; its results are recorded in #93. NuGet packages remain local.
