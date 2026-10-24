# Fil 7 : scène côté runtime et W1 — reste à faire

État au 2026-10-24, arrêt demandé par Benoit. Rien n'est en cours.

## Fusionné

- Phase 2b : F06 (#22), R6 (#21), R7 (#33), R8 (#41) et leurs suites (#43, #56, #62, #71).
- W1 `tweens.motion` (#73) et ses suites (#80, #84, #91).

## Pas encore en PR

- Branche `v2/W1-doc-mergedTracks` : une ligne de JSDoc dans
  `packages/editor/src/plugins/tweens/motion/createMotionTween.ts` (`mergedTracks` : exception
  « sauf, pour une image clé vide, une image clé déjà posée à k2 - 1 »). Lint, typecheck et tests
  de l'éditeur passent. Reste : relecture ECC, PR vers `v2/base`.

## Points connus, non bloquants (relectures ECC et intégrateur)

### Scène HTML, mode `frame` (`packages/runtime/src/stage/html/inlineStyles.ts`)
- Une valeur refusée par le navigateur, ou sérialisée autrement que la valeur de la page
  (`10px 10px` contre `10px`, `#FF0000` contre `rgb(...)`), n'entre jamais dans `written` :
  deux instantanés complets à chaque image. Ajouter un petit cache négatif.
- `restore(longhand)` pendant qu'un raccourci qui la contient est encore écrit : la valeur de la
  page revient pour une image (pas de perte). Inatteignable aujourd'hui (seul `visibility` appelle
  `restore`).
- Lecture `getPropertyValue` du raccourci à chaque première sauvegarde, même inutile : à rendre
  paresseuse.

### Hôte de scène (`packages/runtime/src/stage/StageHost.ts`)
- Fichier à ~400 lignes : à découper si on y ajoute quoi que ce soit.
- Un `accepts` qui lève n'est pas réessayé avant le document suivant (documenté).

### Scène objet (`packages/runtime/src/stage/object/createObjectStage.ts`)
- Propriétés abandonnées pendant qu'un calque était non résolu : pas remises à zéro quand il se
  résout de nouveau (cas limite ; `release` couvre en principe).
- `resolve` personnalisé : doit rendre des objets stables pour un même `ref` (documenté).

### W1 `tweens.motion` (`packages/editor/src/plugins/tweens/motion/`)
- Créer une interpolation sur plusieurs calques à la fois (CS4 le permet) : refusé pour l'instant.
- Avec une image clé vide en k2, la clé déjà posée à k2 - 1 est gardée selon sa présence, pas sa
  valeur : équivalent aujourd'hui, à revoir si une accélération « dépassement » arrive (W3).
- `refreshAvailability` fait deux simulations à chaque `document:changed` : à surveiller pendant
  les glisser sur de gros documents.
- Un test (`createMotionTween.test.ts`, ~221-233) n'a pas de commentaire « Act ».

## Prochaines étapes du plan qui dépendent de ce fil

- W2, W3, T2 et I1 utilisent le service `tweens.motion` (`canCreate` / `canRemove`, événement
  `tweens:motionAvailabilityChanged`).
- C7 / P2 utilisent `isEditorVisible` de l'hôte de scène ; E1 et D1 réutilisent la démo
  `demo/runtime/object-stage.html`.
