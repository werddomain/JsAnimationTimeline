<!-- doc/v2/todo/ha5-validation.md -->
# HA5 — Exports de lecture JSON et JavaScript

30 octobre 2026. Branche `v2/HA5-playback-exports`, base `fef760a`.
Lot de la phase C autorisée après validation de la phase B (« a »).

## Résultat

Le runtime compile un document de lecture générique sans DOM et un document HTML
résolu. Le lecteur générique utilise le transport existant ; le lecteur HTML et
le JavaScript autonome partagent une factory. Le module généré n'importe aucune
dépendance. Chaque image entière est préévaluée, avec recherche directe et maintien
entre images ; le champ `sampling:'frames'` annonce cette précision. Le document
éditable conserve ses clés, courbes, transitions et sa précision fractionnaire.

Le ciblage HTML conserve les objets sources, applique les règles HA4 et le cas 59,
et ne dépend pas de l'ordre des correspondances DOM. Des bases divergentes exigent
un ID unique vérifié ou un sélecteur explicite. Les styles et priorités d'origine
sont restaurés à la destruction. Un refus ne produit aucun artefact partiel.

API : `doc/integration/timeline-ha5-api.md`.
Démo et tests réutilisables : `demo/editor/playback-exports.html` et
`e2e/validation/playback-exports.spec.ts`.
Schémas séparés : `schema/playback-document.schema.json` et
`schema/html-playback-document.schema.json`.

## Preuves et revues ECC

Planner et guide TDD natifs exécutés avant implémentation. Revues natives générale,
TypeScript et sécurité terminées, puis relecture des correctifs : aucun constat
bloquant restant. Aucun fichier C# ni modèle temporel éditable modifié ; pas de
revue C# revendiquée. Les consommateurs et parcours Blazor restent vérifiés.

Les tests RED/GREEN conservent notamment : APIs absentes, lecture sans DOM,
import réel du module construit, réception native des appels d'horloge, reprise
après la fin, annulation d'un RAF restant, ID Unicode non BMP, refus des conflits
et des données invalides, indépendance des styles voisins et restauration.

La revue sécurité a reproduit une compilation de 10 000 images / 10 000 clés
bloquant 8 464 ms. Le même document est désormais refusé en 57 ms lors de cette
relecture. La garde de dix millions d'unités estimées précède validation sémantique
et évaluation ; les tests utilisent des spies, sans seuil de durée fragile.
Le coût des fonctions d'interpolation fournies par l'hôte reste sa responsabilité.

Les suites génériques tournent réellement sous Node, séparées des suites jsdom
dans la configuration Jest, avec les en-têtes de chemin exigés par le dépôt.
Les archives HA4 ont servi de RED pour le consommateur des nouvelles API HA5.

L'audit de production exécuté rapporte zéro vulnérabilité. `npm ci` rapporte
30 alertes de développement (5 faibles, 18 modérées, 6 hautes, 1 critique).
Le manifeste et le lockfile n'ont pas changé ; les données d'avis ont évolué depuis
HA4. Aucun correctif de dépendance automatique n'a été appliqué dans ce lot.

## Vérification finale

- Cinq dossiers dist vérifiés et nettoyés, `npm ci` réussi, lockfile inchangé.
- Lint : zéro erreur ; typecheck, build et build:demo réussis.
- `npm test` : **3 873 tests / 254 suites** réussis : runtime 1 192,
  éditeur 2 481, export CSS 88, conventions 63, bridge JavaScript 49.
- Build .NET Release : **0 avertissement, 0 erreur** ; **180 tests** réussis.
- `CI=1 npm run test:e2e -- -- --workers=2 --retries=0` : **193 tests**
  réussis, sans nouvelle tentative (50,9 secondes).
- Playwright Blazor : **6 tests** ; sample Blazor : **3 tests**, tous réussis.
- Trois archives npm et pack NuGet locaux réussis ; consommateurs ESM/CommonJS,
  CSS, nouvelles API de lecture, TypeScript Bundler/NodeNext, C# et ressources
  statiques vérifiés.

Ports : 9401/9402 (éditeur/runtime), 9403/9404 (Blazor), `CI=1` et cache Chromium
local du dépôt. Commandes ordinaires, sans UltraCode.
Archives : `%TEMP%/JsTimeline-HA5-artifacts-20261030`.

HA6 traite ensuite la fidélité CSS et complète la passation vers HtmlAnimation.
Aucun tag, aucune publication et aucune fusion vers `main` dans ce lot.
