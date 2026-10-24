// dotnet/JsTimeline.Blazor.JsTests/src/__tests__/editorWithDotNetStage.test.ts
/**
 * A .NET stage plugs into `createEditor({ stage })`: its targets and properties reach the editor,
 * a seek sends the layer values to .NET, and a failed call reaches `onStageError`.
 */

import { createManualClock } from '@werddomain/timeline-runtime';
import { createEditor } from '@werddomain/timeline-editor';
import { FakeDotNetReference, flush, heroDocument, heroStage } from './fakeDotNet';

/** One display frame of the editor's batched rendering. */
const DISPLAY_FRAME_MS = 16;

function container(): HTMLElement {
  const element = document.createElement('div');
  document.body.appendChild(element);
  return element;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('createEditor with a .NET stage', () => {
  it('sends the values of the seeked frame to .NET', async () => {
    // Arrange
    const receiver = new FakeDotNetReference();
    const clock = createManualClock();
    const editor = createEditor(container(), { data: heroDocument(), stage: heroStage(receiver), defaultPlugins: false, clock });
    await receiver.resolveAll();

    // Act
    editor.playback.seek(10);
    clock.advance(DISPLAY_FRAME_MS);
    await flush();

    // Assert
    expect(editor.stage.stages.map((stage) => stage.id)).toEqual(['dotnet']);
    expect(editor.stage.missingTargets).toEqual([]);
    const frame = receiver.frames[receiver.frames.length - 1];
    expect(frame.integerFrame).toBe(10);
    expect(frame.layers[0].values).toEqual({ x: 90, frameIndex: 9, volume: 1 });
    editor.destroy();
  });

  it('reports a failing .NET stage to onStageError', async () => {
    // Arrange
    const errors: unknown[] = [];
    const receiver = new FakeDotNetReference();
    const clock = createManualClock();
    const editor = createEditor(container(), {
      data: heroDocument(),
      stage: heroStage(receiver),
      defaultPlugins: false,
      clock,
      onStageError: (error) => errors.push(error)
    });
    editor.playback.seek(3);
    clock.advance(DISPLAY_FRAME_MS);
    await flush();

    // Act
    await receiver.rejectNext(new Error('RenderAsync threw'));

    // Assert
    expect(errors).toEqual([new Error('RenderAsync threw')]);
    editor.destroy();
  });
});
