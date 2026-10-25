<!-- doc/v2/todo/P2-preview-followups.md -->
# P2 : suite de l’aperçu pendant le déplacement de la tête

Source conservée : `v2/P2-followups-2` au commit `0a2e4213067d510b3045a93f8c10a8b961c2907e`. Cette branche mélangeait P2 et T2 ; `v2/P2-preview-followups` reprend seulement les trois fichiers de `playback/livePreview/`. T2 est isolée dans `v2/T2-keyframe-followups`.

Les modifications reprises restent à terminer et à vérifier. Les anciens résultats ECC ne couvrent pas cette intégration. Aucune PR ni fusion n’est autorisée sans la vérification complète et les revues ECC requises.

## À terminer

- Vérifier le texte du mode limité : une image peut être rendue deux fois, avec la même sortie.
- Prouver que le test du relâchement avant la dernière image d’affichage distingue réellement l’ancien code fautif (RED puis GREEN).
- Vérifier l’ajout du contrôle Aperçu si l’epic de la barre d’outils s’initialise après celle de lecture, ainsi que sa destruction.
- Garder la destruction des éditeurs de la fixture par `afterEach`, même si une assertion échoue.
- Avant toute correction supplémentaire, reprendre avec le guide TDD ECC ; les agents ont rencontré le plafond individuel de dépenses du workspace.
- Avant PR : dist propre, npm ci, lint zéro erreur, typecheck, npm test, build, build:demo, CI=1 E2E avec ports propres au dossier, .NET Release zéro avertissement, tests .NET et paquet local. Rien publier.

Le document original `phase5-toolbar-playback.md` reste sur la branche source. S1 et E1 restent en attente de l’accord de Benoit.
