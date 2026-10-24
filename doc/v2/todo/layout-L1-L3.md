# doc/v2/todo/layout-L1-L3.md

# Reste à faire : mise en page (L1, L2, L3)

État au 24 octobre 2026 : L1, L2 et L3 sont fusionnées dans `v2/base`, avec toutes leurs retouches (PR #20, #34, #40, #44, #49, #55, #59, #69, #74). Aucun travail en cours ni modification non poussée dans les branches de ce fil. Zone : `packages/editor/src/plugins/layout/{shell,scrollSync,ruler,playhead,zoom}/`.

## À faire ensuite

- **Tests Playwright des plugins de mise en page** : aucun pour l'instant, parce que la page de démo utilise encore le contrôle v1. À écrire dans `e2e/editor/` quand une page de démo v2 existera (E1) : défilement synchronisé, clic et glisser sur la règle, clavier de la tête de lecture, Ctrl + molette.
- **Grille (G1) et `zoom:changed`** : G1 est maintenant intégré. `FramesGridPlugin.onZoom()` redessine la grille de façon synchrone, puis actualise les mesures du défilement, conformément au contrat de `ZoomPlugin.ts`. La vérification visuelle du point d'ancrage fait partie de la démo de validation de phase 3 ; sa couverture Playwright pérenne reste prévue dans E1.

## Petites retouches connues (non bloquantes, signalées par les revues ECC)

- `ZoomPlugin.ts`, doc de `resolveOptions` : l'exemple `[0,25 … 2, 2,5]` mélange virgule décimale et séparateur ; écrire `[0.25 … 2, 2.5]` ou reformuler.
- Zoom, paliers donnés en double (`levels: [1, 1]`) : non dédoublonnés.
- Zoom, dédoublonnage exact : une borne à un cheveu d'un palier (`maxZoom: 2.0000001`) donne deux paliers presque égaux.
- Molette en lignes, choix assumés et documentés : une roue fine tournée sans pause fait un palier toutes les 3 lignes ; un cran plus court que 3 lignes peut avaler le premier événement du cran suivant s'il arrive en moins de 300 ms.
- Tests manquants du zoom : inversion de sens en pixels, changement de sens ou pause en mode page, borne coupée seulement côté haut avec une valeur hors paliers (`{ maxZoom: 2.5 }`).
- Tête de lecture : pas de défilement automatique quand on glisse au-delà du bord de la vue (l'image est bornée au bord visible).
- Règle : les étiquettes ne sont pas virtualisées (environ 2 000 éléments pour 10 000 images à 15 px) ; à revoir si une très longue timeline devient lente.
- `render` des plugins de mise en page n'est pas idempotent (sans effet aujourd'hui, l'hôte ne rend qu'une fois).

## Hors de cette zone

- Les ports de démo par dossier de travail sont maintenant intégrés via `E2E_EDITOR_PORT` et `E2E_RUNTIME_PORT` (`tools/devPorts.ts`). Chaque vérification choisit sa propre paire, avec `CI=1` ; un port occupé provoque un échec explicite.
