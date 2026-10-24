// packages/runtime/src/stage/__tests__/routing.test.ts
/**
 * Routage entre plusieurs scènes, `refStage`, comparaison des cibles,
 * vérification des scènes et registre étendu par les scènes.
 */

import { createPropertyRegistry, defaultPropertyRegistry } from '../../properties/PropertyRegistry';
import { buildStageRegistry } from '../registry';
import { StageReportCodes } from '../reports';
import { assertValidStages, isAffectedTarget, refStage, sameTarget } from '../routing';
import type { IStage } from '../types';
import { createFakeStage, createHost, docOf, refLayer } from './fakeStage';

describe('refStage', () => {
  it('accepts only refs scoped to the stage, or also unscoped refs', () => {
    const scoped = refStage('canvas');
    const unscoped = refStage('canvas', { unscoped: true });
    expect(scoped({ ref: 'a', stage: 'canvas' })).toBe(true);
    expect(scoped({ ref: 'a' })).toBe(false);
    expect(scoped({ ref: 'a', stage: 'audio' })).toBe(false);
    expect(scoped({ selector: '#a' })).toBe(false);
    expect(unscoped({ ref: 'a' })).toBe(true);
    expect(unscoped({ ref: 'a', stage: 'audio' })).toBe(false);
  });
});

describe('isAffectedTarget', () => {
  it('matches refs by ref only, whatever the stage spelling', () => {
    expect(isAffectedTarget({ ref: 'hero', stage: 'canvas' }, { ref: 'hero' })).toBe(true);
    expect(isAffectedTarget({ ref: 'hero' }, { ref: 'hero', stage: 'canvas' })).toBe(true);
    expect(isAffectedTarget({ ref: 'hero', stage: 'canvas' }, { ref: 'villain', stage: 'canvas' })).toBe(false);
  });

  it('falls back to sameTarget for other targets', () => {
    expect(isAffectedTarget({ selector: '#a' }, { selector: '#a' })).toBe(true);
    expect(isAffectedTarget({ selector: '#a' }, { ref: 'a' })).toBe(false);
  });
});

describe('sameTarget', () => {
  it('compares targets by key and value', () => {
    const element = document.createElement('div');
    expect(sameTarget({ selector: '#a' }, { selector: '#a' })).toBe(true);
    expect(sameTarget({ selector: '#a' }, { selector: '#b' })).toBe(false);
    expect(sameTarget({ ref: 'a', stage: 'x' }, { ref: 'a', stage: 'x' })).toBe(true);
    expect(sameTarget({ ref: 'a' }, { ref: 'a', stage: 'x' })).toBe(false);
    expect(sameTarget({ element }, { element })).toBe(true);
    expect(sameTarget({ element }, { element: document.createElement('div') })).toBe(false);
    expect(sameTarget({ selector: 'a' }, { ref: 'a' })).toBe(false);
    expect(sameTarget(undefined, undefined)).toBe(true);
    expect(sameTarget(undefined, { ref: 'a' })).toBe(false);
  });
});

describe('assertValidStages', () => {
  const ok = createFakeStage('a').stage;

  it('refuses two stages with the same id', () => {
    expect(() => assertValidStages([ok, createFakeStage('a').stage])).toThrow('Two stages have the id "a".');
    expect(() => createHost([ok, createFakeStage('a').stage])).toThrow('Two stages have the id "a".');
  });

  it('refuses a stage without sync nor render', () => {
    const stage = createFakeStage('mute', { sync: false, render: false }).stage;
    expect(() => assertValidStages([stage])).toThrow('Stage "mute" must implement sync, render or both.');
  });

  it('refuses malformed stages', () => {
    expect(() => assertValidStages([null as unknown as IStage])).toThrow('Stage #0 must be an object.');
    expect(() => assertValidStages([{ ...ok, id: '' }])).toThrow('Stage #0 needs a non-empty string id.');
    expect(() => assertValidStages([{ ...ok, resolve: undefined } as unknown as IStage])).toThrow('Stage "a" must implement accepts and resolve.');
  });
});

describe('routing in StageHost', () => {
  function setup(): { canvas: ReturnType<typeof createFakeStage>; audio: ReturnType<typeof createFakeStage>; stages: IStage[] } {
    const canvas = createFakeStage('canvas', { unscoped: true });
    const audio = createFakeStage('audio', { unscoped: true });
    canvas.objects.set('hero', { name: 'canvas hero' });
    audio.objects.set('hero', { name: 'audio hero' });
    audio.objects.set('music', { name: 'music' });
    return { canvas, audio, stages: [canvas.stage, audio.stage] };
  }

  it('sends a scoped target only to the stage of that id', () => {
    const { canvas, audio, stages } = setup();
    const host = createHost(stages);
    host.load(docOf([refLayer('l1', 'hero', 'audio')]));
    expect(canvas.updates[0]).toEqual([]);
    expect(audio.updates[0][0].object).toEqual({ name: 'audio hero' });
  });

  it('sends an unscoped target to the first stage that accepts it', () => {
    const { canvas, audio, stages } = setup();
    const host = createHost(stages);
    host.load(docOf([refLayer('l1', 'hero')]));
    expect(canvas.updates[0][0].object).toEqual({ name: 'canvas hero' });
    expect(audio.calls).not.toContain('resolve hero');
  });

  it('does not fall through to the next stage when resolve returns null', () => {
    const { canvas, audio, stages } = setup();
    const host = createHost(stages);
    host.load(docOf([refLayer('l1', 'music')]));
    expect(canvas.calls).toContain('resolve music');
    expect(audio.calls).not.toContain('resolve music');
    expect(host.missingTargets).toEqual(['l1']);
    expect(host.warnings).toEqual([]);
  });

  it('reports an unknown stage id', () => {
    const { stages } = setup();
    const host = createHost(stages);
    host.load(docOf([refLayer('l1', 'hero', 'three')]));
    expect(host.missingTargets).toEqual(['l1']);
    expect(host.warnings).toEqual([expect.objectContaining({ code: StageReportCodes.UNKNOWN_STAGE, stageId: 'three', layerId: 'l1' })]);
  });

  it('reports a layer no stage accepts, again on every document', () => {
    const scoped = createFakeStage('canvas');
    const host = createHost([scoped.stage]);
    host.load(docOf([refLayer('l1', 'hero'), { ...refLayer('l2', 'x'), target: { selector: '#x' } }]));
    expect(host.missingTargets).toEqual(['l1', 'l2']);
    expect(host.warnings.map((w) => [w.code, w.layerId])).toEqual([['unrouted', 'l1'], ['unrouted', 'l2']]);
    host.load(docOf([refLayer('l1', 'hero')]));
    expect(host.warnings.map((w) => w.layerId)).toEqual(['l1']);
  });

  it('reports unrouted when the named stage refuses the target', () => {
    const picky = createFakeStage('canvas', { accepts: () => false });
    const host = createHost([picky.stage]);
    host.load(docOf([refLayer('l1', 'hero', 'canvas')]));
    expect(host.warnings.map((w) => w.code)).toEqual(['unrouted']);
  });

  it('treats a throwing accepts as false, reports it and tries the next stage', () => {
    const errors: unknown[] = [];
    const broken = createFakeStage('broken', {
      accepts: () => {
        throw new Error('accepts failed');
      }
    });
    const { canvas } = setup();
    const host = createHost([broken.stage, canvas.stage], errors);
    host.load(docOf([refLayer('l1', 'hero')]));
    expect(canvas.updates[0]).toHaveLength(1);
    expect(errors).toEqual([new Error('accepts failed')]);
  });

  it('reports unknown properties once per document, and skips only that track', () => {
    const { canvas, stages } = setup();
    const host = createHost(stages);
    const layer = refLayer('l1', 'hero', undefined, { x: [{ frame: 1, value: 1 }], wobble: [{ frame: 1, value: 2 }] });
    host.load(docOf([layer]));
    host.render({ timeMs: 0, frame: 1, integerFrame: 1 });
    host.render({ timeMs: 100, frame: 2, integerFrame: 2 });
    expect(host.warnings).toEqual([expect.objectContaining({ code: 'unknown-property', stageId: 'canvas', layerId: 'l1', property: 'wobble' })]);
    expect(canvas.renders[1].states[0].values).toEqual({ x: 1 });
    expect(canvas.updates[0][0].layer.spans[0].tracks).toEqual({ x: [{ frame: 1, value: 1 }] });
  });
});

describe('buildStageRegistry', () => {
  const volume = { name: 'volume', kind: 'value' as const, unit: '', defaultValue: 1 };

  it('keeps the base registry when no stage adds properties', () => {
    expect(buildStageRegistry(defaultPropertyRegistry, [createFakeStage('a').stage])).toBe(defaultPropertyRegistry);
  });

  it('extends a copy with the stage properties', () => {
    const base = createPropertyRegistry();
    const registry = buildStageRegistry(base, [createFakeStage('audio', { properties: [volume] }).stage]);
    expect(registry).not.toBe(base);
    expect(registry.has('volume')).toBe(true);
    expect(base.has('volume')).toBe(false);
  });

  it('refuses a name conflict with a clear error', () => {
    const stages = [createFakeStage('audio', { properties: [volume] }).stage, createFakeStage('video', { properties: [volume] }).stage];
    expect(() => buildStageRegistry(defaultPropertyRegistry, stages)).toThrow('Stage "video" declares the property "volume", which is already registered. Prefix it (e.g. "videoVolume").');
  });

  it('names the stage of a malformed descriptor', () => {
    const stage = createFakeStage('audio', { properties: [{ ...volume, name: '_bad' }] }).stage;
    expect(() => buildStageRegistry(defaultPropertyRegistry, [stage])).toThrow(/^Stage "audio": Invalid property "_bad"/);
  });
});
