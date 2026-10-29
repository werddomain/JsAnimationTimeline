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

test('a refused load keeps the old editor notifying at the new revision', async () => {
  const root = document.createElement('div');
  document.body.appendChild(root);
  const calls: { name: string; revision: number }[] = [];
  const receiver = { invokeMethodAsync: async (name: string, _value: string, revision: number) => { calls.push({ name, revision }); } };
  const editor = await createTimelineEditor(root, documentJson(24), 'none', null, null, receiver, 1);
  expect(() => editor.load('{"version":"invalid"}', 2)).toThrow();
  expect(editor.importDocument(documentJson(48))).toBe(true);
  expect(calls).toContainEqual({ name: 'DocumentChanged', revision: 2 });
  editor.destroy();
  root.remove();
});

test('a stage error during load uses the incoming revision', async () => {
  const root = document.createElement('div');
  document.body.appendChild(root);
  const calls: { name: string; revision: number }[] = [];
  const receiver = { invokeMethodAsync: async (name: string, _value: string, revision: number) => { calls.push({ name, revision }); } };
  const stage = {
    id: 'test-stage', accepts: () => false, resolve: () => null, render: () => {},
    update: (doc: { settings: { totalFrames: number } }) => { if (doc.settings.totalFrames === 48) throw new Error('stage failed'); }
  };
  const editor = await createTimelineEditor(root, documentJson(24), 'dotnet', null, stage, receiver, 1);
  editor.load(documentJson(48), 2);
  expect(calls).toContainEqual({ name: 'StageError', revision: 2 });
  editor.destroy();
  root.remove();
});
