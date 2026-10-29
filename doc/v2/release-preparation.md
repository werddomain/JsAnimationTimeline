<!-- doc/v2/release-preparation.md -->
# Préparation de la version 1.0.0

Cette branche prépare quatre paquets : `@werddomain/timeline-runtime`, `@werddomain/timeline-editor`, `@werddomain/timeline-export-css` et `JsTimeline.Blazor`. Les trois paquets npm sont publics ; editor et export-css dépendent exactement de runtime 1.0.0. Le monorepo reste privé. Le numéro 1.0.0 est une cible de préparation, pas une affirmation que ces versions sont déjà disponibles.

Le workflow `release.yml` est déclenché uniquement manuellement. Il construit des archives et les dépose comme artefact GitHub ; il ne publie rien, ne crée aucun tag et ne possède pas de droits d'écriture. Un push ou un tag ne le déclenche pas. Il ne constitue pas une autorisation de publication.

## Vérification locale

Avec Node 22 et .NET SDK 8 :

```sh
npm ci
node --test tools/packaging/metadata.test.mjs
npm run build --workspace packages/runtime --workspace packages/editor --workspace packages/export-css
mkdir -p artifacts/release-preparation
npm pack --workspace packages/runtime --workspace packages/editor --workspace packages/export-css --ignore-scripts --pack-destination artifacts/release-preparation
dotnet pack dotnet/JsTimeline.Blazor/JsTimeline.Blazor.csproj -c Release -o artifacts/release-preparation
npm run test:packaging -- artifacts/release-preparation/JsTimeline.Blazor.1.0.0.nupkg
```

Le test consommateur emballe les trois modules npm depuis les builds, les installe dans un dossier temporaire avec un cache npm distinct et vérifie les licences octet pour octet, les imports ESM et CommonJS, le CSS et les types TypeScript. Il copie le paquet NuGet indiqué dans un dépôt local temporaire et restaure un consommateur avec un cache NuGet distinct, puis vérifie le modèle C# et les ressources statiques. Aucun registre réseau n'est utilisé par ce test. Les dépendances NuGet doivent déjà être présentes dans `~/.nuget/packages` ; définir `PACKAGING_NUGET_SOURCE` pour utiliser un autre dépôt local. Les fichiers temporaires sont supprimés même en cas d'echec.

Inspecter les archives : les trois formats d'entrée (ESM, CommonJS et déclarations TypeScript), la licence et le CSS de l'éditeur doivent être présents. Installer les trois archives dans un projet npm distinct, puis vérifier imports ESM et CommonJS, résolution du CSS et compilation TypeScript. Restaurer le `.nupkg` depuis un répertoire local dans un projet Blazor distinct et vérifier les ressources sous `_content/JsTimeline.Blazor/`, notamment les modules runtime et editor et la feuille CSS. Utiliser un cache NuGet isolé pour éviter de réutiliser un autre paquet portant le même numéro.

## Après autorisation explicite seulement

Avant toute publication, vérifier les droits et la disponibilité des noms et versions sur npm et NuGet, les résultats CI et les artefacts finaux, ainsi que la documentation et les notes de version. Valider la provenance et les mécanismes d'authentification auprès des responsables. Définir et faire approuver un workflow de publication distinct, sa stratégie de reprise en cas d'échec partiel et l'ordre de publication (runtime avant editor et export-css). La création d'un tag et toute publication npm ou NuGet restent des actions futures nécessitant une autorisation explicite ; ce dépôt ne les automatise pas ici.
