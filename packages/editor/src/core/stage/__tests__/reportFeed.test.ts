// packages/editor/src/core/stage/__tests__/reportFeed.test.ts
/**
 * Tests de `StageReportFeed` : rien avant `start`, puis une seule émission
 * des avertissements courants ; en direct, seuls les avertissements absents
 * du document précédent sont émis ; un avertissement disparu puis revenu est
 * émis de nouveau ; la clé distingue code, scène, calque et propriété.
 */

import { StageReportCodes } from '@werddomain/timeline-runtime';
import type { IStageReport } from '@werddomain/timeline-runtime';
import { StageReportFeed, reportKey } from '../reportFeed';

const unknownStage: IStageReport = { code: StageReportCodes.UNKNOWN_STAGE, stageId: 'nope', layerId: 'l1', message: 'a' };
const unrouted: IStageReport = { code: StageReportCodes.UNROUTED, layerId: 'l2', message: 'b' };

describe('StageReportFeed', () => {
  it('emits nothing before start, then the current warnings once', () => {
    // Arrange
    const emitted: IStageReport[] = [];
    const feed = new StageReportFeed((report) => emitted.push(report));

    // Act
    feed.add(unknownStage);
    feed.start([unknownStage]);
    feed.start([unknownStage]);

    // Assert
    expect(emitted).toEqual([unknownStage]);
  });

  it('emits only warnings missing from the previous document, and again after they come back', () => {
    // Arrange
    const emitted: IStageReport[] = [];
    const feed = new StageReportFeed((report) => emitted.push(report));
    feed.start([]);

    // Act
    feed.beginLoad([]);
    feed.add(unknownStage);
    feed.completePass();
    feed.beginLoad([unknownStage]);
    feed.add(unknownStage);
    feed.add(unrouted);
    feed.completePass();
    feed.beginLoad([unknownStage, unrouted]);
    feed.completePass();
    feed.beginLoad([]);
    feed.add(unknownStage);

    // Assert
    expect(emitted).toEqual([unknownStage, unrouted, unknownStage]);
  });

  it('does not announce again a warning raised after the previous load (render error)', () => {
    // Arrange
    const emitted: IStageReport[] = [];
    const feed = new StageReportFeed((report) => emitted.push(report));
    const renderError: IStageReport = { code: StageReportCodes.STAGE_ERROR, stageId: 'canvas', message: 'boum' };
    feed.start([]);
    feed.beginLoad([]);
    feed.add(renderError);

    // Act
    feed.beginLoad([renderError]);
    feed.add(renderError);
    feed.add(renderError);

    // Assert
    expect(emitted).toEqual([renderError]);
  });

  it('carries stage errors over documents loaded before a full sync and render pass', () => {
    // Arrange
    const emitted: IStageReport[] = [];
    const feed = new StageReportFeed((report) => emitted.push(report));
    const syncError: IStageReport = { code: StageReportCodes.STAGE_ERROR, stageId: 'audio', message: 'synchro' };
    feed.start([]);
    feed.beginLoad([]);
    feed.add(syncError);

    // Act : B puis C dans la même image, la liste de B n'a jamais vu de sync.
    feed.beginLoad([syncError]);
    feed.beginLoad([]);
    feed.add(syncError);
    feed.completePass();
    feed.beginLoad([]);
    feed.add(syncError);

    // Assert
    expect(emitted).toEqual([syncError, syncError]);
  });

  it('keys reports by code, stage, layer and property', () => {
    // Assert
    expect(reportKey(unknownStage)).not.toBe(reportKey({ ...unknownStage, layerId: 'l3' }));
    expect(reportKey(unknownStage)).not.toBe(reportKey({ ...unknownStage, property: 'x' }));
    expect(reportKey(unknownStage)).toBe(reportKey({ ...unknownStage, message: 'autre' }));
  });
});
