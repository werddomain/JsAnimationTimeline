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

/** Same layer and same target: the release is already listed. */
function sameRelease(a, b) {
  return a.layerId === b.layerId && JSON.stringify(a.target) === JSON.stringify(b.target);
}

/** `first` then the entries of `second` not already in it (a layer released twice is listed once). */
function mergeReleased(first, second) {
  return second.reduce((all, entry) => (all.some((known) => sameRelease(known, entry)) ? all : [...all, entry]), first);
}

/**
 * The compact frame sent to .NET: time, layers released since the last frame (each with the target it
 * had, to be applied before `layers`), and the state of each layer.
 */
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
 * replace each other and only the newest is sent next (the last frame wins). Released layers are
 * never lost: they move to the replacing frame, and back to the queue when a call fails. A failed
 * call goes to the stage context (`onListenerError` of the player or editor) and the next frames
 * still go. `detach` sends one last frame, without layers, carrying the releases not sent yet (the
 * player or editor releases every layer just before), then ends the frames. `stop()` ends them at
 * once, sending nothing more; after `detach` it first waits for the last frame to be delivered. A
 * failure of the last frame is not reported (the player or editor is gone). A stage that was
 * detached or stopped is not reused.
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
  // Detached: only the last frame may still go, and nothing is reported any more.
  let closing = false;
  let lastTime = { timeMs: 0, frame: 1, integerFrame: 1 };
  // The last frame queued by `detach`, told apart by identity (an ordinary frame may have no layers).
  let lastFrame = null;
  // Target of each bound layer, to tell .NET which object a released layer had.
  const boundTargets = new Map();
  let inFlight = false;
  let pending = null;
  let lastIntegerFrame = null;
  // Layers removed (or retargeted), with their old target, not yet told to .NET.
  let released = [];
  // Set by a new document or a time jump: the next frame is sent even at the same integer frame.
  let changed = true;

  const report = (error) => {
    if (!stopped && !closing) context?.error(error instanceof Error ? error : new Error(String(error)));
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
        // .NET did not get these releases: send them with the frame waiting, else with the next one.
        if (!stopped && !closing) {
          if (pending !== null) {
            pending = { ...pending, released: mergeReleased(frame.released, pending.released) };
          } else {
            released = mergeReleased(frame.released, released);
          }
          changed = true;
        } else if (!stopped && closing && frame !== lastFrame && frame.released.length > 0) {
          // Detached meanwhile: the last frame carries them (it is created here when there was none).
          const carried = pending === null ? [] : pending.released;
          lastFrame = toFrame(lastTime, [], mergeReleased(frame.released, carried));
          pending = lastFrame;
        }
        report(error);
      })
      .finally(() => {
        inFlight = false;
        send();
        if (!inFlight && pending === null) {
          idleWaiters.splice(0).forEach((resolve) => resolve());
        }
      });
  };

  const endFrame = (time, states) => {
    if (stopped || closing || !sends) return;
    lastTime = { timeMs: time.timeMs, frame: time.frame, integerFrame: time.integerFrame };
    if (description.mode === 'integerFrames' && !changed && time.integerFrame === lastIntegerFrame) return;
    changed = false;
    lastIntegerFrame = time.integerFrame;
    // A frame still waiting is replaced, but its releases carry over.
    const carried = pending === null ? [] : pending.released;
    pending = toFrame(time, states, mergeReleased(carried, released));
    released = [];
    send();
  };

  // Resolved when no call is in flight and no frame waits.
  const idleWaiters = [];

  const halt = () => {
    stopped = true;
    pending = null;
    released = [];
  };

  /**
   * Ends the frames before the .NET receiver goes away (called by DotNetStageHandle.DisposeAsync).
   * After `detach`, the last frame (if any) is delivered first; the promise resolves once stopped.
   */
  const stop = () => {
    if (closing && (inFlight || pending !== null)) {
      return new Promise((resolve) => idleWaiters.push(resolve)).then(halt);
    }
    halt();
    return Promise.resolve();
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
      boundTargets.clear();
      layers.forEach((layer) => boundTargets.set(layer.layerId, layer.target));
      objectStage.update?.(doc, layers);
    },
    sync() {
      changed = true;
    },
    release(layerId, object) {
      changed = true;
      const target = boundTargets.get(layerId) ?? { ref: object, stage: description.id };
      boundTargets.delete(layerId);
      if (sends && !stopped && !closing) {
        released = mergeReleased(released, [{ layerId, target }]);
      }
      objectStage.release?.(layerId, object);
    },
    detach() {
      if (!stopped && !closing && sends) {
        const last = mergeReleased(pending === null ? [] : pending.released, released);
        if (last.length > 0) {
          lastFrame = toFrame(lastTime, [], last);
          pending = lastFrame;
          released = [];
          send();
        } else {
          pending = null;
        }
      }
      closing = true;
      released = [];
      objectStage.detach?.();
    },
    stop,
  };
}
