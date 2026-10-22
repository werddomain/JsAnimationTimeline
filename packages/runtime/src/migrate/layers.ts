// packages/runtime/src/migrate/layers.ts
/**
 * Conversion de l'arbre des calques v1 en arbre v2 (calques et dossiers),
 * avec ids uniques, nom par défaut et drapeaux visible/verrouillé recopiés.
 */

import type { IFolder, ILayer, LayerNode, LayerNodeType } from '../model/layer';
import { isRecord, warn, type IMigrationContext } from './context';
import { MigrationError, MigrationErrorCodes, MigrationWarningCodes } from './issues';
import { buildSpans } from './spans';

type RawNode = Readonly<Record<string, unknown>>;

/** Deepest folder nesting accepted (protects the recursive conversion from stack overflows). */
export const MAX_FOLDER_DEPTH = 64;

/**
 * Collects every non-empty string id of the raw tree (to reserve them).
 * @throws MigrationError when folders are nested deeper than `MAX_FOLDER_DEPTH`.
 */
export function collectRawIds(nodes: readonly unknown[], depth = 0): string[] {
  if (depth > MAX_FOLDER_DEPTH) {
    throw new MigrationError(MigrationErrorCodes.TOO_DEEP, `Folders are nested deeper than ${MAX_FOLDER_DEPTH} levels.`);
  }
  return nodes.flatMap((node) => {
    if (!isRecord(node)) {
      return [];
    }
    const own = typeof node.id === 'string' && node.id !== '' ? [node.id] : [];
    return Array.isArray(node.children) ? [...own, ...collectRawIds(node.children, depth + 1)] : own;
  });
}

function resolveType(ctx: IMigrationContext, node: RawNode, path: string): LayerNodeType {
  if (node.type === 'layer' || node.type === 'folder') {
    return node.type;
  }
  const inferred: LayerNodeType = Array.isArray(node.children) ? 'folder' : 'layer';
  warn(ctx, `${path}/type`, MigrationWarningCodes.NODE_TYPE_INFERRED,
    `Unknown node type ${JSON.stringify(node.type)}; treated as a ${inferred}.`);
  return inferred;
}

function resolveId(ctx: IMigrationContext, node: RawNode, type: LayerNodeType, path: string): string {
  if (typeof node.id === 'string' && node.id !== '' && ctx.ids.claim(node.id)) {
    return node.id;
  }
  const id = ctx.ids.generate(type === 'folder' ? 'folder-' : 'layer-');
  warn(ctx, `${path}/id`, MigrationWarningCodes.ID_GENERATED,
    `Missing, empty or duplicate id ${JSON.stringify(node.id)}; "${id}" is used instead.`);
  return id;
}

function resolveName(ctx: IMigrationContext, node: RawNode, id: string, path: string): string {
  if (typeof node.name === 'string') {
    return node.name;
  }
  warn(ctx, `${path}/name`, MigrationWarningCodes.NAME_DEFAULTED, `Missing name; "${id}" is used instead.`);
  return id;
}

/** `visible` and `locked`, copied only when they are booleans. */
function flags(node: RawNode): { visible?: boolean; locked?: boolean } {
  return {
    ...(typeof node.visible === 'boolean' ? { visible: node.visible } : {}),
    ...(typeof node.locked === 'boolean' ? { locked: node.locked } : {})
  };
}

function hasItems(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

function migrateFolder(ctx: IMigrationContext, node: RawNode, id: string, name: string, path: string): IFolder {
  if (hasItems(node.keyframes) || hasItems(node.tweens)) {
    warn(ctx, path, MigrationWarningCodes.FOLDER_CONTENT_IGNORED, 'A folder cannot have keyframes or tweens; they were ignored.');
  }
  let children: LayerNode[] = [];
  if (Array.isArray(node.children)) {
    children = migrateNodes(ctx, node.children, `${path}/children`);
  } else {
    warn(ctx, `${path}/children`, MigrationWarningCodes.INVALID_NODE, 'Folder children must be an array; the folder is empty.');
  }
  return { id, type: 'folder', name, ...flags(node), children };
}

function migrateLayer(ctx: IMigrationContext, node: RawNode, id: string, name: string, path: string): ILayer {
  return { id, type: 'layer', name, ...flags(node), spans: buildSpans(ctx, node, path, `${id}-s`) };
}

function migrateNode(ctx: IMigrationContext, raw: unknown, path: string): LayerNode | null {
  if (!isRecord(raw)) {
    warn(ctx, path, MigrationWarningCodes.INVALID_NODE, 'Layer entry dropped: it is not an object.');
    return null;
  }
  const type = resolveType(ctx, raw, path);
  const id = resolveId(ctx, raw, type, path);
  const name = resolveName(ctx, raw, id, path);
  return type === 'folder' ? migrateFolder(ctx, raw, id, name, path) : migrateLayer(ctx, raw, id, name, path);
}

/** Converts a list of raw v1 nodes; `path` is the pointer of the list. */
export function migrateNodes(ctx: IMigrationContext, nodes: readonly unknown[], path: string): LayerNode[] {
  return nodes
    .map((node, index) => migrateNode(ctx, node, `${path}/${index}`))
    .filter((node): node is LayerNode => node !== null);
}
