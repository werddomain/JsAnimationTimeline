# @werddomain/tools-conventions

Vérifie les conventions du dépôt. Exécuté par `npm test` (test `src/__tests__/repo.test.ts`).
Fichiers couverts : `packages/*/src/**/*.ts` (y compris `.d.ts`), `tools/**/*.ts`, `e2e/**/*.ts`, `demo/*/src/**/*.ts` et `demo/*/*.ts` (mêmes globs qu'ESLint)
(hors `node_modules`, `dist*`, `coverage`).

## Règle A : en-tête de chemin

La première ligne de chaque fichier `.ts` est exactement `// <chemin relatif à la racine, avec />`.

## Règle B : en-tête de plugin

Un fichier dont le bloc `/** ... */` juste après la ligne de chemin contient une ligne `Plugin :`
est un plugin :

```ts
// packages/editor/src/plugins/layers/color/LayerColorPlugin.ts
/**
 * Plugin : layers.color
 * Epic : layers
 * Dépend de : core, layers.list
 * Écoute : layer:added, layer:selected
 * Émet : layer:colorChanged
 */
```

- Clés (français canonique, alias anglais acceptés, espace avant `:` facultatif) :
  `Plugin`, `Epic`, `Dépend de` / `Depends on`, `Écoute` / `Listens`, `Émet` / `Emits`.
- Valeurs séparées par des virgules ; `—`, `-`, `aucune`, `none` ou vide = liste vide.
- `Plugin` et `Dépend de` sont obligatoires.
- Le code doit déclarer `id` (`readonly id = 'layers.color'` ou `id: 'layers.color'`) égal à `Plugin`,
  et un tableau littéral `dependencies` de chaînes dont l'ensemble égale `Dépend de` (ordre ignoré).
