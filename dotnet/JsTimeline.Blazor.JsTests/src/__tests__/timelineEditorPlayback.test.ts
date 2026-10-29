// dotnet/JsTimeline.Blazor.JsTests/src/__tests__/timelineEditorPlayback.test.ts
import { createTimelineEditor } from '../../../JsTimeline.Blazor/Editor/TimelineEditor.razor.js';

const mockPause = jest.fn();
const mockSeek = jest.fn();
jest.mock('../../../../packages/editor/src/index.ts', () => ({
  createEditor: () => ({
    playback: { pause: mockPause, seek: mockSeek },
    on: () => () => {},
    getService: () => ({}),
    destroy: () => {},
  }),
}));

afterEach(() => { mockPause.mockReset(); mockSeek.mockReset(); });

const create = () => createTimelineEditor(document.createElement('div'), '{}', 'none', null, null,
  { invokeMethodAsync: async () => {} });

test('reset pauses before seeking to the first frame', async () => {
  const editor = await create();
  editor.resetPlayback();
  expect(mockPause).toHaveBeenCalledTimes(1);
  expect(mockSeek).toHaveBeenCalledWith(1);
  expect(mockPause.mock.invocationCallOrder[0]).toBeLessThan(mockSeek.mock.invocationCallOrder[0]);
});

test('reset propagates a pause failure without seeking', async () => {
  const editor = await create();
  mockPause.mockImplementation(() => { throw new Error('pause failed'); });
  expect(() => editor.resetPlayback()).toThrow('pause failed');
  expect(mockSeek).not.toHaveBeenCalled();
});

test('reset propagates a seek failure', async () => {
  const editor = await create();
  mockSeek.mockImplementation(() => { throw new Error('seek failed'); });
  expect(() => editor.resetPlayback()).toThrow('seek failed');
  expect(mockPause).toHaveBeenCalledTimes(1);
});
