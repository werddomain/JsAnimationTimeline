// tools/conventions/src/types.ts
/** Une violation de convention, rapportée avec son fichier. */
export interface Violation {
  readonly file: string;
  readonly rule: 'path-header' | 'plugin-header';
  readonly message: string;
}
