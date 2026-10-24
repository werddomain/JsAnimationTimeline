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

## Construire le package

```bash
npm ci
npm run build
dotnet build dotnet/JsTimeline.sln
dotnet pack dotnet/JsTimeline.Blazor -c Release
```

`dotnet build` signale un avertissement si les builds npm manquent ; `dotnet pack` refuse de continuer.
