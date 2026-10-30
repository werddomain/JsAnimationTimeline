<!-- doc/v2/todo/ha3-validation.md -->
# HA3 — Lignes et accélérations dans l’éditeur

30 octobre 2026. Branche `v2/HA3-property-rows-selection`, base `afcdb6b`.
La phase A a été validée par l’utilisateur (« 1. a »). HA3 et HA4 constituent
la phase B ; une validation utilisateur sera demandée après HA4.

## Résultat

Projection partagée de lignes par propriété, dépliage temporaire restaurable,
sélection propriétaire, commandes F6/déplacement/suppression/interpolation et
dialogue d’accélération complet. Le panneau numérique utilise les pistes
indépendantes et conserve les gardes contre les callbacks réentrants.

Démo réutilisable : `demo/editor/property-editor.html`, avec les plugins réels.
Les dix nouveaux parcours Playwright passent avec `CI=1`, sans nouvelle tentative.
Ils couvrent alignement, dépliage, sélection, F6, déplacement, édition numérique,
effets, Bézier, annulation, historique, rechargement et trois largeurs d’écran.

## Preuves avant implémentation

Le planner et le guide TDD ECC natifs ont cadré ce lot. Échecs reproduits avant
correction : façade absente pendant init, absence de lignes et de triangle,
interpolation/F6/déplacement indisponibles sur propriétés, dialogue moderne absent,
panneau ne montrant pas une propriété numérique personnalisée, copie mixte
ignorant silencieusement une ligne moderne. Les mêmes scénarios passent ensuite.

Playwright a détecté que le CSS rendait visible le mode masqué dans l’éditeur
Bézier. La règle `[hidden]` est maintenant respectée et le scénario passe.

## Vérification finale

- Dist nettoyé dans les cinq dossiers vérifiés, `npm ci` réussi, lockfile inchangé.
- `npm run lint` : zéro erreur ; `npm run typecheck` réussi.
- `npm test` : **3 582 tests / 233 suites**, tous réussis : runtime 931,
  éditeur 2 451, export CSS 88, conventions 63, bridge JavaScript 49.
- `npm run build` et `npm run build:demo` réussis.
- `CI=1 npm run test:e2e -- -- --workers=2` : **177 tests** réussis.
- Playwright Blazor : **6 tests** ; sample Blazor : **3 tests**, tous réussis.
- `dotnet build dotnet/JsTimeline.sln -c Release` : **0 avertissement, 0 erreur**.
- `dotnet test ... -c Release --no-build` : **180 tests** réussis.
- Pack NuGet et trois archives npm locales, consommateurs ESM/CommonJS/CSS,
  TypeScript Bundler/NodeNext, C# et ressources statiques vérifiés.

Ports : 9401/9402 (éditeur/runtime), 9403/9404 (Blazor). Chromium réinstallé après
`npm ci` dans le cache du dépôt. Commandes ordinaires, sans UltraCode.
Archives : `%TEMP%/JsTimeline-HA3-artifacts-20261030`.

## Revues ECC

Planner et guide TDD natifs exécutés avant implémentation. Revues générale,
TypeScript et sécurité natives : **aucun constat bloquant restant** après relecture
des correctifs. Pas de revue C# pour ce lot : aucun fichier C# ou modèle modifié ;
la compatibilité .NET est couverte par les contrôles ci-dessus.

Deux constats TypeScript reproduits puis corrigés : niveau ARIA/indentation après
reparentage, et visibilité d’un état intermédiaire pendant une commande portant
sur plusieurs propriétés. Les lots instantanés utilisent maintenant les mêmes
commandes de modèle dans une commande composite atomique ; les observateurs voient
le résultat complet. La suppression des dernières clés avec retrait des lignes
et de la sélection est testée, ainsi que l’annulation/rétablissement.

La revue sécurité rapporte zéro vulnérabilité de production. Les 15 alertes des
dépendances de développement préexistantes sont inchangées (dont une critique) ;
aucune dépendance n’a été modifiée dans ce lot.

Aucun tag, aucune publication et aucune fusion vers `main`.
