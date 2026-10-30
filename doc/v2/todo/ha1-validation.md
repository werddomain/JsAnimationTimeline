<!-- doc/v2/todo/ha1-validation.md -->
# HA1 — socle des pistes indépendantes

30 octobre 2026, branche `v2/HA1-property-tracks`, base `e90be9d`.
Ce lot ouvre la phase A ; HA2 et sa validation de phase restent à effectuer.

## Réalisé

Modèle et schéma additifs, quatre types de valeurs, états initiaux par piste,
transitions indépendantes, sources de courbes conservées et effets paramétrés.
Échantillonnage typé dans les scènes et l'éditeur, modèles C# générés et bridge
Blazor avec restauration/coalescence. Démo permanente et tests Playwright.
Les capacités et restrictions transitoires sont dans
[l'API du socle](../../integration/timeline-ha1-api.md).

## Vérification locale finale

- Dist nettoyé ; `npm ci` réussi sur le lockfile inchangé.
- `npm run lint` : zéro erreur ; `npm run typecheck` réussi.
- `npm test` : 3 324 tests réussis dans 215 suites.
- `npm run build` et `npm run build:demo` réussis.
- `npm run test:e2e -- -- --workers=2`, `CI=1` : 159 tests réussis.
- `dotnet build dotnet/JsTimeline.sln -c Release` : zéro avertissement, zéro erreur.
- `dotnet test dotnet/JsTimeline.sln -c Release --no-build` : 179 tests réussis.
- `dotnet pack` local et consommateurs npm/NuGet hors publication vérifiés.
- Playwright Blazor : 6 tests réussis ; démo Blazor : 3 tests réussis.

Ports du dossier : éditeur 9401 (`E2E_V2_EDITOR_PORT`, avec alias utilisateur
`E2E_EDITOR_PORT` également défini), runtime 9402, Blazor 9403/9404.
Cache navigateur : `node_modules/.cache/ms-playwright`. Les tests navigateur ont
nécessité l'exécution autorisée hors sandbox Windows ; les builds restent des
commandes shell ordinaires. Aucun passage par UltraCode.

Les archives locales vérifiées sont conservées dans
`%TEMP%/JsTimeline-HA1-artifacts-20261030`, pas dans les sources.

## Revue ECC

Planner et guide TDD exécutés avant implémentation. Les tests rouges ont reproduit
les pertes de données modernes avant leur correction. Revues natives Codex ECC :

| Revue | Résultat final |
| --- | --- |
| Générale | Favorable ; projections périmées et précision des courbes corrigées. |
| TypeScript | Favorable ; valeurs extrêmes et rendu d'une cible HTML refusée corrigés. |
| C# | Favorable ; restauration des pistes supprimées, retry/coalescence et retarget corrigés. |
| Sécurité | Aucun nouveau constat bloquant ; point de performance ci-dessous. |

Le validateur de transitions conserve un parcours quadratique : le probe de revue
à 20 000 transitions a pris environ 728 ms. Amélioration non bloquante à suivre :
indexer les images et vérifier les chevauchements avec des intervalles triés.

L'audit npm global signale 15 vulnérabilités préexistantes dans les dépendances de
développement (dont une critique dans Handlebars via ts-jest). Aucun manifeste ni
lockfile n'a changé. `npm audit --omit=dev` : zéro vulnérabilité. Ce résultat ne
constitue pas un audit global vierge ; la maintenance de l'outillage reste distincte.

## Suite autorisée

Créer et fusionner la PR HA1 uniquement vers `v2/base` si les derniers contrôles
sont verts, puis commencer HA2. À la fin de HA2 : démo du moteur/API et arrêt pour
validation de la phase A. Aucun merge vers `main`, tag ou publication dans ce lot.
