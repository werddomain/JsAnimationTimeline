# doc/v2/todo/calques.md

# Layers (phase 3, Y0-Y8): remaining work

Y0-Y8 and the follow-ups through #90 are integrated in `v2/base`.
Y4 target selection is implemented; its target-popup follow-ups are delivered through #92.

## Y5 window/tab focus follow-up

Task branch: `v2/Y5-window-blur`. The saved source branch
`v2/layers-window-blur` remains unchanged at `4cb6a4e`.

A changed name is committed when its input blurs. A window or tab switch sends a
blur with no destination while the document loses focus. This must preserve the
row's place in keyboard navigation. A destination-less blur while the document
still has focus (for example, a click into an iframe) remains a real departure.

The minimal `blurLeaves` guard and both browser-state test models are in this
follow-up. The new window-switch regression also verifies undo/redo and keyboard
navigation after the rename. Test mocks are restored after each test.

Targeted TDD evidence:

- RED before the guard: the iframe scenario passes; the window-switch scenario
  fails because focus stays on `body` instead of the renamed row.
- GREEN after the guard: all 38 rename tests and all 134 selection tests pass.
- Complete integration verification and ECC reviews are required before the PR
  is merged into `v2/base`. No new phase-3 feature is included in this fix.

## Accepted non-blocking limits

- Ungrouping a collapsed but visible folder can emit two
  `layers:selectionChanged` events; a visible expanded folder emits one.
- `touch-action: none` on rows prevents finger scrolling of the layer list during
  touch drag handling. Wheel, scrollbar, and keyboard scrolling still work; this
  is documented in `LayerReorder.less`.
- Dragging near the edge does not automatically scroll the layer list.
- Ctrl+Alt+Up/Down takes two key presses to leave a folder and enter the next empty
  folder.
- Mod+Alt+L can conflict with AltGr+L on some Windows keyboard layouts; it is active
  only while the layer list has focus.
