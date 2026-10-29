// packages/editor/src/model/spans/__tests__/tracks.test.ts
/**
 * Tests des outils sur les pistes : transformation, recalage proportionnel,
 * décalage et champ `tracks` optionnel.
 */

import { mapKeyframes, retimeKeyframes, shiftSpan, tracksFromValues, withTracks } from '../tracks';

describe('mapKeyframes', () => {
  it("trie, garde la dernière image clé d'une même image et retire les pistes vides", () => {
    const tracks = { x: [{ frame: 1, value: 1 }, { frame: 3, value: 3 }], y: [{ frame: 2, value: 2 }] };
    const mapped = mapKeyframes(tracks, (keyframe) => (keyframe.frame === 2 ? undefined : { ...keyframe, frame: 5 - keyframe.frame }));
    expect(mapped).toEqual({ x: [{ frame: 2, value: 3 }, { frame: 4, value: 1 }] });
    expect(mapKeyframes(tracks, () => undefined)).toBeUndefined();
    expect(mapKeyframes(undefined, (keyframe) => keyframe)).toBeUndefined();
  });

  it('en cas de collision, la dernière image clé dans l’ordre d’origine gagne', () => {
    const tracks = { x: [{ frame: 1, value: 1 }, { frame: 2, value: 2 }] };
    expect(mapKeyframes(tracks, (keyframe) => ({ ...keyframe, frame: 1 }))).toEqual({ x: [{ frame: 1, value: 2 }] });
  });
});

describe('retimeKeyframes', () => {
  it('recale proportionnellement et arrondit', () => {
    const tracks = { x: [{ frame: 1, value: 0 }, { frame: 4, value: 3 }, { frame: 11, value: 9 }] };
    expect(retimeKeyframes(tracks, { start: 1, end: 11 }, { start: 1, end: 21 })).toEqual({
      x: [{ frame: 1, value: 0 }, { frame: 7, value: 3 }, { frame: 21, value: 9 }]
    });
  });

  it("place tout au début quand la plage d'origine n'a qu'une image", () => {
    const tracks = { x: [{ frame: 5, value: 1 }] };
    expect(retimeKeyframes(tracks, { start: 5, end: 5 }, { start: 8, end: 12 })).toEqual({ x: [{ frame: 8, value: 1 }] });
  });
});

describe('outils de plage', () => {
  it('shiftSpan décale la plage et ses images clés', () => {
    const span = { id: 's', start: 3, end: 6, kind: 'tween' as const, easing: 'ease' as const, tracks: { x: [{ frame: 3, value: 1 }] } };
    expect(shiftSpan(span, 2)).toEqual({ id: 's', start: 5, end: 8, kind: 'tween', easing: 'ease', tracks: { x: [{ frame: 5, value: 1 }] } });
  });

  it('withTracks retire ou pose le champ tracks', () => {
    const span = { id: 's', start: 1, end: 2, kind: 'static' as const, tracks: { x: [{ frame: 1, value: 1 }] } };
    expect(withTracks(span, undefined)).toEqual({ id: 's', start: 1, end: 2, kind: 'static' });
    expect('tracks' in withTracks(span, undefined)).toBe(false);
  });

  it('tracksFromValues crée une image clé par valeur', () => {
    expect(tracksFromValues({ x: 1, y: 2 }, 4)).toEqual({ x: [{ frame: 4, value: 1 }], y: [{ frame: 4, value: 2 }] });
    expect(tracksFromValues({}, 4)).toBeUndefined();
  });
});
