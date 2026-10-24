# Reste à faire : fil « Phase 5 : barre d'outils et lecture »

Branche : `v2/P2-followups-2` (non fusionnée, pas de PR ouverte). Arrêt demandé par Benoit le 24 octobre 2026.

## Fusionné dans v2/base

T1, T3, C5, P1, T4, e2e-ports (#54), C7 `ctx.stage.hold()` + `ctx.playback.now()` (#76), P2 (#82), retouches P2 (#86), T2 (#88), et les passes de retouches #39, #46, #68.

## Sur cette branche (commité, à terminer)

Commits `ffea674` (livePreview) et `1385943` (keyframeActions), revus par `ecc:code-reviewer` : 0 CRITICAL, 0 HIGH. Vérification complète verte au commit `1385943` (lint 0 erreur, typecheck, 1 980 tests de l'éditeur + 1 todo, build, build:demo, Playwright 32/32 sur 9900/9901).

Le dernier commit (« WIP ») contient des retouches commencées après cette vérification, **non vérifiées** :
- `LivePreviewPlugin.ts` : en-tête reformulé (la réserve du mode limité en phrase à part) ;
- `KeyframeActionsPlugin.test.ts` : début des points de revue ci-dessous.

### À faire avant d'ouvrir la PR
1. Test comportemental de la mise à jour sur `playback:pause` / `playback:complete` (keyframeActions) : calque sélectionné sans cellule, lecture, tête qui passe sur / hors d'une image clé, boutons inchangés pendant la lecture, puis à jour après la pause et après la fin. Garder le test d'abonnements seulement s'il ne voit que ceux du plugin.
2. Tests de sélection mixte au niveau du plugin : `toBe(DELETE_LABELS.keyframe)` au lieu de `.not.toBe(DELETE_LABELS.property)`.
3. `KeyframeActionsPlugin.test.ts` : détruire les éditeurs de `setup()` dans `afterEach`, et retourner l'émetteur depuis `setup()` au lieu de `emitters[emitters.length - 1]`.
4. Relancer la vérification complète (lint, typecheck, `npm test`, build, build:demo, `CI=1 E2E_EDITOR_PORT=… E2E_RUNTIME_PORT=… npm run test:e2e`), fusionner `origin/v2/base`, puis ouvrir la PR vers `v2/base` avec le résultat ECC.

## Problèmes connus (acceptés, documentés)

- T2 : un `it.todo` attend la retouche de W1 (`canCreate` reste actif juste après une création sur {k1, k2}).
- T2 : avec seulement un calque sélectionné et la tête dans une interpolation, « Supprimer » appelle `deleteKeyframe` (comme Maj+F6) et peut ne rien faire.
- P2 : un glisser qui revient sur l'image déjà rendue en moins d'une image d'affichage, ou un rendu de fin du mode limité, peut rendre la même image deux fois (même résultat).
- C7 : une retenue n'est pas rattachée au plugin qui l'a prise (une retenue oubliée retient le rendu hors lecture jusqu'à la destruction).
- e2e-ports : les `vite*.config.ts` à la racine des paquets ne sont ni lintés ni vérifiés par tsc ; `.vscode/launch.json` vise toujours 9000.

## Prochaines tâches possibles

S1 (`properties.panel`, écoute `toolbar:editKeyframe`), E1 (démo de l'éditeur v2 et scénarios Playwright), selon le plan.
