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
- Méthodes : `PlayAsync`, `PauseAsync`, `SeekAsync(image)` et `GetStateAsync()` (image, lecture en cours,
  calques sans cible...). Elles sont utilisables après `OnReady`.
- Événements : `OnPlay`, `OnPause`, `OnComplete`, `OnLoop` et `OnFrame`. `OnFrame` doit être donné dès le
  premier rendu, car chaque image fait alors un appel vers .NET.
- `OnError` reçoit un document refusé par le lecteur. Sans gestionnaire, l'erreur est levée.
- Seule la scène HTML est prise en charge pour l'instant.

## Construire le package

```bash
npm ci
npm run build
dotnet build dotnet/JsTimeline.sln
dotnet pack dotnet/JsTimeline.Blazor -c Release
```

`dotnet build` signale un avertissement si les builds npm manquent ; `dotnet pack` refuse de continuer.
