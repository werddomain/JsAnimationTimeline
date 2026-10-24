// packages/editor/src/model/spans/__tests__/insertKeyframe.test.ts
/**
 * Tests de l'insertion d'une image clé (F6) et d'une image clé vide (F7).
 */

import { BUILTIN_PROPERTIES, PropertyRegistry, evaluateLayer } from '@werddomain/timeline-runtime';
import { insertBlankKeyframe, insertKeyframe } from '../insertKeyframe';
import { SpanOperationCodes, SpanOperationError } from '../SpanOperationError';
import { createDoc, createRegistry, expectValid, layer, layerOf, shapeOf, spansOf, tweenDoc } from './fixtures';

const registry = createRegistry();

function staticDoc() {
  return createDoc([layer('l1', [{ id: 's1', start: 1, end: 20, kind: 'static', tracks: { x: [{ frame: 1, value: 50 }] } }])]);
}

function codeOf(action: () => unknown): string | undefined {
  try {
    action();
  } catch (error) {
    if (error instanceof SpanOperationError) return error.code;
    throw error;
  }
  return undefined;
}

describe('insertKeyframe (F6)', () => {
  it('coupe une plage fixe et reprend ses valeurs dans la seconde partie', () => {
    const doc = staticDoc();
    const next = insertKeyframe(doc, 'l1', 10, registry);
    expect(shapeOf(next, 'l1')).toEqual(['static 1-9', 'static 10-20']);
    expect(spansOf(next, 'l1')[1]).toEqual({ id: 'l1-k1', start: 10, end: 20, kind: 'static', tracks: { x: [{ frame: 10, value: 50 }] } });
    expect(spansOf(next, 'l1')[0].tracks).toEqual({ x: [{ frame: 1, value: 50 }] });
    expectValid(next);
    expect(shapeOf(doc, 'l1')).toEqual(['static 1-20']);
  });

  it('ajoute une image clé de propriété interpolée dans une interpolation, sans la couper', () => {
    const next = insertKeyframe(tweenDoc(), 'l1', 6, registry);
    expect(shapeOf(next, 'l1')).toEqual(['tween 1-11', 'static 12-20']);
    expect(spansOf(next, 'l1')[0].tracks).toEqual({
      x: [{ frame: 1, value: 0 }, { frame: 6, value: 50 }, { frame: 11, value: 100 }]
    });
    expectValid(next);
  });

  it("prend la valeur accélérée calculée par l'évaluation du runtime", () => {
    const base = tweenDoc();
    const eased = createDoc([{ ...layerOf(base, 'l1'), spans: [{ ...spansOf(base, 'l1')[0], easing: 'ease-in' }, spansOf(base, 'l1')[1]] }]);
    const expected = evaluateLayer(layerOf(eased, 'l1'), 6, { registry }).values.x;
    const next = insertKeyframe(eased, 'l1', 6, registry);
    expect(spansOf(next, 'l1')[0].tracks?.x[1]).toEqual({ frame: 6, value: expected });
    expect(expected).toBeLessThan(50);
  });

  it('utilise le registre reçu en paramètre', () => {
    const custom = new PropertyRegistry(
      BUILTIN_PROPERTIES.map((descriptor) => (descriptor.name === 'x' ? { ...descriptor, interpolate: () => 42 } : descriptor))
    );
    const next = insertKeyframe(tweenDoc(), 'l1', 6, custom);
    expect(spansOf(next, 'l1')[0].tracks?.x[1]).toEqual({ frame: 6, value: 42 });
  });

  it('ne change rien sur une image clé existante', () => {
    const doc = tweenDoc();
    expect(insertKeyframe(doc, 'l1', 12, registry)).toBe(doc);
    expect(insertKeyframe(doc, 'l1', 1, registry)).toBe(doc);
  });

  it("ne change rien quand chaque propriété a déjà une image clé à l'image", () => {
    const doc = tweenDoc();
    const once = insertKeyframe(doc, 'l1', 6, registry);
    expect(insertKeyframe(once, 'l1', 6, registry)).toBe(once);
  });

  it('coupe une plage vide en deux plages vides', () => {
    const doc = createDoc([layer('l1', [{ id: 'b1', start: 1, end: 10, kind: 'blank' }])]);
    const next = insertKeyframe(doc, 'l1', 5, registry);
    expect(shapeOf(next, 'l1')).toEqual(['blank 1-4', 'blank 5-10']);
    expect(spansOf(next, 'l1')[1].tracks).toBeUndefined();
    expectValid(next);
  });

  it('après la dernière plage, prolonge la plage et ajoute une image clé avec les valeurs tenues', () => {
    const doc = createDoc([layer('l1', [{ id: 's1', start: 1, end: 5, kind: 'static', tracks: { x: [{ frame: 1, value: 30 }] } }])]);
    const next = insertKeyframe(doc, 'l1', 10, registry);
    expect(shapeOf(next, 'l1')).toEqual(['static 1-9', 'static 10-10']);
    expect(spansOf(next, 'l1')[1].tracks).toEqual({ x: [{ frame: 10, value: 30 }] });
    expectValid(next);
  });

  it('après une interpolation, reprend la dernière valeur', () => {
    const doc = createDoc([layer('l1', [spansOf(tweenDoc(), 'l1')[0]])]);
    const next = insertKeyframe(doc, 'l1', 15, registry);
    expect(shapeOf(next, 'l1')).toEqual(['tween 1-14', 'static 15-15']);
    expect(spansOf(next, 'l1')[1].tracks).toEqual({ x: [{ frame: 15, value: 100 }] });
    expectValid(next);
  });

  it('après une plage vide, ajoute une image clé vide', () => {
    const doc = createDoc([layer('l1', [{ id: 'b1', start: 1, end: 3, kind: 'blank' }])]);
    expect(shapeOf(insertKeyframe(doc, 'l1', 6, registry), 'l1')).toEqual(['blank 1-5', 'blank 6-6']);
  });

  it('sur un calque vide, crée une plage vide puis une image clé de contenu', () => {
    const doc = createDoc([layer('l1', [])]);
    const next = insertKeyframe(doc, 'l1', 5, registry);
    expect(shapeOf(next, 'l1')).toEqual(['blank 1-4', 'static 5-5']);
    expect(spansOf(next, 'l1')[1].tracks).toBeUndefined();
    expect(spansOf(next, 'l1').map((span) => span.id)).toEqual(['l1-k1', 'l1-k2']);
    expectValid(next);
    expect(shapeOf(insertKeyframe(doc, 'l1', 1, registry), 'l1')).toEqual(['static 1-1']);
  });

  it('choisit un id libre dans tout le document', () => {
    const doc = createDoc([
      layer('l1', [{ id: 's1', start: 1, end: 20, kind: 'static' }]),
      layer('l1-k1', [{ id: 'l1-k2', start: 1, end: 2, kind: 'blank' }])
    ]);
    const next = insertKeyframe(doc, 'l1', 10, registry);
    expect(spansOf(next, 'l1')[1].id).toBe('l1-k3');
    expectValid(next);
  });

  it('modifie un calque rangé dans un dossier', () => {
    const doc = createDoc([
      { id: 'f1', type: 'folder', name: 'Dossier', children: [layer('l1', [{ id: 's1', start: 1, end: 20, kind: 'static' }])] }
    ]);
    const next = insertKeyframe(doc, 'l1', 4, registry);
    expect(shapeOf(next, 'l1')).toEqual(['static 1-3', 'static 4-20']);
    expectValid(next);
  });

  it('refuse un calque verrouillé, directement ou par un dossier parent', () => {
    const locked = createDoc([layer('l1', [{ id: 's1', start: 1, end: 20, kind: 'static' }], { locked: true })]);
    expect(codeOf(() => insertKeyframe(locked, 'l1', 4, registry))).toBe(SpanOperationCodes.LAYER_LOCKED);
    const inLockedFolder = createDoc([
      { id: 'f1', type: 'folder', name: 'Dossier', locked: true, children: [layer('l1', [])] }
    ]);
    expect(codeOf(() => insertKeyframe(inLockedFolder, 'l1', 4, registry))).toBe(SpanOperationCodes.LAYER_LOCKED);
  });

  it('refuse un calque introuvable ou un dossier', () => {
    const doc = createDoc([{ id: 'f1', type: 'folder', name: 'Dossier', children: [] }]);
    expect(codeOf(() => insertKeyframe(doc, 'absent', 1, registry))).toBe(SpanOperationCodes.LAYER_NOT_FOUND);
    expect(codeOf(() => insertKeyframe(doc, 'f1', 1, registry))).toBe(SpanOperationCodes.LAYER_NOT_FOUND);
  });

  it.each([0, 25, 1.5, Number.NaN])("refuse l'image %p", (frame) => {
    expect(codeOf(() => insertKeyframe(staticDoc(), 'l1', frame, registry))).toBe(SpanOperationCodes.INVALID_FRAME);
  });

  it('refuse quand une propriété est inconnue du registre', () => {
    const doc = createDoc([layer('l1', [{ id: 's1', start: 1, end: 20, kind: 'static', tracks: { glow: [{ frame: 1, value: 1 }] } }])]);
    expect(codeOf(() => insertKeyframe(doc, 'l1', 5, registry))).toBe(SpanOperationCodes.EVALUATION_FAILED);
  });
});

describe('insertBlankKeyframe (F7)', () => {
  it('coupe une plage fixe ; la seconde partie devient vide', () => {
    const next = insertBlankKeyframe(createDoc([layer('l1', [{ id: 's1', start: 1, end: 20, kind: 'static' }])]), 'l1', 10, registry);
    expect(shapeOf(next, 'l1')).toEqual(['static 1-9', 'blank 10-20']);
    expectValid(next);
  });

  it("arrête une interpolation à l'image d'avant, avec les valeurs atteintes", () => {
    const doc = tweenDoc();
    const eased = createDoc([{ ...layerOf(doc, 'l1'), spans: [{ ...spansOf(doc, 'l1')[0], easing: 'ease-out' }, spansOf(doc, 'l1')[1]] }]);
    const next = insertBlankKeyframe(eased, 'l1', 6, registry);
    expect(shapeOf(next, 'l1')).toEqual(['tween 1-5', 'blank 6-11', 'static 12-20']);
    const first = spansOf(next, 'l1')[0];
    expect(first.easing).toBe('ease-out');
    expect(first.tracks?.x).toEqual([
      { frame: 1, value: 0 },
      { frame: 5, value: evaluateLayer(layerOf(eased, 'l1'), 5, { registry }).values.x }
    ]);
    expectValid(next);
  });

  it("garde une image clé déjà présente à l'image d'avant", () => {
    const doc = createDoc([
      layer('l1', [{ id: 't1', start: 1, end: 11, kind: 'tween', tracks: { x: [{ frame: 1, value: 0 }, { frame: 5, value: 7 }, { frame: 11, value: 100 }] } }])
    ]);
    const next = insertBlankKeyframe(doc, 'l1', 6, registry);
    expect(spansOf(next, 'l1')[0].tracks?.x).toEqual([{ frame: 1, value: 0 }, { frame: 5, value: 7 }]);
  });

  it("ajoute l'image clé de fin aux pistes qui commencent plus tard", () => {
    const doc = createDoc([
      layer('l1', [{ id: 't1', start: 1, end: 11, kind: 'tween', tracks: { x: [{ frame: 8, value: 80 }] } }])
    ]);
    const next = insertBlankKeyframe(doc, 'l1', 6, registry);
    const reached = evaluateLayer(layerOf(doc, 'l1'), 5, { registry }).values.x;
    expect(spansOf(next, 'l1')[0].tracks?.x).toEqual([{ frame: 5, value: reached }]);
    expect(evaluateLayer(layerOf(next, 'l1'), 5, { registry }).values.x).toBeCloseTo(reached);
    expectValid(next);
  });

  it('coupe une plage vide', () => {
    const next = insertBlankKeyframe(createDoc([layer('l1', [{ id: 'b1', start: 1, end: 9, kind: 'blank' }])]), 'l1', 4, registry);
    expect(shapeOf(next, 'l1')).toEqual(['blank 1-3', 'blank 4-9']);
  });

  it('après la dernière plage ou sur un calque vide, ajoute une image clé vide', () => {
    const doc = createDoc([layer('l1', [{ id: 's1', start: 1, end: 5, kind: 'static' }]), layer('l2', [])]);
    expect(shapeOf(insertBlankKeyframe(doc, 'l1', 8, registry), 'l1')).toEqual(['static 1-7', 'blank 8-8']);
    expect(shapeOf(insertBlankKeyframe(doc, 'l2', 3, registry), 'l2')).toEqual(['blank 1-2', 'blank 3-3']);
  });

  it('ne change rien sur une image clé existante', () => {
    const doc = tweenDoc();
    expect(insertBlankKeyframe(doc, 'l1', 12, registry)).toBe(doc);
  });
});
