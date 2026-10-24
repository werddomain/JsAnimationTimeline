// packages/runtime/src/stage/__tests__/StageHost.followups.test.ts
/**
 * Suites de la revue R7 côté hôte : œil de l'éditeur (`isEditorVisible`),
 * notification `subscribe` avec cibles touchées, premier document refusé
 * sans animation restante, `detach` des seules scènes attachées.
 */

import { installFakeAnimate } from '../../player/__tests__/fakes';
import { defaultPropertyRegistry } from '../../properties/PropertyRegistry';
import { createHtmlStage } from '../html/createHtmlStage';
import { StageDocumentError } from '../reports';
import { StageHost } from '../StageHost';
import type { IStage } from '../types';
import { createFakeStage, createHost, docOf, refLayer, timeAt } from './fakeStage';
import type { IFakeObject } from './fakeStage';

let fake: ReturnType<typeof installFakeAnimate>;

beforeEach(() => {
  document.body.innerHTML = '<div id="box" style="color: red"></div>';
  fake = installFakeAnimate();
});

afterEach(() => fake.restore());

function box(): HTMLElement {
  return document.getElementById('box') as HTMLElement;
}

function hostWith(stages: readonly IStage[], isEditorVisible?: (layerId: string) => boolean, onError: (error: unknown) => void = () => undefined): StageHost {
  return new StageHost({
    stages,
    registry: defaultPropertyRegistry,
    onError,
    isEditorVisible,
    now: () => ({ time: timeAt(1), state: { playing: false, speed: 1 } })
  });
}

describe('isEditorVisible', () => {
  it('passes the eye of each layer to render, read on every frame', () => {
    const canvas = createFakeStage('canvas', { unscoped: true });
    canvas.objects.set('a', { name: 'A' });
    canvas.objects.set('b', { name: 'B' });
    const hidden = new Set(['l2']);
    const host = hostWith([canvas.stage], (layerId) => !hidden.has(layerId));
    host.load(docOf([refLayer('l1', 'a'), refLayer('l2', 'b')]));
    host.render(timeAt(2));
    expect(canvas.renders[0].states.map((s) => [s.layerId, s.editorVisible])).toEqual([['l1', true], ['l2', false]]);
    hidden.clear();
    host.render(timeAt(3));
    expect(canvas.renders[1].states.map((s) => s.editorVisible)).toEqual([true, true]);
  });

  it('defaults to visible', () => {
    const canvas = createFakeStage('canvas', { unscoped: true });
    canvas.objects.set('a', { name: 'A' });
    const host = hostWith([canvas.stage]);
    host.load(docOf([refLayer('l1', 'a')]));
    host.render(timeAt(1));
    expect(canvas.renders[0].states[0].editorVisible).toBe(true);
  });

  it('hides an element of the frame-mode HTML stage and gives its visibility back', () => {
    box().style.setProperty('visibility', 'collapse');
    let visible = false;
    const host = hostWith([createHtmlStage({ mode: 'frame' })], () => visible);
    host.load(docOf([{ id: 'a', type: 'layer', name: 'a', target: { selector: '#box' }, spans: [{ id: 's', start: 1, end: 10, kind: 'tween', tracks: { x: [{ frame: 1, value: 0 }, { frame: 10, value: 90 }] } }] }]));
    host.render(timeAt(2));
    expect(box().style.getPropertyValue('visibility')).toBe('hidden');
    visible = true;
    host.render(timeAt(3));
    expect(box().style.getPropertyValue('visibility')).toBe('collapse');
    host.destroy();
  });
});

describe('subscribe with affected targets', () => {
  function setup(): { canvas: ReturnType<typeof createFakeStage>; host: StageHost } {
    const canvas = createFakeStage('canvas', { unscoped: true, subscribe: true });
    canvas.objects.set('a', { name: 'A' });
    const host = createHost([canvas.stage]);
    host.load(docOf([refLayer('l1', 'a'), refLayer('l2', 'b')]));
    canvas.calls.length = 0;
    return { canvas, host };
  }

  it('re-resolves a resolved layer on an affected target and releases the old object', () => {
    const { canvas, host } = setup();
    canvas.objects.set('a', { name: 'A2' });
    canvas.notify([{ ref: 'a' }]);
    expect(canvas.calls).toEqual(['resolve a', 'release l1 A', 'resolve b', 'update l1', 'sync paused', 'render 1']);
    expect(canvas.updates[canvas.updates.length - 1][0].object).toEqual({ name: 'A2' });
    expect(host.missingTargets).toEqual(['l2']);
  });

  it('puts the layer in missingTargets when the affected target no longer resolves', () => {
    const { canvas, host } = setup();
    canvas.objects.delete('a');
    canvas.notify([{ ref: 'a' }]);
    expect(canvas.calls).toEqual(['resolve a', 'release l1 A', 'resolve b', 'update ', 'sync paused', 'render 0']);
    expect(host.missingTargets).toEqual(['l1', 'l2']);
  });

  it('keeps the binding when the object is the same, and ignores resolved layers without affected targets', () => {
    const { canvas } = setup();
    canvas.notify([{ ref: 'a' }]);
    canvas.notify();
    // Anything but an array of targets counts as no affected target.
    canvas.subscribers.forEach((listener) => (listener as (affected: unknown) => void)('junk'));
    expect(canvas.calls).toEqual(['resolve a', 'resolve b', 'resolve b', 'resolve b']);
  });
});

describe('refused first document', () => {
  it('leaves no waapi animation running on a standalone host', () => {
    const canvas = createFakeStage('canvas');
    canvas.objects.set('hero', { name: 'Hero' });
    const refusing: IStage<IFakeObject> = { ...canvas.stage, update: () => {
      throw new StageDocumentError('refused');
    } };
    const host = hostWith([createHtmlStage(), refusing]);
    const boxLayer = { id: 'box', type: 'layer' as const, name: 'box', target: { selector: '#box' }, spans: [{ id: 's', start: 1, end: 10, kind: 'tween' as const, tracks: { x: [{ frame: 1, value: 0 }, { frame: 10, value: 90 }] } }] };
    expect(() => host.load(docOf([boxLayer, refLayer('l2', 'hero', 'canvas')]))).toThrow('refused');
    expect(fake.animations).toHaveLength(1);
    expect(fake.animations[0].playState).toBe('idle');
    expect(canvas.calls).toEqual(['attach', 'resolve hero', 'release l2 Hero']);
  });
});

describe('destroy', () => {
  it('detaches only the stages whose attach ran, and does not subscribe after a destroy', () => {
    const first = createFakeStage('first', { unscoped: true, subscribe: true });
    const second = createFakeStage('second');
    const broken: IStage<IFakeObject> = { ...first.stage, attach: () => {
      throw new Error('attach');
    } };
    const host: StageHost = hostWith([broken, second.stage], undefined, () => host.destroy());
    host.load(docOf([]));
    expect(first.calls).toEqual(['detach']);
    expect(second.calls).toEqual([]);
  });
});
