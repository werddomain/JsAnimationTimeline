// dotnet/JsTimeline.Blazor.JsTests/src/__tests__/timelineEditor.test.ts
import { createTimelineEditor } from '../../../JsTimeline.Blazor/Editor/TimelineEditor.razor.js';

const documentJson = (frames: number): string => JSON.stringify({
  version: '2.0.0', settings: { fps: 24, totalFrames: frames }, layers: []
});

test('imports through an undoable command and exports the restored document', async () => {
  const root = document.createElement('div');
  document.body.appendChild(root);
  const notifications: string[] = [];
  const receiver = { invokeMethodAsync: async (name: string, value: string) => { if (name === 'DocumentChanged') notifications.push(value); } };
  const editor = await createTimelineEditor(root, documentJson(24), 'none', null, null, receiver);
  expect(editor.importDocument(documentJson(48))).toBe(true);
  expect(JSON.parse(editor.exportJson()).settings.totalFrames).toBe(48);
  expect(editor.undo()).toBe(true);
  expect(JSON.parse(editor.exportJson()).settings.totalFrames).toBe(24);
  expect(notifications.map(json => JSON.parse(json).settings.totalFrames)).toEqual([48, 24]);
  editor.destroy();
  root.remove();
});
