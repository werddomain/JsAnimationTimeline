<!-- doc/v2/todo/phase5-toolbar-playback.md -->
# Phase 5 : barre d’outils et lecture — passation intégrée

État au 25 octobre 2026. Benoit a validé la phase 4 ; les suivis P2 et T2 sont maintenant fusionnés séparément dans `v2/base`. La validation utilisateur de la phase 5 reste à faire avec son support de démonstration.

## Intégré

T1, T3, C5, P1 et T4 étaient déjà fusionnés. P2 (#82, #86) et T2 (#88) ont reçu leurs suivis finaux :

- [PR #100 — P2](https://github.com/werddomain/JsAnimationTimeline/pull/100) : annulation du minuteur différé quand le relâchement attend encore l’image d’affichage, contrôle Aperçu monté même si la barre d’outils arrive plus tard, nettoyage du contrôle et de ses écouteurs.
- [PR #101 — T2](https://github.com/werddomain/JsAnimationTimeline/pull/101) : libellés correspondant aux cibles réelles de suppression, nom de l’action dans les infobulles indisponibles, rafraîchissement après pause/fin et absence de calculs ou d’écritures DOM inutiles pendant la lecture.
- Les régressions vérifient les états intermédiaires, les événements effectifs, le nettoyage et les documents complets après annuler/rétablir. L’ancien todo W1 est remplacé par le contrat existant : une création identique est indisponible ; annuler la réactive et rétablir la désactive.
- Les deux PR ont passé leur vérification locale complète et les revues ECC générale, TypeScript et sécurité. Les résultats et arbres exacts sont consignés dans leurs corps ; GitHub Actions reste bloqué par la facturation.

## Branches et preuves

La branche source mixte `v2/P2-followups-2`, arrêtée au commit `0a2e4213067d510b3045a93f8c10a8b961c2907e`, est conservée comme trace. Elle n’a pas fait l’objet d’une PR mélangeant les deux tâches.

Les suites intégrées proviennent de `v2/P2-preview-followups` et `v2/T2-keyframe-followups`. Leurs preuves ciblées et limites sont détaillées dans [P2-preview-followups.md](P2-preview-followups.md) et [T2-keyframe-followups.md](T2-keyframe-followups.md). Les résultats ciblés ne remplacent pas les vérifications complètes des PR.

## Comportements et limites à conserver

- Une suppression mixte peut viser une clé de contenu et fusionner sa plage dans la précédente, conformément au modèle CS4 existant. Son libellé est « Supprimer l’image clé » ; il ne promet pas une suppression limitée à la propriété. Une annulation restaure le document.
- En aperçu limité, un minuteur ayant déjà dessiné l’image avant le relâchement peut être suivi d’un rendu identique à l’image d’affichage. Le plugin ne garantit pas un nombre de rendus unique dans tous les ordres temporels.
- Les retenues de scène C7 restent des ressources à libérer par leur appelant ; une retenue oubliée peut retenir le rendu hors lecture jusqu’à la destruction.
- Le zoom est un réglage de vue, distinct des commandes qui modifient le document. Cadence et durée utilisent l’historique du document.

## Validation et suite

Le [guide des démonstrations et tests conservés](../validation/README.md) décrit les supports réutilisables. La phase 5 doit être présentée à Benoit, puis attendre son accord avant de poursuivre le plan.

S1, E1 et toutes les autres nouvelles tâches non autorisées restent en attente d’un accord explicite. Aucun travail de phase 6 ni aucune publication npm/NuGet n’est engagé par cette passation.
