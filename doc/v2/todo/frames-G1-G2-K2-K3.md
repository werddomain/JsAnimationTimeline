<!-- doc/v2/todo/frames-G1-G2-K2-K3.md -->
# Reste à faire : images (G1, G2, K2, K3)

État au 24 octobre 2026, à l'arrêt demandé par Benoit.

## Où en sont les tâches

| Tâche | Plugin | État |
|---|---|---|
| G1 | `frames.grid` | Fusionnée (PR #42) |
| G2 | `frames.selection` | Fusionnée (PR #53), suivi fusionné (PR #61) |
| K2 | `frames.keyframes` | Fusionnée (PR #70), suivi fusionné (PR #77) |
| K3 | `frames.clipboard` | PR #79 ouverte, branche `v2/K3-frames-clipboard`, régressions de conservation après collage reproduites puis corrigées ; vérification complète locale verte, revues ECC finales en cours avant fusion |

## Prochaines étapes

1. Faire relire et fusionner la PR #79 (K3).
2. Ctrl+X (couper des images) : il faut d'abord, dans K1 (`model/spans/`), une opération « effacer des images » (remplacer une plage d'images par une plage vide), puis un raccourci dans `frames.clipboard`.
3. Exporter de K1 `truncateTween`, `newSpan` et `createSpanCommand` (aujourd'hui privés) et retirer leurs copies dans `frames/clipboard/` (`spanPieces.ts`, `clipboardOps.ts`, `pasteCommand.ts`).
4. E1 (presse-papiers du système) : le contenu (`FRAME_CLIP_FORMAT`, version 1) est du JSON pur, mais il faut un validateur avant de coller un contenu venu de l'extérieur : forme, images entières et bornées, noms de propriétés du registre (pas de `__proto__`), taille maximale.

## Limites connues (documentées dans le code)

- Couper une interpolation accélérée (F6, copie ou collage) garde l'accélération sur chaque morceau : les images entre les bords coupés changent légèrement. C'est exact avec `linear`.
- K1 refuse de déplacer une image clé de contenu au-delà de la fin de sa plage : glisser la dernière image clé vers la droite est refusé, alors que Flash l'accepte.
- Le glisser des images clés ne change pas de calque (décalage en images seulement) et ne fait pas défiler la grille près des bords.
- Collage : une propriété que la source montre à sa valeur par défaut, parce qu'elle n'est posée que plus loin, n'est pas copiée. Sur un calque qui la pose déjà, l'image collée garde la valeur de ce calque.
- Collage : seules les propriétés connues du registre sont évaluées aux coupes ; aucune valeur de bord n’est inventée pour une propriété inconnue.
- Le presse-papiers des images vit seulement dans la mémoire de l'éditeur (perdu au rechargement).

## Petites remarques des revues, non faites

- `frames.keyframes` : un déplacement retourne `false` sans événement quand le décalage, une fois borné, vaut 0 (déjà au bord). C'est documenté, mais aucun message n'est affiché.
- Tests à ajouter : `cancelPendingClick` directement dans les tests de `frames.selection`, et `lostpointercapture` avec un autre pointeur.

## Branches et worktrees

- `v2/K3-frames-clipboard` : PR #79, à jour avec `v2/base`.
- Worktree `JsAnimationTimeline-K2c` (branche `v2/K2-selection-docs`) : vide, jamais poussé. Ses deux points ont été faits dans la PR #79 ; on peut le supprimer.

## Reprise K3 : conservation des images après collage

- Les noms des pistes originales et collées sont examinés. La première plage non vide après le collage reçoit seulement les valeurs héritées qui ont changé.
- Régressions conservées : propriété portée par une plage entièrement remplacée (copie sur y, vide ou sans piste), interpolation raccourcie suivie d’une plage fixe, propriété inconnue ailleurs dans le calque, absence de clé inutile, annuler/rétablir.
- Une piste vide collée n’ajoute plus de clé inutile après la plage.
- Une valeur par défaut du registre rétablie peut remplacer le style CSS initial de la cible (par exemple opacity 1 au lieu de 0.5). Le modèle ne mémorise pas ce style extérieur.
- La copie garde son contrat existant : une coupe nécessitant l’évaluation d’une propriété inconnue peut être refusée. Le mode tolérant est limité au collage.
- Les revues ECC indépendantes restent requises avant fusion ; les anciens avis ne couvrent pas automatiquement les nouvelles corrections. La vérification locale comprend 3 003 tests npm, 48 tests navigateur et 145 tests .NET, les builds et le paquet NuGet local (rien publié).
