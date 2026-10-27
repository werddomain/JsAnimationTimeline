<!-- doc/v2/todo/C3b-command-reentrancy.md -->
# C3b — Command re-entrancy

Command transforms can call external stage metadata providers. If a provider changes the document or history while a transform runs, the transform result is stale. A monotonic internal generation now detects these changes after `do` and `undo`, rejects the outer operation, and preserves nested effects. The generation advances before notifications for history and group transitions, including a same-reference load. Re-entrancy in `command:before` and after a committed `document:changed` remains supported.

The property keyframes service and other internal callers can share strict stage metadata routing through `createStagePropertyEditContext`; it is not part of the public index.

A separate lifecycle generation also rejects commands when teardown occurs during `command:before`, while ordinary nested edits there remain permitted. Editor teardown invalidates in-flight transformations without changing history or emitting a history event. Both the core property API and the property keyframes service are protected when metadata callbacks destroy the editor.
