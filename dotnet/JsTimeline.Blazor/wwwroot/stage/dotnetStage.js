// dotnet/JsTimeline.Blazor/wwwroot/stage/dotnetStage.js
// Turns a .NET ITimelineStage (through a DotNetObjectReference) into a runtime IStage for
// createEditor({ stage }) or createPlayer({ stage }). Served at
// _content/JsTimeline.Blazor/stage/dotnetStage.js, next to js/timeline-runtime.mjs.
import { createObjectStage, getInterpolator } from '../js/timeline-runtime.mjs';

/** When frames are sent to .NET: never, when the integer frame changes, or on every tick. */
const MODES = ['off', 'integerFrames', 'everyTick'];

/**
 * @typedef {{ ref: string, label: string, icon?: string | null, group?: string | null,
 *   properties?: string[] | null }} DotNetStageTarget
 * @typedef {{ name: string, defaultValue: number, interpolation: string, label?: string | null,
 *   group?: string | null, unit?: string | null, min?: number | null, max?: number | null }} DotNetStageProperty
 * @typedef {{ id: string, mode: string, targets: DotNetStageTarget[],
 *   properties: DotNetStageProperty[] }} DotNetStageDescription
 * @typedef {{ invokeMethodAsync(name: string, ...args: unknown[]): Promise<unknown> }} DotNetReceiver
 */

/** Copies the fields that are set (the .NET side writes null for absent ones). */
function defined(fields) {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== null && value !== undefined));
}

/** A `value` property of the runtime registry, its interpolator picked by name. */
function toDescriptor(property) {
  const interpolate = getInterpolator(property.interpolation);
  if (interpolate === undefined) {
    throw new Error(`Property "${property.name}": unknown interpolation "${property.interpolation}".`);
  }
  return {
    ...defined({
      label: property.label,
      group: property.group,
      min: property.min,
      max: property.max,
    }),
    name: property.name,
    kind: 'value',
    unit: property.unit ?? '',
    defaultValue: property.defaultValue,
    interpolate,
  };
}

/** One object of the stage: its ref is the object itself (.NET keeps the real one). */
function toEntry(target) {
  return {
    ...defined({ icon: target.icon, group: target.group, properties: target.properties }),
    id: target.ref,
    label: target.label,
    object: target.ref,
  };
}

/** Finite values only: JSON turns NaN and Infinity into null, which a .NET double cannot read. */
function finiteValues(values) {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => Number.isFinite(value)));
}

/** The compact frame sent to .NET: time, layers released since the last frame, and per layer its state. */
function toFrame(time, states, released) {
  return {
    released,
    timeMs: time.timeMs,
    frame: time.frame,
    integerFrame: time.integerFrame,
    layers: states.map((state) => ({
      layerId: state.layerId,
      target: state.target,
      values: finiteValues(state.values),
      active: state.active,
      visible: state.editorVisible,
    })),
  };
}

/**
 * Creates the stage. Only one `RenderAsync` call is in flight at a time; frames rendered meanwhile
 * replace each other and only the newest is sent next (the last frame wins). Released layer ids are
 * never lost: they move to the replacing frame, and back to the queue when a call fails. A failed
 * call goes to the stage context (`onListenerError` of the player or editor) and the next frames
 * still go. `stop()` (or `detach`) ends the frames for good; a stopped stage is not reused.
 * @param {DotNetStageDescription} description Id, frame mode, targets and properties of the stage.
 * @param {DotNetReceiver} receiver DotNetObjectReference with a `RenderAsync(frame)` method.
 */
export function createDotNetStage(description, receiver) {
  if (!MODES.includes(description.mode)) {
    throw new Error(`Stage "${description.id}": unknown frame mode "${description.mode}".`);
  }
  const sends = description.mode !== 'off';
  let context;
  let stopped = false;
  let inFlight = false;
  let pending = null;
  let lastIntegerFrame = null;
  // Layers removed (or retargeted) and not yet told to .NET.
  let released = [];
  // Set by a new document or a time jump: the next frame is sent even at the same integer frame.
  let changed = true;

  const report = (error) => {
    if (!stopped) context?.error(error instanceof Error ? error : new Error(String(error)));
  };

  const send = () => {
    if (inFlight || pending === null || stopped) return;
    const frame = pending;
    pending = null;
    inFlight = true;
    let call;
    try {
      call = receiver.invokeMethodAsync('RenderAsync', frame);
    } catch (error) {
      // A receiver that throws instead of rejecting ends in the same catch and finally.
      call = Promise.reject(error);
    }
    Promise.resolve(call)
      .catch((error) => {
        // .NET did not get these ids: send them with the frame waiting, else with the next one.
        if (!stopped) {
          if (pending !== null) {
            pending = { ...pending, released: [...frame.released, ...pending.released] };
          } else {
            released = [...frame.released, ...released];
          }
          changed = true;
        }
        report(error);
      })
      .finally(() => {
        inFlight = false;
        send();
      });
  };

  const endFrame = (time, states) => {
    if (stopped || !sends) return;
    if (description.mode === 'integerFrames' && !changed && time.integerFrame === lastIntegerFrame) return;
    changed = false;
    lastIntegerFrame = time.integerFrame;
    // A frame still waiting is replaced, but its released ids carry over.
    const carried = pending === null ? [] : pending.released;
    pending = toFrame(time, states, [...carried, ...released]);
    released = [];
    send();
  };

  const stop = () => {
    stopped = true;
    pending = null;
    released = [];
  };

  const objectStage = createObjectStage({
    id: description.id,
    properties: description.properties.map(toDescriptor),
    objects: description.targets.map(toEntry),
    // The values travel in endFrame, for every layer at once.
    apply: () => undefined,
    endFrame,
  });

  return {
    ...objectStage,
    attach(ctx) {
      context = ctx;
      objectStage.attach?.(ctx);
    },
    update(doc, layers) {
      changed = true;
      objectStage.update?.(doc, layers);
    },
    sync() {
      changed = true;
    },
    release(layerId, object) {
      changed = true;
      if (sends && !stopped) {
        released = [...released, layerId];
      }
      objectStage.release?.(layerId, object);
    },
    detach() {
      stop();
      objectStage.detach?.();
    },
    /** Ends the frames before the .NET receiver goes away (called by DotNetStageHandle.DisposeAsync). */
    stop,
  };
}
