<!-- doc/v2/todo/blazor-b1-b3a.md -->
# Reste à faire : Blazor (B1, B2, B3a)

Fil « Phase 8 : B1 puis B2 ». État au 24 octobre 2026 : tout le travail de ce fil est fusionné dans
`v2/base` (#29, #36, #60, #67, #81, #85, #89). Aucune branche n'a de travail non fusionné.

## Fait

- **B1** : bibliothèque Razor `dotnet/JsTimeline.Blazor` (.NET 8), modèle C# généré au build depuis
  `schema/timeline.schema.json`, copie des builds npm dans `wwwroot`, préparation NuGet (rien publié).
- **B2** : composant `TimelinePlayer` (scène HTML) avec interop typée, erreurs vers `OnError`,
  `RefreshTargetsAsync`, état avec avertissements. Deux séries de finitions fusionnées.
- **B3a** : contrat C# `ITimelineStage`, état compact par calque, `FrameCallbackMode`, pont
  `wwwroot/stage/dotnetStage.js` (une scène .NET devient une `IStage` du runtime), choix de scène
  `TimelineStageOption`. Suites fusionnées (dernière image par identité, retraits avec leur cible,
  égalité des options, tests d'annulation).

## Périmètre de la reprise

Ce suivi intègre uniquement les notes de passation des tâches déjà fusionnées. B3 et B4 restent en attente de l’accord explicite de Benoit ; la préparation locale du paquet ne constitue pas une publication NuGet. Les revues ECC et la vérification complète de cette branche documentaire restent à consigner avant sa PR vers `v2/base`.

## Reste à faire

### B3 : composant `TimelineEditor` (attend E1)

- Utiliser `DotNetStageHandle` (interne) et `TimelineStageOption` pour le paramètre `Stage` :
  `Html()`, `JsModule(path)`, `DotNet(scène, mode)`, `None()`.
- Ordre de fermeture à respecter : détruire l'éditeur **avant** de libérer la poignée de la scène
  (sinon les derniers retraits ne sont pas envoyés). Changer de `Stage` = détruire puis recréer.
- `JsModule` : le module doit exporter `createStage()` ; rien n'est encore écrit côté JS pour le charger.
- `timeline-editor.mjs` importe `@werddomain/timeline-runtime` par son nom de package : il faut une
  import map ou une réécriture de l'import pour le servir depuis `_content/JsTimeline.Blazor/js/`.
- Liaison `@bind-Data`, callbacks d'événements de l'éditeur, `FrameCallbackMode` pour `OnFrame`.

### B4 : appli d'exemple, bUnit, `dotnet pack` en CI

- Page où un composant C# reçoit les images (scène `DotNet`).
- Vérifier une publication WebAssembly trimmée/AOT : l'interop sérialise `TimelinePlayerJsOptions`,
  `TimelinePlayerState`, `DotNetStageDescription` et `TimelineStageFrame` par réflexion (pas de
  `JsonSerializerContext`).
- Étape `dotnet pack` dans la CI (la CI fait déjà `dotnet test`).

### Points connus, non bloquants

- `TimelinePlayer` : `OnFrame` n'est envoyé que s'il a un gestionnaire au premier rendu ; une image =
  un aller-retour .NET (coûteux en Blazor Server).
- `TimelinePlayer` : un document modifié en place n'est pas détecté (comparaison par référence) ;
  un parent qui recrée le document à chaque rendu avec un `OnError` qui le redessine le renvoie en boucle
  (documenté dans le README).
- `dotnetStage.js` : une erreur de la dernière image (après fermeture) n'est pas signalée ; une paire
  calque + cible jamais envoyée peut apparaître dans `Released` (documenté : à ignorer).
- `DotNetStageHandle.DisposeAsync` peut prendre jusqu'à ~4 s (deux attentes bornées de 2 s).
- Le modèle généré vérifie la forme du JSON, pas les motifs et bornes du schéma (couleur, image ≥ 1,
  accélération) : c'est `validateDocument` du runtime qui les vérifie.
- Les tests dépendent du fichier `FakeJs.cs` (faux interop) : il honore maintenant les jetons
  d'annulation, mais exécute l'appel même avec un jeton déjà annulé (différent du vrai interop).

## Où regarder

- Contrat et décisions : `doc/v2/scene-developpeur.md` (section « Export CSS et Blazor »).
- Code : `dotnet/JsTimeline.Blazor/` (`Model/`, `Player/`, `Stage/`, `wwwroot/stage/`, `build/`),
  générateur `dotnet/tools/JsTimeline.SchemaGen/`.
- Tests : `dotnet/JsTimeline.Blazor.Tests/` (xunit + bUnit), `dotnet/JsTimeline.Blazor.JsTests/` (Jest).
- Vérification locale complète : nettoyage des `dist`, `npm ci`, `npm run lint`, `npm run typecheck`,
  `npm test`, `npm run build`, `npm run build:demo`, `CI=1 npm run test:e2e`,
  `dotnet build dotnet/JsTimeline.sln -c Release` (zéro avertissement),
  `dotnet test dotnet/JsTimeline.sln -c Release --no-build`, puis
  `dotnet pack dotnet/JsTimeline.Blazor/JsTimeline.Blazor.csproj -c Release --no-build -o <dossier-local>`.
  Définir les ports propres au dossier de travail avec `E2E_EDITOR_PORT` et `E2E_RUNTIME_PORT`.
  GitHub Actions est bloqué par la facturation ; ces contrôles s’exécutent localement, en commandes ordinaires.
  Ne jamais publier le paquet.
