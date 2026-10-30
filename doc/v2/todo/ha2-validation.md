<!-- doc/v2/todo/ha2-validation.md -->
# HA2 — API des pistes de propriétés

30 octobre 2026. Branche `v2/HA2-property-editing-api`, base `1b0232b` (HA1).
Ce lot termine le socle technique de la phase A. Arrêt pour validation utilisateur
après fusion dans `v2/base` et présentation de la démo ; HA3 attend cette validation.

## Résultat

Façade publique `editor.propertyTimelines` : création/édition/capture/déplacement/
suppression de clés, transitions et accélérations, migration explicite, transactions
X/Y et annulation. Les pistes restent indépendantes, les sources conservent exactement
les courbes lors des captures. Les anciennes commandes refusent les calques modernes
qu'elles ne savent pas encore éditer. Les documents historiques restent lisibles.

`property:changed` annonce les changements réellement commis, dans l'ordre, avec
protection contre les callbacks réentrants, chargements et poignées de gestes périmées.
La source `legacyEasing` garde l'ordre arithmétique de l'ancien évaluateur lors d'une
migration fidèle. Les cas non représentables sont refusés explicitement.

Correspondance exacte et limites : [API HA2](../../integration/timeline-ha2-api.md).
Démo : `demo/editor/property-timelines.html`. Huit scénarios Playwright conservés dans
`e2e/validation/property-editing.spec.ts`, dont les largeurs 320, 768 et 1440 pixels.
Capture visuelle de la démo vérifiée ; menus et texte lisibles.

## Vérifications finales

- Dist nettoyé dans les cinq dossiers contrôlés ; `npm ci` réussi, lockfile inchangé.
- `npm run lint` : zéro erreur ; `npm run typecheck` réussi.
- `npm test` : **3 519 tests**, **225 suites**, tous réussis.
  Runtime 931, éditeur 2 388, export CSS 88, conventions 63, bridge JavaScript 49.
- `npm run build` et `npm run build:demo` réussis.
- `CI=1 npm run test:e2e -- -- --workers=2` : **167 tests** réussis.
- Playwright Blazor : **6 tests** ; sample Blazor : **3 tests**, tous réussis.
- `dotnet build dotnet/JsTimeline.sln -c Release` : **0 avertissement, 0 erreur**.
- `dotnet test dotnet/JsTimeline.sln -c Release --no-build` : **180 tests** réussis.
- `dotnet pack` et les trois archives npm locales créés, consommateurs ESM,
  CommonJS, CSS, TypeScript Bundler/NodeNext, C# et ressources statiques vérifiés.

Ports locaux : 9401 éditeur (`E2E_EDITOR_PORT` et `E2E_V2_EDITOR_PORT`), 9402 runtime,
9403/9404 Blazor. Chromium installé dans `node_modules/.cache/ms-playwright` après
`npm ci`. L'ancien serveur de prévisualisation Timeline verrouillant Rolldown a été
arrêté avant de réussir cette réinstallation ; le serveur HtmlAnimation a été préservé.
Tests et builds exécutés par commandes ordinaires, sans UltraCode.

Archives : `%TEMP%/JsTimeline-HA2-artifacts-20261030`. Aucun paquet publié, aucun tag.
L'installation npm retrouve les 15 alertes de développement déjà consignées pour HA1 ;
aucune dépendance n'a changé et aucun nouvel audit réseau n'est revendiqué ici.

## ECC et preuves RED/GREEN

Planner et guide TDD natifs exécutés. RED réel avant implémentation pour les opérations,
commandes, gardes legacy et façade publique ; les refus et annulations sont testés.

| Revue native ECC | Résultat |
| --- | --- |
| Générale | APPROVE : ordre des notifications réentrantes corrigé et testé. |
| TypeScript | APPROVE : effets sources, paramètres invalides et résultats non finis corrigés et testés. |
| C# | APPROVE : modèle généré optionnel et round-trip conservés ; 8 tests ciblés et format vérifiés. |
| Sécurité | Aucun nouveau constat bloquant, y compris après les derniers resserrements. |

Régressions de revue reproduites en RED puis vérifiées en GREEN : ordre des commits
imbriqués, purge après `load`, conservation de `legacyEasing`, source implicitement
linéaire, refus de paramètres `null`/booléen/tableau, refus d'Infinity/NaN issus d'une
source importée. La précision historique est également testée à une image où une
normalisation incorrecte donnerait 63 au lieu de 62.

Le parcours quadratique du validateur signalé dans HA1 demeure une amélioration de
performance non bloquante. La validation C# structurelle ne remplace pas les contraintes
sémantiques du schéma/runtime. Le dialogue d'effets de l'éditeur principal (HA3),
l'adaptateur HTML riche (HA4) et les exports fidèles (HA5/HA6) restent à livrer.
