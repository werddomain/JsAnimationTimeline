# JsTimeline.Blazor

Bibliothèque Razor de JsAnimationTimeline pour Blazor (.NET 8 et plus).

## Contenu

- Les builds ES des packages npm, servis sous `_content/JsTimeline.Blazor/` :
  - `js/timeline-runtime.mjs` : le lecteur, sans interface ;
  - `js/timeline-editor.mjs` et `css/timeline-editor.css` : l'éditeur.
- Le modèle C# du document v2 (`JsTimeline.Blazor.Model`) : `TimelineDocument`, `Layer`, `Folder`, `Span`,
  `PropertyKeyframe`, `LayerTarget`... Il est généré au build depuis `schema/timeline.schema.json`.

## Lire et écrire un document

```csharp
using JsTimeline.Blazor.Model;

TimelineDocument doc = TimelineJson.Deserialize(json);
string back = TimelineJson.Serialize(doc);
```

Une cible a exactement une forme : `LayerTarget.FromSelector("#logo")` ou
`LayerTarget.FromRef("hero", stage: "canvas")`. Une cible avec deux formes, ou aucune, est refusée à la
lecture et à l'écriture du JSON. Les valeurs absentes ne sont pas écrites.

Limites :

- `TimelineJson.Deserialize` vérifie la forme du document (clés, types, `null` refusé, forme des cibles).
  Les motifs et les bornes du schéma (couleur `#rrggbb`, image ≥ 1, accélération, ids non vides) et les
  règles du document (ids uniques, plages contiguës...) sont vérifiés par `validateDocument` du runtime.
- Les types du modèle sont des `record`, mais leurs listes et dictionnaires se comparent par référence :
  deux documents lus séparément ne sont pas égaux avec `==`. Comparer plutôt leur JSON.

## Jouer une animation : `TimelinePlayer`

```razor
@using JsTimeline.Blazor.Player

<TimelinePlayer @ref="_player" Data="_document" Autoplay Loop Speed="1.5"
                OnFrame="frame => _frame = frame" OnComplete="Finished" class="scene">
    <div id="logo">Logo</div>
</TimelinePlayer>
```

- Les sélecteurs des calques sont cherchés dans l'élément rendu autour du contenu.
- La lecture tourne dans le navigateur (Web Animations), sans aller-retour avec .NET.
- Un nouveau `Data` remplace l'animation en gardant le temps et l'état de lecture. `Loop` et `Speed` peuvent
  changer à tout moment.
- Méthodes : `PlayAsync`, `PauseAsync`, `SeekAsync(image)`, `GetStateAsync()` (image, lecture en cours,
  calques sans élément, avertissements de la scène) et `RefreshTargetsAsync()`. Elles sont utilisables
  après `OnReady`.
- Les cibles sont cherchées quand un document est appliqué. Si le contenu affiche un élément animé plus
  tard (bloc `@if`, composant enfant qui charge ses données, liste), appeler `RefreshTargetsAsync()`.
  Un sélecteur qui ne trouve rien n'est pas une erreur : le calque apparaît dans `MissingTargets`.
- Événements : `OnPlay`, `OnPause`, `OnComplete`, `OnLoop` et `OnFrame`. `OnFrame` doit être donné dès le
  premier rendu, car chaque image fait alors un appel vers .NET.
- `OnError` peut être donné, changé ou retiré à tout moment. Il reçoit :
  - une `JSException` quand le lecteur refuse un document. Le lecteur garde le document précédent, et ce
    document refusé n'est pas renvoyé ; un nouveau document l'est ;
  - une `JsonException` quand un document ne peut pas être écrit en JSON (par exemple une `LayerTarget`
    avec deux formes) ;
  - une `JSException` quand le lecteur refuse `Loop` ou `Speed` ;
  - une `TimelineStageException` quand la scène échoue pendant la lecture, qui continue.
- `Loop` et `Speed` s'appliquent même quand le document est refusé.
- Sans gestionnaire, une erreur de scène est écrite dans la console du navigateur avec `console.error`, et les
  autres erreurs sont levées vers le moteur de rendu de Blazor : l'erreur seule s'il n'y en a qu'une, sinon une
  `InvalidOperationException` dont l'`AggregateException` intérieure les contient toutes.
- Si le gestionnaire `OnError` lève lui-même une exception, l'erreur d'origine n'est pas perdue : une
  `InvalidOperationException` est levée, avec une `AggregateException` intérieure qui contient l'échec du
  gestionnaire puis l'erreur d'origine. Avec plusieurs erreurs, cette paire reste groupée dans sa propre
  `AggregateException`, à l'intérieur de celle qui contient toutes les erreurs.
- Les erreurs qui restent quand le composant est fermé ne sont plus signalées.
- Le document refusé est reconnu par sa référence. Un parent qui crée un nouveau `TimelineDocument` à chaque
  rendu, avec un `OnError` qui le fait se redessiner, renvoie le document à chaque fois : garder le document
  dans un champ et n'en créer un nouveau que quand il change.
- Seule la scène HTML est prise en charge pour l'instant.

## Scène écrite en C# (préparation de B3)

Le dossier `Stage/` contient le contrat qu'utilisera le paramètre `Stage` du futur composant d'éditeur :

- `ITimelineStage` : `Id`, `Targets` (objets proposés aux calques, ciblés par `{ "ref": ..., "stage": Id }`),
  `Properties` (nombres lus par la scène, avec une interpolation par nom : `Linear`, `Step`, `Floor`, `Round`)
  et `RenderAsync(frame)`. `Targets` et `Properties` sont lus une seule fois, quand la scène est branchée.
- `TimelineStageFrame` : le temps, l'état compact de chaque calque (`LayerId`, `Target`, `Values`, `Active`,
  `Visible`) et les calques retirés depuis l'image précédente (`Released`), chacun une seule fois avec la
  cible qu'il avait. Appliquer `Released` avant `Layers` : un calque qui change de cible est dans les deux.
  Quand l'éditeur ou le lecteur se termine (ou change de scène), une dernière image sans calque apporte les
  derniers retraits.
- `FrameCallbackMode` : `Off` (jamais), `IntegerFrames` (à chaque image affichée, après un nouveau document ou
  un saut dans le temps ; c'est le défaut) ou `EveryTick` (à chaque rendu).
- Un seul appel à `RenderAsync` à la fois tant que la scène est branchée : les images produites pendant un
  appel se remplacent, et seule la plus récente est envoyée ensuite. Débrancher la scène attend (deux
  secondes au plus) l'appel en cours, pour qu'une scène rebranchée ne le chevauche pas. Une exception de
  `RenderAsync` est signalée à la timeline et la lecture continue.
- `TimelineStageOption` décrit les choix : `Html()` (défaut), `JsModule("./js/maScene.js")`, `DotNet(scène)` et
  `None()`. Ces méthodes sont la seule façon d'en créer un, donc un choix est toujours valide. Aucun composant
  ne les utilise encore ; `TimelinePlayer` reste en HTML.

Côté navigateur, `_content/JsTimeline.Blazor/stage/dotnetStage.js` fait d'une scène .NET une `IStage` du
runtime, utilisable avec `createEditor({ stage })` ou `createPlayer({ stage })`.

## Construire le package

```bash
npm ci
npm run build
dotnet build dotnet/JsTimeline.sln
dotnet pack dotnet/JsTimeline.Blazor -c Release
```

`dotnet build` signale un avertissement si les builds npm manquent ; `dotnet pack` refuse de continuer.
