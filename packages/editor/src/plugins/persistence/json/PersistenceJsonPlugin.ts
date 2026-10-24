// packages/editor/src/plugins/persistence/json/PersistenceJsonPlugin.ts
/**
 * Plugin : persistence.json
 * Epic : persistence
 * Dépend de : core
 * Écoute : —
 * Émet : persistence:imported, persistence:exported
 *
 * Import et export JSON du document de l'éditeur, par le service
 * `persistence.json` (voir `types.ts`). Le plugin ne dessine rien : les
 * boutons « Ouvrir » / « Enregistrer » d'une barre d'outils appellent ce
 * service.
 *
 * - Import : `readDocument` (JSON, puis `migrateToV2` pour les fichiers v1,
 *   puis `validateDocument` sans cible vivante), puis une commande annulable
 *   qui remplace le document. Un fichier refusé lève `PersistenceError` et
 *   ne change rien.
 * - Export : `writeDocument` (même validation, puis `JSON.stringify`).
 * - Les cibles des calques passent telles quelles dans les deux sens.
 */

import type { EditorPlugin, IEditorContext } from '../../../core/context/IEditorContext';
import { createImportCommand, IMPORT_COMMAND_LABEL } from './importCommand';
import { readDocument } from './readDocument';
import type { IReadResult } from './readDocument';
import type { IImportResult, IPersistenceJsonOptions, IPersistenceJsonService } from './types';
import { writeDocument } from './writeDocument';
import type { IWriteOptions } from './writeDocument';

/** Identifiant du plugin (et de son service). */
export const PERSISTENCE_JSON_PLUGIN_ID = 'persistence.json';

/** Nom de fichier proposé par défaut par `download()`. */
export const DEFAULT_JSON_FILE_NAME = 'timeline.json';

/** Type MIME du fichier téléchargé. */
const JSON_MIME_TYPE = 'application/json';

/** Délai avant de libérer l'URL du fichier téléchargé (ms). */
const REVOKE_DELAY_MS = 1000;

/** État d'un plugin initialisé (créé dans `init`, libéré dans `destroy`). */
interface IPersistenceState {
  readonly ctx: IEditorContext;
  readonly removeService: () => void;
}

/** Plugin `persistence.json` : import et export JSON du document. */
export class PersistenceJsonPlugin implements EditorPlugin {
  readonly id = 'persistence.json';
  readonly dependencies: readonly string[] = ['core'];
  private readonly options: IPersistenceJsonOptions;
  private state: IPersistenceState | null = null;

  constructor(options: IPersistenceJsonOptions = {}) {
    this.options = options;
  }

  init(ctx: IEditorContext): void {
    const removeService = ctx.services.provide(PERSISTENCE_JSON_PLUGIN_ID, this.createService());
    this.state = { ctx, removeService };
  }

  destroy(): void {
    const state = this.state;
    if (state === null) return;
    this.state = null;
    state.removeService();
  }

  private requireContext(): IEditorContext {
    if (this.state === null) throw new Error('persistence.json : le plugin n\'est pas initialisé (ou a été détruit).');
    return this.state.ctx;
  }

  private importDocument(source: unknown): IImportResult {
    const ctx = this.requireContext();
    const result = readDocument(source);
    const label = this.options.importLabel ?? IMPORT_COMMAND_LABEL;
    const applied = ctx.commands.execute(createImportCommand(result.document, label));
    if (applied) {
      ctx.events.emit('persistence:imported', {
        document: result.document,
        migrated: result.migrated,
        warnings: result.warnings
      });
    }
    return { ...result, applied };
  }

  private exportJson(options: IWriteOptions = {}): string {
    const ctx = this.requireContext();
    const document = ctx.document;
    const json = writeDocument(document, { space: options.space ?? this.options.space });
    ctx.events.emit('persistence:exported', { document, json });
    return json;
  }

  private download(fileName: string | undefined, options: IWriteOptions | undefined): void {
    const ctx = this.requireContext();
    const json = this.exportJson(options);
    const url = URL.createObjectURL(new Blob([json], { type: JSON_MIME_TYPE }));
    const link = ctx.container.ownerDocument.createElement('a');
    link.href = url;
    link.download = fileName ?? this.options.fileName ?? DEFAULT_JSON_FILE_NAME;
    // Attaché le temps du clic : certains navigateurs ignorent un lien détaché.
    ctx.container.appendChild(link);
    try {
      link.click();
    } finally {
      link.remove();
      // Libérée plus tard : certains navigateurs lisent l'URL après `click()`.
      setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
    }
  }

  /** API du service, figée : une façade sur les méthodes privées. */
  private createService(): IPersistenceJsonService {
    return Object.freeze({
      read: (source: unknown): IReadResult => readDocument(source),
      importDocument: (source: unknown) => this.importDocument(source),
      importFile: async (file: Blob) => this.importDocument(await file.text()),
      exportJson: (options?: IWriteOptions) => this.exportJson(options),
      download: (fileName?: string, options?: IWriteOptions) => this.download(fileName, options)
    } satisfies IPersistenceJsonService);
  }
}

/** Crée le plugin `persistence.json` (voir `IPersistenceJsonOptions`). */
export function createPersistenceJsonPlugin(options: IPersistenceJsonOptions = {}): PersistenceJsonPlugin {
  return new PersistenceJsonPlugin(options);
}
