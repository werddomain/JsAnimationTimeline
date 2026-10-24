// packages/runtime/src/stage/__tests__/StageHost.lifecycle.test.ts
/**
 * Cycle de vie des scènes avec une fausse scène : attach une fois, diff par
 * id et par cible, release puis resolve, cache des résolutions, nouvel essai
 * sur subscribe ou refresh, update, render, fin.
 */

import { createFakeStage, createHost, docOf, refLayer, timeAt } from './fakeStage';

describe('StageHost lifecycle', () => {
  it('attaches once, resolves, then updates on the first document', () => {
    const fake = createFakeStage('canvas', { unscoped: true });
    fake.objects.set('hero', { name: 'Hero' });
    const host = createHost([fake.stage]);
    host.load(docOf([refLayer('l1', 'hero')]));
    expect(fake.calls).toEqual(['attach', 'resolve hero', 'update l1']);
    expect(fake.updates[0][0]).toMatchObject({ layerId: 'l1', object: { name: 'Hero' }, target: { ref: 'hero' } });
    expect(fake.ctx?.registry.has('x')).toBe(true);
    host.load(docOf([refLayer('l1', 'hero')]));
    expect(fake.calls).toEqual(['attach', 'resolve hero', 'update l1', 'update l1']);
  });

  it('releases a removed layer and a changed target, then resolves the new target', () => {
    const fake = createFakeStage('canvas', { unscoped: true });
    fake.objects.set('a', { name: 'A' });
    fake.objects.set('b', { name: 'B' });
    const host = createHost([fake.stage]);
    host.load(docOf([refLayer('l1', 'a'), refLayer('l2', 'b')]));
    fake.calls.length = 0;
    host.load(docOf([refLayer('l1', 'b')]));
    expect(fake.calls).toEqual(['release l1 A', 'release l2 B', 'resolve b', 'update l1']);
  });

  it('keeps the cached object when only the spans change', () => {
    const fake = createFakeStage('canvas', { unscoped: true });
    fake.objects.set('a', { name: 'A' });
    const host = createHost([fake.stage]);
    host.load(docOf([refLayer('l1', 'a')]));
    host.load(docOf([refLayer('l1', 'a', undefined, { x: [{ frame: 1, value: 5 }] })]));
    expect(fake.calls.filter((call) => call.startsWith('resolve'))).toEqual(['resolve a']);
    expect(fake.updates[1][0].layer.spans[0].tracks).toEqual({ x: [{ frame: 1, value: 5 }] });
  });

  it('remembers a failed resolution and does not retry it on the next document', () => {
    const fake = createFakeStage('canvas', { unscoped: true });
    const host = createHost([fake.stage]);
    host.load(docOf([refLayer('l1', 'late')]));
    expect(host.missingTargets).toEqual(['l1']);
    fake.objects.set('late', { name: 'Late' });
    host.load(docOf([refLayer('l1', 'late')]));
    expect(fake.calls.filter((call) => call.startsWith('resolve'))).toEqual(['resolve late']);
    expect(host.missingTargets).toEqual(['l1']);
  });

  it('retries failed resolutions when the targets change, then updates, syncs and renders that stage', () => {
    const fake = createFakeStage('canvas', { unscoped: true, subscribe: true });
    const host = createHost([fake.stage], [], { time: timeAt(3), state: { playing: true, speed: 2 } });
    host.load(docOf([refLayer('l1', 'late')]));
    fake.calls.length = 0;
    fake.notify();
    expect(fake.calls).toEqual(['resolve late']);
    fake.objects.set('late', { name: 'Late' });
    fake.notify();
    expect(fake.calls).toEqual(['resolve late', 'resolve late', 'update l1', 'sync playing', 'render 1']);
    expect(host.missingTargets).toEqual([]);
    expect(fake.renders[0].time.frame).toBe(3);
    fake.notify();
    expect(fake.calls).toHaveLength(5);
  });

  it('retries on refresh, for one layer or all of them', () => {
    const fake = createFakeStage('canvas', { unscoped: true });
    const host = createHost([fake.stage]);
    host.load(docOf([refLayer('l1', 'a'), refLayer('l2', 'b')]));
    fake.objects.set('a', { name: 'A' });
    fake.objects.set('b', { name: 'B' });
    fake.calls.length = 0;
    host.refresh('l2');
    expect(fake.calls).toEqual(['resolve b', 'update l2', 'sync paused', 'render 1']);
    expect(host.missingTargets).toEqual(['l1']);
    host.refresh();
    expect(host.missingTargets).toEqual([]);
  });

  it('renders every layer of a stage in one call, with values, span and activity', () => {
    const fake = createFakeStage('canvas', { unscoped: true });
    fake.objects.set('a', { name: 'A' });
    const host = createHost([fake.stage]);
    const blank = { ...refLayer('l2', 'a'), spans: [{ id: 'b', start: 1, end: 10, kind: 'blank' as const }] };
    host.load(docOf([refLayer('l1', 'a'), blank]));
    host.render(timeAt(4.5));
    expect(fake.renders).toHaveLength(1);
    const [first, second] = fake.renders[0].states;
    expect(first).toMatchObject({ layerId: 'l1', object: { name: 'A' }, spanId: 'l1-s', active: true, editorVisible: true });
    expect(first.values.x).toBeCloseTo(35);
    expect(second).toMatchObject({ layerId: 'l2', active: false, spanId: 'b' });
  });

  it('holds the last frame at the very end of the timeline', () => {
    const fake = createFakeStage('canvas', { unscoped: true });
    fake.objects.set('a', { name: 'A' });
    const host = createHost([fake.stage]);
    host.load(docOf([refLayer('l1', 'a')]));
    host.render({ timeMs: 1000, frame: 11, integerFrame: 10 });
    expect(fake.renders[0].states[0]).toMatchObject({ active: true, values: { x: 90 } });
  });

  it('does not evaluate for stages without render, and does not sync stages without sync', () => {
    const syncOnly = createFakeStage('audio', { render: false });
    const renderOnly = createFakeStage('canvas', { sync: false });
    const host = createHost([syncOnly.stage, renderOnly.stage]);
    host.load(docOf([]));
    host.sync(timeAt(1), { playing: false, speed: 1 });
    host.render(timeAt(1));
    expect(syncOnly.calls).toEqual(['attach', 'update ', 'sync paused']);
    expect(renderOnly.calls).toEqual(['attach', 'update ', 'render 0']);
  });

  it('releases every layer then detaches on destroy, and unsubscribes', () => {
    const fake = createFakeStage('canvas', { unscoped: true, subscribe: true });
    fake.objects.set('a', { name: 'A' });
    const host = createHost([fake.stage]);
    host.load(docOf([refLayer('l1', 'a'), refLayer('l2', 'missing')]));
    fake.calls.length = 0;
    host.destroy();
    host.destroy();
    expect(fake.calls).toEqual(['release l1 A', 'unsubscribe', 'detach']);
    expect(() => host.load(docOf([]))).toThrow('The stages were destroyed.');
    expect(() => host.refresh()).toThrow('The stages were destroyed.');
    host.render(timeAt(1));
    host.sync(timeAt(1), { playing: false, speed: 1 });
    expect(fake.calls).toHaveLength(3);
  });

  it('does not detach a stage that was never attached', () => {
    const fake = createFakeStage('canvas');
    createHost([fake.stage]).destroy();
    expect(fake.calls).toEqual([]);
  });

  it('ignores render and sync before the first document', () => {
    const fake = createFakeStage('canvas');
    const host = createHost([fake.stage]);
    host.render(timeAt(1));
    host.sync(timeAt(1), { playing: false, speed: 1 });
    expect(fake.calls).toEqual([]);
  });

  it('lists layers without target as missing, without a report', () => {
    const fake = createFakeStage('canvas', { unscoped: true });
    const host = createHost([fake.stage]);
    host.load(docOf([{ id: 'none', type: 'layer', name: 'N', spans: [] }]));
    expect(host.missingTargets).toEqual(['none']);
    expect(host.warnings).toEqual([]);
  });
});
