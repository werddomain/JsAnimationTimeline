// packages/editor/src/core/stage/__tests__/EditorStage.followups3.test.ts
/**
 * Tests du deuxième suivi de la revue de C7, chacun échouant sans son
 * correctif : erreur de `sync` annoncée une seule fois quand deux documents
 * arrivent dans la même image, désabonnement de l'éditeur qui lève pendant
 * `destroy`, commande lancée par un gestionnaire de `stage:report` pendant le
 * rendu qui suit un chargement, annonce des cibles manquantes après un
 * document refusé, et annonce reportée en fin de chargement une seule fois.
 */

import { defaultPropertyRegistry, StageDocumentError, StageReportCodes } from '@werddomain/timeline-runtime';
import type { IStageContext, IStageReport } from '@werddomain/timeline-runtime';
import { createDocument } from '../../commands/__tests__/fixtures';
import { createCommand } from '../../commands/createCommand';
import { cleanBody } from '../../editor/__tests__/fixtures';
import { EventBus } from '../../events/EventBus';
import type { EventName } from '../../events/EventBus';
import type { TimelineEventMap } from '../../events/TimelineEventMap';
import { Store } from '../../store/Store';
import { EditorStageHost } from '../EditorStageHost';
import { DISPLAY_FRAME_MS, createFakeStage, createStageEditor, deleteLayer, setTarget } from './fixtures';

afterEach(cleanBody);

const touch = createCommand('Toucher', (doc) => ({ ...doc }), (doc) => ({ ...doc }));

describe('stage:report with several documents per display frame', () => {
  it('announces a throwing sync once, even with two commands per frame', () => {
    // Arrange
    const stage = createFakeStage();
    stage.sync = () => {
      throw new Error('synchro');
    };
    const errors = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { editor, clock } = createStageEditor({}, stage);
    const reports: IStageReport[] = [];
    editor.on('stage:report', (report) => reports.push(report));

    try {
      // Act
      clock.advance(DISPLAY_FRAME_MS);
      for (let frame = 0; frame < 5; frame += 1) {
        editor.execute(touch);
        editor.execute(touch);
        clock.advance(DISPLAY_FRAME_MS);
      }

      // Assert
      expect(reports.map((report) => report.code)).toEqual([StageReportCodes.STAGE_ERROR]);
    } finally {
      errors.mockRestore();
    }
  });
});

/** Bus dont le désabonnement de `document:changed` lève. */
class ThrowingUnsubscribeBus extends EventBus {
  override on<K extends EventName<TimelineEventMap>>(name: K, handler: (payload: TimelineEventMap[K]) => void): () => void {
    const off = super.on(name, handler);
    if (name !== 'document:changed') return off;
    return () => {
      off();
      throw new Error('désabonnement');
    };
  }
}

describe('EditorStageHost destroy', () => {
  it('detaches the stages even when one of its own unsubscribes throws', () => {
    // Arrange
    const stage = createFakeStage();
    const bus = new ThrowingUnsubscribeBus();
    const store = new Store(bus, createDocument());
    const errors: unknown[] = [];
    const host = new EditorStageHost({
      bus, store, stages: [stage], registry: defaultPropertyRegistry,
      onError: (error) => errors.push(error),
      now: () => ({ time: { timeMs: 0, frame: 1, integerFrame: 1 }, state: { playing: false, speed: 1 } })
    });
    stage.log.length = 0;

    // Act
    host.destroy();

    // Assert
    expect(stage.log).toEqual(['detach']);
    expect(errors).toHaveLength(1);
  });
});

describe('re-entrancy around the post-load render', () => {
  it('queues a command run by a stage:report handler during the render that follows a load', () => {
    // Arrange
    const stage = createFakeStage();
    let reportOnce = false;
    let inRender = false;
    const nested: string[] = [];
    let stageContext: IStageContext | null = null;
    stage.attach = (ctx) => {
      stageContext = ctx;
    };
    const render = stage.render?.bind(stage);
    stage.render = (time, states) => {
      inRender = true;
      render?.(time, states);
      if (reportOnce) {
        reportOnce = false;
        // Avertissement envoyé pendant le rendu : le gestionnaire de stage:report s'exécute ici même.
        stageContext?.report({ code: StageReportCodes.DUPLICATE_TARGET, layerId: 'l-hero', message: 'double' });
      }
      inRender = false;
    };
    const update = stage.update?.bind(stage);
    stage.update = (doc, layers) => {
      if (inRender) nested.push('update pendant le rendu');
      update?.(doc, layers);
    };
    const { editor } = createStageEditor({ onStageError: () => undefined }, stage);
    let ran = false;
    editor.on('stage:report', () => {
      if (ran) return;
      ran = true;
      editor.execute(touch);
    });

    // Act
    reportOnce = true;
    editor.execute(touch);

    // Assert
    expect(ran).toBe(true);
    expect(nested).toEqual([]);
    expect(editor.canUndo).toBe(true);
  });
});

describe('stage:targetsChanged around loads', () => {
  it('announces after a refused document whose rollback changed the missing targets', () => {
    // Arrange
    const stage = createFakeStage({ missing: ['tree'] });
    const update = stage.update?.bind(stage);
    stage.update = (doc, layers) => {
      update?.(doc, layers);
      if (doc.layers[0]?.name === 'refusé') {
        stage.objects.set('tree', { name: 'tree' });
        stage.notifyTargets();
        throw new StageDocumentError('non');
      }
    };
    const { editor } = createStageEditor({ onStageError: () => undefined }, stage);
    const announced: (readonly string[])[] = [];
    editor.on('stage:targetsChanged', ({ missingTargets }) => announced.push(missingTargets));
    const refused = createCommand(
      'Refusé',
      (doc) => ({ ...doc, layers: [{ ...doc.layers[0], name: 'refusé' }, doc.layers[1]] }),
      (doc) => doc
    );

    // Act
    editor.execute(refused);

    // Assert
    expect(announced).toEqual([[]]);
  });

  it('announces once, after the load, when a stage signals new targets during the load', () => {
    // Arrange
    const stage = createFakeStage({ missing: ['tree'] });
    const update = stage.update?.bind(stage);
    stage.update = (doc, layers) => {
      update?.(doc, layers);
      if (!stage.objects.has('tree') && layers.some((layer) => layer.object === stage.objects.get('sun'))) {
        stage.objects.set('tree', { name: 'tree' });
        stage.notifyTargets();
      }
    };
    const { editor } = createStageEditor({}, stage);
    const announced: string[] = [];
    // Nombre de rendus au moment de l'annonce : après la nouvelle tentative (1) et le rendu d'après chargement (2).
    editor.on('stage:targetsChanged', ({ missingTargets }) => {
      announced.push(`${missingTargets.join(',')}@${stage.log.filter((entry) => entry.startsWith('render')).length}`);
    });
    stage.log.length = 0;

    // Act
    editor.execute(setTarget('l-hero', { ref: 'sun', stage: 'fake' }, { ref: 'hero', stage: 'fake' }));

    // Assert
    expect(announced).toEqual(['@2']);
  });
});

describe('stage:report with the stage hold (#76)', () => {
  it('announces a throwing sync once when it first runs at flush, and not again on the next frame', () => {
    // Arrange
    const stage = createFakeStage();
    let throwing = false;
    stage.sync = () => {
      if (throwing) throw new Error('synchro');
    };
    const errors = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { editor, clock } = createStageEditor({}, stage);
    clock.advance(DISPLAY_FRAME_MS);
    const reports: IStageReport[] = [];
    editor.on('stage:report', (report) => reports.push(report));
    const hold = editor.stage.hold();

    try {
      // Act
      throwing = true;
      editor.execute(touch);
      clock.advance(DISPLAY_FRAME_MS);
      hold.flush();
      editor.execute(touch);
      clock.advance(DISPLAY_FRAME_MS);
      hold.release();
      clock.advance(DISPLAY_FRAME_MS);
      editor.execute(touch);
      clock.advance(DISPLAY_FRAME_MS);

      // Assert
      expect(reports.map((report) => report.code)).toEqual([StageReportCodes.STAGE_ERROR]);
    } finally {
      errors.mockRestore();
    }
  });

  it('does not announce again a render-time report after two loads while held, then release', () => {
    // Arrange
    const stage = createFakeStage();
    let stageContext: IStageContext | null = null;
    stage.attach = (ctx) => {
      stageContext = ctx;
    };
    const render = stage.render?.bind(stage);
    stage.render = (time, states) => {
      render?.(time, states);
      stageContext?.report({ code: StageReportCodes.DUPLICATE_TARGET, layerId: 'l-hero', message: 'double' });
    };
    const { editor, clock } = createStageEditor({}, stage);
    clock.advance(DISPLAY_FRAME_MS);
    const reports: IStageReport[] = [];
    editor.on('stage:report', (report) => reports.push(report));
    const hold = editor.stage.hold();

    // Act
    editor.execute(touch);
    editor.execute(touch);
    clock.advance(DISPLAY_FRAME_MS);
    hold.release();
    clock.advance(DISPLAY_FRAME_MS);

    // Assert
    expect(reports).toEqual([]);
  });
});

describe('load-time warnings under a hold (#78 follow-up)', () => {
  it('announces again an unknown-stage warning that went away and came back while held', () => {
    // Arrange
    const { editor, clock } = createStageEditor();
    editor.execute(setTarget('l-tree', { ref: 'tree', stage: 'nope' }, { ref: 'tree', stage: 'fake' }));
    clock.advance(DISPLAY_FRAME_MS);
    const reports: IStageReport[] = [];
    editor.on('stage:report', (report) => reports.push(report));
    const hold = editor.stage.hold();

    // Act : supprimer le calque, annuler (il revient), relâcher.
    editor.execute(deleteLayer('l-tree', editor.document));
    editor.undo();
    hold.release();

    // Assert
    expect(reports.map((report) => [report.code, report.layerId])).toEqual([[StageReportCodes.UNKNOWN_STAGE, 'l-tree']]);
  });
});

describe('hold catch-up counts as a full pass', () => {
  it('stops carrying a render-time report once the catch-up sync and render ran without it', () => {
    // Arrange
    const stage = createFakeStage();
    let reporting = true;
    let stageContext: IStageContext | null = null;
    stage.attach = (ctx) => {
      stageContext = ctx;
    };
    const render = stage.render?.bind(stage);
    stage.render = (time, states) => {
      render?.(time, states);
      if (reporting) stageContext?.report({ code: StageReportCodes.DUPLICATE_TARGET, layerId: 'l-hero', message: 'double' });
    };
    const { editor, clock } = createStageEditor({}, stage);
    const reports: IStageReport[] = [];
    editor.on('stage:report', (report) => reports.push(report));
    clock.advance(DISPLAY_FRAME_MS);
    const hold = editor.stage.hold();

    // Act : D1 sous retenue (une image retenue), rattrapage sans l'avertissement, puis D2 où il revient.
    reporting = false;
    editor.execute(touch);
    clock.advance(DISPLAY_FRAME_MS);
    hold.release();
    reporting = true;
    editor.execute(touch);

    // Assert : annoncé au premier rendu, puis de nouveau après le passage complet du rattrapage.
    expect(reports.map((report) => report.code)).toEqual([StageReportCodes.DUPLICATE_TARGET, StageReportCodes.DUPLICATE_TARGET]);
  });
});
