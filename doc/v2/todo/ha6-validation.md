<!-- doc/v2/todo/ha6-validation.md -->
# HA6 — Fidélité CSS et raccordement

30 octobre 2026. Branche `v2/HA6-css-export-conformance`, base `79aea4c`.
Dernier lot de la phase C autorisée après validation de la phase B.
Référence fonctionnelle vérifiée : `3345e1ca499c5141527275bf72ba9e7c1e5e5811`,
PR #127 vers `v2/base`. Les changements suivants de cette PR sont documentaires.

## Résultat et limites

`exportHtmlCss` inspecte la scène source et retourne une sortie continue ou un
refus global avec alternatives JavaScript/JSON. La préparation partage la
résolution HTML du runtime et expose les trajectoires choisies, leurs sources
et leurs politiques avant première clé. Aucun ajustement de courbe à partir
des images HA5 n'est utilisé pour revendiquer la fidélité continue.

Les maintiens, valeurs numériques CSS compatibles, transitions linéaires/Bézier,
sources linéaires découpées et transformations composables sont pris en charge.
Les cas non démontrables sont refusés : interpolation riche incompatible,
interpolateur personnalisé, courbe non représentable, priorités sous-jacentes
complexes ou cascade concurrente. Les règles sont limitées au container.

Le chemin historique `exportCss` conserve sa signature mais refuse désormais
toute sortie partielle. Sa fixture entièrement prise en charge et ses parcours
historiques restent actifs. Il ne porte pas la certification continue de la
nouvelle API. Voir `doc/integration/timeline-ha6-api.md` pour les limites exactes.

La démo `demo/editor/css-exports.html` compare de vraies animations CSS à la
lecture Timeline, avec recherches fractionnaires, courbes indépendantes, cas 59,
rotation source, valeurs maintenues, téléchargement et refus motivés. Les huit
parcours Playwright et les captures responsive restent réutilisables.

## Preuves et revues ECC

Planner et guide TDD ECC natifs exécutés avant implémentation. Revues natives
générale, TypeScript et sécurité effectuées, puis relectures des correctifs :
aucun constat bloquant restant. Aucun fichier C# ni schéma du modèle éditable
modifié ; aucune revue C# revendiquée. La compatibilité .NET reste vérifiée.

Preuves RED/GREEN conservées : API absente, ancienne sortie CSS partielle,
collision de noms `@keyframes`, règles d'animation dormantes et budget HTML.
Le consommateur HA6 échoue contre les archives HA5 dépourvues de `exportHtmlCss`.
La démo a aussi reproduit une différence de hauteur de boutons (40 contre 31 px),
puis vérifié sa correction et les hauteurs réelles dans les deux scènes.

Deux constats de revue corrigés :

- Une durée inline de 99 secondes et un état paused restaient prioritaires face
  à une feuille prévue pour 1 seconde/running. Les déclarations sources
  animation/animation-*/all sont maintenant refusées, y compris sans nom actif.
- Un document de 50 136 octets, 1 000 clés et 1 000 cibles nécessitait 1 001 000
  compositions et bloquait 15 003 ms. La garde commune HA5/HA6 intervient avant
  inspection, à 100 000 unités pondérées. La reproduction de relecture retourne
  un refus en 54 ms pour CSS et 116 ms pour HTML JSON, avec zéro composition.
  Les tests utilisent des spies, sans seuil fragile de durée.

L'audit de production exécuté rapporte zéro vulnérabilité. `npm ci` rapporte
30 alertes de développement (5 faibles, 18 modérées, 6 hautes, 1 critique), comme
HA5. Manifeste et lockfile inchangés ; aucun audit fix appliqué.

## Vérification finale

- Cinq dossiers dist vérifiés/nettoyés ; `npm ci` réussi.
- Lint : zéro erreur ; typecheck, build et build:demo réussis.
- `npm test` : **3 914 tests / 260 suites** réussis : runtime 1 202,
  éditeur 2 481, export CSS 119, conventions 63, bridge JavaScript 49.
- `CI=1 npm run test:e2e -- -- --workers=2 --retries=0` : **201 tests**
  réussis sans nouvelle tentative (58,0 secondes).
- Build .NET Release : **0 avertissement, 0 erreur** ; **180 tests** réussis.
- Playwright Blazor : **6 tests** ; sample Blazor : **3 tests**, tous réussis.
- Trois archives npm et pack NuGet locaux réussis ; consommateurs ESM/CommonJS,
  CSS, API `exportHtmlCss`, TypeScript Bundler/NodeNext, C# et ressources statiques
  vérifiés.

Ports : 9401/9402 (éditeur/runtime), 9403/9404 (Blazor), cache Chromium local et
`CI=1`. Builds/tests en commandes ordinaires, sans UltraCode.
Archives : `%TEMP%/JsTimeline-HA6-artifacts-20261030`.

La passation autonome est `doc/integration/timeline-integration-status.md`.
La phase C attend la validation utilisateur après démonstration. Aucun tag,
aucune publication et aucune fusion vers `main` dans ce lot.
