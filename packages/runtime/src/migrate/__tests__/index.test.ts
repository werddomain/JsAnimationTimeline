// packages/runtime/src/migrate/__tests__/index.test.ts
/**
 * The package entry point re-exports the migrator API.
 */

import * as runtime from '../../index';

describe('runtime entry point (migrate)', () => {
  it('exports the migrator values', () => {
    expect(Object.keys(runtime)).toEqual(expect.arrayContaining([
      'MAX_FOLDER_DEPTH',
      'MigrationError',
      'MigrationErrorCodes',
      'MigrationWarningCodes',
      'V1_DEFAULT_FPS',
      'isV1Document',
      'migrateToV2',
      'migrateV1'
    ]));
  });
});
