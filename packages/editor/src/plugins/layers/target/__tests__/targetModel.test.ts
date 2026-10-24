// packages/editor/src/plugins/layers/target/__tests__/targetModel.test.ts
/**
 * Tests du modèle de `layers.target`, sans DOM : saisie libre transformée en
 * cible (sélecteur, ref, scène facultative), contrôle de forme de F06 (une
 * cible vivante `{ element }` ou mal formée est refusée, un sélecteur CSS
 * invalide est accepté), commande annulable « Changer la cible du calque »
 * (une entrée d'historique par changement, aucune sans changement, calque
 * dans un dossier, cible absente remise à l'annulation), et alerte de cible
 * manquante (raison en français, rien en mode timeline seule).
 */

import { StageReportCodes, findNodeById, isLayer } from '@werddomain/timeline-runtime';
import type { IStageReport, ITimelineDocument, LayerTarget } from '@werddomain/timeline-runtime';
import { createCommandStackHarness } from './fixtures';
import { TARGET_LABEL, createSetTargetCommand } from '../targetCommands';
import { TargetAlertLabels, computeTargetAlert } from '../targetAlert';
import type { ITargetAlertSource } from '../targetAlert';
import { checkTargetShape, targetFromInput, toSavableTarget } from '../targetValidation';

const tree: ITimelineDocument = {
  version: '2.0.0',
  settings: { fps: 24, totalFrames: 24 },
  layers: [
    { id: 'hero', type: 'layer', name: 'Héros', target: { selector: '#hero' }, spans: [] },
    { id: 'f', type: 'folder', name: 'Dossier', children: [{ id: 'bare', type: 'layer', name: 'Nu', spans: [] }] }
  ]
};

function targetOf(doc: ITimelineDocument, id: string): LayerTarget | undefined {
  const node = findNodeById(doc.layers, id);
  return node !== undefined && isLayer(node) ? node.target : undefined;
}

describe('targetFromInput', () => {
  it('builds a selector or a ref target from trimmed text', () => {
    // Assert
    expect(targetFromInput({ kind: 'selector', text: '  #logo ' })).toEqual({ selector: '#logo' });
    expect(targetFromInput({ kind: 'ref', text: 'hero' })).toEqual({ ref: 'hero' });
    expect(targetFromInput({ kind: 'ref', text: 'hero', stage: 'canvas' })).toEqual({ ref: 'hero', stage: 'canvas' });
  });

  it('drops an empty stage and refuses empty text', () => {
    // Assert
    expect(targetFromInput({ kind: 'ref', text: 'hero', stage: '  ' })).toEqual({ ref: 'hero' });
    expect(targetFromInput({ kind: 'selector', text: '   ' })).toBeUndefined();
  });
});

describe('target shape check', () => {
  it('accepts selector and ref targets, and an invalid CSS selector', () => {
    // Assert
    expect(checkTargetShape({ selector: '#hero' })).toEqual([]);
    expect(checkTargetShape({ ref: 'hero', stage: 'canvas' })).toEqual([]);
    expect(checkTargetShape({ selector: 'div[' })).toEqual([]);
  });

  it('refuses a live element, two keys, an unknown field and empty strings', () => {
    // Assert
    expect(checkTargetShape({ element: document.createElement('div') })).not.toEqual([]);
    expect(checkTargetShape({ selector: '#a', ref: 'a' })).not.toEqual([]);
    expect(checkTargetShape({ ref: 'a', extra: 1 })).not.toEqual([]);
    expect(checkTargetShape({ selector: '' })).not.toEqual([]);
    expect(checkTargetShape({ ref: 'a', stage: '' })).not.toEqual([]);
    expect(checkTargetShape('div')).not.toEqual([]);
  });

  it('returns a fresh plain copy of a valid target, undefined otherwise', () => {
    // Arrange
    const given = { ref: 'hero', stage: 'canvas' };

    // Act
    const saved = toSavableTarget(given);

    // Assert
    expect(saved).toEqual(given);
    expect(saved).not.toBe(given);
    expect(toSavableTarget({ element: document.createElement('div') })).toBeUndefined();
  });
});

describe('createSetTargetCommand', () => {
  it('changes the target and undoes and redoes it as one history entry', () => {
    // Arrange
    const { stack, read } = createCommandStackHarness(tree);

    // Act
    const changed = stack.execute(createSetTargetCommand(read(), 'hero', { ref: 'hero', stage: 'canvas' }));
    const afterExecute = targetOf(read(), 'hero');
    stack.undo();
    const afterUndo = read();
    stack.redo();

    // Assert
    expect(changed).toBe(true);
    expect(afterExecute).toEqual({ ref: 'hero', stage: 'canvas' });
    expect(afterUndo).toEqual(tree);
    expect(targetOf(read(), 'hero')).toEqual({ ref: 'hero', stage: 'canvas' });
    expect(stack.undoLabel).toBe(TARGET_LABEL);
  });

  it('sets the target of a layer inside a folder and removes it again on undo', () => {
    // Arrange
    const { stack, read } = createCommandStackHarness(tree);

    // Act
    stack.execute(createSetTargetCommand(read(), 'bare', { selector: '.tree' }));
    const set = targetOf(read(), 'bare');
    stack.undo();

    // Assert
    expect(set).toEqual({ selector: '.tree' });
    expect(findNodeById(read().layers, 'bare')).not.toHaveProperty('target');
  });

  it('adds no history entry when the target does not change', () => {
    // Arrange
    const { stack, read } = createCommandStackHarness(tree);

    // Act
    const changed = stack.execute(createSetTargetCommand(read(), 'hero', { selector: '#hero' }));

    // Assert
    expect(changed).toBe(false);
    expect(stack.canUndo).toBe(false);
  });

  it('refuses a folder, an unknown layer and a target that fails the shape check', () => {
    // Assert
    expect(() => createSetTargetCommand(tree, 'f', { selector: '#a' })).toThrow(/calque/);
    expect(() => createSetTargetCommand(tree, 'nope', { selector: '#a' })).toThrow(/nope/);
    expect(() => createSetTargetCommand(tree, 'hero', { element: document.createElement('div') })).toThrow(/cible/);
  });
});

describe('computeTargetAlert', () => {
  const report = (code: IStageReport['code'], layerId: string, stageId?: string): IStageReport =>
    ({ code, layerId, stageId, message: '' });
  const source = (missing: readonly string[], warnings: readonly IStageReport[] = [], stages = 1): ITargetAlertSource => ({
    stages: Array.from({ length: stages }, (_, index) => ({ id: `s${index}` })),
    missingTargets: missing,
    warnings
  });

  it('shows nothing in timeline-only mode or when the target was found', () => {
    // Assert
    expect(computeTargetAlert(source(['hero'], [], 0), 'hero', { selector: '#a' }).missing).toBe(false);
    expect(computeTargetAlert(source([]), 'hero', { selector: '#a' }).missing).toBe(false);
  });

  it('shows nothing for a layer without target', () => {
    // Assert
    expect(computeTargetAlert(source(['bare']), 'bare', undefined)).toEqual({ missing: false, reason: null, label: '' });
  });

  it('names the reason from the stage warnings of the layer', () => {
    // Arrange
    const warnings = [
      report(StageReportCodes.UNROUTED, 'a'),
      report(StageReportCodes.UNKNOWN_STAGE, 'b', 'audio'),
      report(StageReportCodes.UNROUTED, 'other')
    ];
    const stage = source(['a', 'b', 'c'], warnings);

    // Act
    const unrouted = computeTargetAlert(stage, 'a', { ref: 'a' });
    const unknown = computeTargetAlert(stage, 'b', { ref: 'b', stage: 'audio' });
    const notFound = computeTargetAlert(stage, 'c', { selector: '#c' });

    // Assert
    expect(unrouted).toEqual({ missing: true, reason: 'unrouted', label: TargetAlertLabels.unrouted });
    expect(unknown).toEqual({ missing: true, reason: 'unknown-stage', label: TargetAlertLabels.unknownStage('audio') });
    expect(notFound).toEqual({ missing: true, reason: 'not-found', label: TargetAlertLabels.notFound });
  });
});
