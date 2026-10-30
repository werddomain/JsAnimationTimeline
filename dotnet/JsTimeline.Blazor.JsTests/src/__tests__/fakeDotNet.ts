// dotnet/JsTimeline.Blazor.JsTests/src/__tests__/fakeDotNet.ts
/**
 * Fake DotNetObjectReference for the bridge tests: records each `invokeMethodAsync` call and keeps
 * its promise open until the test settles it, like a .NET method still running.
 */

import type { IStage, ITimelineDocument, TimelinePropertyValue } from '@kazo-ca/timeline-runtime';
// The module under test is the plain JavaScript shipped in the Blazor package.
import { createDotNetStage } from '../../../JsTimeline.Blazor/wwwroot/stage/dotnetStage.js';

/** Frame sent by the bridge to `RenderAsync`. */
export interface ISentFrame {
  readonly released: readonly { readonly layerId: string; readonly target: unknown }[];
  readonly timeMs: number;
  readonly frame: number;
  readonly integerFrame: number;
  readonly layers: readonly {
    readonly layerId: string;
    readonly target: unknown;
    readonly values: Readonly<Record<string, number>>;
    readonly propertyValues?: Readonly<Record<string, TimelinePropertyValue>>;
    readonly active: boolean;
    readonly visible: boolean;
  }[];
}

interface IPendingCall {
  readonly method: string;
  readonly frame: ISentFrame;
  resolve(): void;
  reject(error: Error): void;
}

/** Records the calls; each one stays pending until `resolveNext` or `rejectNext`. */
export class FakeDotNetReference {
  readonly calls: IPendingCall[] = [];
  private settled = 0;

  invokeMethodAsync(method: string, frame: ISentFrame): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.calls.push({ method, frame, resolve, reject });
    });
  }

  get frames(): ISentFrame[] {
    return this.calls.map((call) => call.frame);
  }

  /** Completes the oldest pending call, then lets the bridge send the next frame. */
  async resolveNext(): Promise<void> {
    this.calls[this.settled++].resolve();
    await flush();
  }

  /** Fails the oldest pending call, like an exception thrown by the .NET stage. */
  async rejectNext(error: Error): Promise<void> {
    this.calls[this.settled++].reject(error);
    await flush();
  }

  /** Completes every call, including the ones sent while completing. */
  async resolveAll(): Promise<void> {
    while (this.settled < this.calls.length) {
      await this.resolveNext();
    }
  }
}

/** Lets the promise callbacks of the bridge run. */
export async function flush(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}

export type FrameMode = 'off' | 'integerFrames' | 'everyTick';

/** Description of a stage with one `hero` target, a linear `volume` and a floored `frameIndex`. */
export function heroDescription(mode: FrameMode = 'integerFrames') {
  return {
    id: 'dotnet',
    mode,
    targets: [{ ref: 'hero', label: 'Héros', icon: null, group: null, properties: null }],
    properties: [
      { name: 'volume', defaultValue: 1, interpolation: 'linear', label: 'Volume', group: null, unit: '', min: 0, max: 1 },
      { name: 'frameIndex', defaultValue: 0, interpolation: 'floor', label: null, group: null, unit: '', min: null, max: null }
    ]
  };
}

/** The bridge stage built from `heroDescription`. */
export function heroStage(receiver: FakeDotNetReference, mode: FrameMode = 'integerFrames'): IStage {
  // `satisfies` checks the members against IStage; the cast only drops the extra `stop`.
  const stage = createDotNetStage(heroDescription(mode), receiver) satisfies IStage;
  return stage;
}

/** The release of the `hero` layer, as sent to .NET. */
export const HERO_RELEASE = { layerId: 'l-hero', target: { ref: 'hero', stage: 'dotnet' } };

/** A 10-frame document at 10 fps: `hero` moves x from 0 to 90 and frameIndex from 0 to 9. */
export function heroDocument(): ITimelineDocument {
  return {
    version: '2.0.0',
    settings: { fps: 10, totalFrames: 10 },
    layers: [
      {
        id: 'l-hero',
        type: 'layer',
        name: 'Héros',
        target: { ref: 'hero', stage: 'dotnet' },
        spans: [
          {
            id: 's1',
            start: 1,
            end: 10,
            kind: 'tween',
            tracks: {
              x: [{ frame: 1, value: 0 }, { frame: 10, value: 90 }],
              frameIndex: [{ frame: 1, value: 0 }, { frame: 10, value: 9 }]
            }
          }
        ]
      }
    ]
  };
}
