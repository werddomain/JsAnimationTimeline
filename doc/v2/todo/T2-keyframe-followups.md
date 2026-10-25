<!-- doc/v2/todo/T2-keyframe-followups.md -->
# T2 : suite des actions sur les images clés

Source conservée : `v2/P2-followups-2` au commit `0a2e4213067d510b3045a93f8c10a8b961c2907e`. `v2/T2-keyframe-followups` reprend seulement les quatre fichiers de `toolbar/keyframeActions/`. P2 est isolée dans `v2/P2-preview-followups`.

Le code repris inclut des retouches commencées avant l’arrêt, sans validation complète de leur état final. Les anciens résultats ECC ne couvrent pas cette intégration. Les revues ECC indépendantes et le guide TDD doivent reprendre après résolution du plafond individuel de dépenses du workspace.

## À terminer

- Cas important : une sélection mixte contenant une image clé de propriété et le début d’une interpolation peut supprimer toute l’interpolation. Fixer le comportement attendu avec des régressions, annuler et rétablir avant de corriger le modèle ou l’aiguillage.
- Vérifier que l’infobulle indisponible contient le nom de l’action et sa raison.
- Vérifier le bouton Supprimer sur une image ordinaire avec seulement un calque sélectionné.
- Vérifier l’absence de recalcul à chaque image de lecture quand la tête ne constitue pas la cible.
- Test comportemental de pause et de fin de lecture : calque sélectionné sans cellule, tête passant sur puis hors d’une image clé, état stable pendant la lecture puis actualisé après pause/fin. Les tests d’abonnement seuls ne prouvent pas ce comportement.
- Remplacer le test vide de restauration après erreur d’initialisation par un test qui vérifie réellement le nettoyage.
- Pour les sélections mixtes au niveau du plugin : vérifier le libellé exact, pas seulement son inégalité avec le libellé de propriété.
- Détruire tous les éditeurs de `setup()` dans `afterEach`, et retourner l’émetteur depuis la fixture.
- Avant PR : dist propre, npm ci, lint zéro erreur, typecheck, npm test, build, build:demo, CI=1 E2E avec ports propres au dossier, .NET Release zéro avertissement, tests .NET et paquet local. Rien publier.

Le document original `phase5-toolbar-playback.md` reste sur la branche source. Aucune nouvelle tâche du plan n’est démarrée par ce découpage.
