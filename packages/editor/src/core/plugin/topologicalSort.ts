// packages/editor/src/core/plugin/topologicalSort.ts
/**
 * Tri topologique stable des plugins selon leurs dépendances : chaque nœud
 * vient après ses dépendances, et l'ordre d'enregistrement est conservé
 * autant que possible (parcours en profondeur dans cet ordre).
 */

import { PluginError } from './PluginError';

/** Nœud minimal à trier : un identifiant et ses dépendances. */
export interface ISortNode {
  readonly id: string;
  readonly dependencies: readonly string[];
}

type VisitState = 'visiting' | 'done';

function assertUniqueIds(nodes: readonly ISortNode[]): Map<string, ISortNode> {
  const byId = new Map<string, ISortNode>();
  for (const node of nodes) {
    if (byId.has(node.id)) {
      throw new PluginError(
        'duplicate-id',
        `Le plugin "${node.id}" est présent plusieurs fois.`,
        node.id
      );
    }
    byId.set(node.id, node);
  }
  return byId;
}

function assertDependenciesExist(
  nodes: readonly ISortNode[],
  byId: ReadonlyMap<string, ISortNode>,
  provided: ReadonlySet<string>
): void {
  for (const node of nodes) {
    const missing = node.dependencies.find((dep) => !byId.has(dep) && !provided.has(dep));
    if (missing !== undefined) {
      throw new PluginError(
        'missing-dependency',
        `Le plugin "${node.id}" dépend de "${missing}", qui n'est pas enregistré.`,
        node.id
      );
    }
  }
}

function circularError(path: readonly string[], id: string): PluginError {
  const cycle = [...path.slice(path.indexOf(id)), id];
  return new PluginError(
    'circular-dependency',
    `Dépendance circulaire entre plugins : ${cycle.join(' -> ')}.`,
    id
  );
}

/**
 * Trie `nodes` pour que chacun suive ses dépendances.
 * Les dépendances listées dans `provided` sont satisfaites sans nœud et
 * n'apparaissent pas dans le résultat.
 *
 * @returns Les identifiants dans l'ordre d'initialisation.
 * @throws PluginError 'duplicate-id', 'missing-dependency' ou 'circular-dependency'.
 */
export function topologicalSort(
  nodes: readonly ISortNode[],
  provided: ReadonlySet<string> = new Set<string>()
): string[] {
  const byId = assertUniqueIds(nodes);
  assertDependenciesExist(nodes, byId, provided);

  const states = new Map<string, VisitState>();
  const order: string[] = [];
  const path: string[] = [];

  const visit = (id: string): void => {
    const state = states.get(id);
    if (state === 'done') return;
    if (state === 'visiting') throw circularError(path, id);
    const node = byId.get(id);
    if (node === undefined) return; // dépendance fournie par l'hôte
    states.set(id, 'visiting');
    path.push(id);
    node.dependencies.forEach(visit);
    path.pop();
    states.set(id, 'done');
    order.push(id);
  };

  nodes.forEach((node) => visit(node.id));
  return order;
}
