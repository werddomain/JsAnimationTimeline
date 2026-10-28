# dotnet/samples/BlazorSample/README.md

# Exemple Blazor

Depuis la racine du dépôt, installer les dépendances et construire les ressources JavaScript, puis lancer l’application :

```sh
npm ci
npm run build
dotnet run --project dotnet/samples/BlazorSample
```

Ouvrir l’adresse affichée par .NET. L’application utilise Blazor Server interactif et une connexion au serveur est nécessaire.

- **Éditeur HTML** : le logo est ciblé par un sélecteur. Importer un document de 48 images, puis l’annuler pour retrouver les 24 images initiales. L’import passe par `ImportAsync`, donc par l’historique de l’éditeur.
- **Lecteur HTML** : lire, mettre en pause ou aller à une image. L’animation est jouée dans le navigateur ; les changements d’image sont également transmis à .NET pour l’affichage.
- **Scène C#** : l’éditeur calcule `progress` et transmet les images à `SceneDisplay`, qui implémente `ITimelineStage`. Les retraits sont appliqués avant les nouveaux calques, et l’interface est mise à jour avec `InvokeAsync`. Utiliser les commandes de l’éditeur pour déplacer la tête de lecture ou lancer l’animation.

La carte d’import et les styles de l’éditeur sont déclarés dans `Components/App.razor`. Les composants Blazor détruisent leur instance JavaScript quand on quitte une page. La scène C# est une démonstration du pont : pour une animation purement HTML, le lecteur évite les allers-retours .NET.
