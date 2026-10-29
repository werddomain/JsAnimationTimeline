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
version=$(dotnet msbuild dotnet/JsTimeline.Blazor/JsTimeline.Blazor.csproj -getProperty:Version)
npm run test:packaging -- artifacts/release-preparation "artifacts/release-preparation/JsTimeline.Blazor.${version}.nupkg"
```

Le test consommateur installe les trois archives npm produites dans le premier répertoire indiqué dans un dossier temporaire avec un cache npm distinct et vérifie les licences octet pour octet, les imports ESM et CommonJS, le CSS et les types TypeScript en modes Bundler et NodeNext. Il copie le paquet NuGet indiqué dans un dépôt local temporaire et restaure un consommateur avec un cache NuGet distinct, puis vérifie le modèle C# et les ressources statiques. Aucun registre réseau n'est utilisé par ce test. Les dépendances NuGet doivent déjà être présentes dans `~/.nuget/packages` ; définir `PACKAGING_NUGET_SOURCE` pour utiliser un autre dépôt local. Les fichiers temporaires sont supprimés même en cas d'échec.

Inspecter les archives : les trois formats d'entrée (ESM, CommonJS et déclarations TypeScript), la licence et le CSS de l'éditeur doivent être présents. Installer les trois archives dans un projet npm distinct, puis vérifier imports ESM et CommonJS, résolution du CSS et compilation TypeScript. Restaurer le `.nupkg` depuis un répertoire local dans un projet Blazor distinct et vérifier les ressources sous `_content/JsTimeline.Blazor/`, notamment les modules runtime et editor et la feuille CSS. Utiliser un cache NuGet isolé pour éviter de réutiliser un autre paquet portant le même numéro.

## Après autorisation explicite seulement

Avant toute publication, vérifier les droits et la disponibilité des noms et versions sur npm et NuGet, les résultats CI et les artefacts finaux, ainsi que la documentation et les notes de version. Valider la provenance et les mécanismes d'authentification auprès des responsables. Examiner le workflow NuGet fourni et faire approuver la stratégie de reprise en cas d'échec partiel ainsi que l'ordre de publication npm (runtime avant editor et export-css). La création d'un tag et toute publication npm restent des actions futures nécessitant une autorisation explicite. La publication NuGet future par tag est décrite ci-dessous.

## Publication NuGet future

Le workflow `publish-nuget.yml` est prévu pour un futur push de tag `v.MAJOR.MINOR.PATCH`, par exemple `v.1.3.0`. Le numéro doit correspondre exactement à `<Version>` dans `dotnet/JsTimeline.Blazor/JsTimeline.Blazor.csproj` ; la version actuelle est `1.0.0`. Il vérifie que le tag pointe vers le commit extrait, que ce commit est accessible depuis `origin/main` après récupération complète et qu'il contient le workflow. Avant de demander une clé NuGet temporaire, il exécute lint, vérification des types, tests npm et .NET, builds, tests navigateur CI, Blazor et Pages, puis construit le `.nupkg` et vérifie son identité, sa version et son installation dans un consommateur local. Il calcule ensuite le SHA-256 du paquet testé et vérifie ce digest après téléchargement dans le job de publication. Un échec bloque le job de publication. Un tag invalide ou un échec de publication provoque une erreur ; les doublons ne sont pas ignorés. Aucun paquet npm n'est publié par ce workflow.

**Ne pas créer de tag avant l'intégration de v2 et de ce workflow sur `main`.** L'ancien workflow de `main` peut publier sur npm lors d'un tag `v*`. GitHub exécute le workflow présent dans le commit tagué : les protections de ce nouveau fichier ne peuvent pas protéger un tag sur un ancien commit qui ne le contient pas. Le garde seul ne protège pas contre une personne pouvant pousser un tag et modifier le workflow ou son script : elle pourrait les falsifier. La protection des branches, des tags et des modifications de workflows reste nécessaire. Les protections GitHub sont configurées hors de ce dépôt.

Avant un futur tag autorisé, vérifier les droits et la disponibilité de `JsTimeline.Blazor` et de la version sur nuget.org. Dans le compte nuget.org qui possède ou pourra créer le paquet, configurer une stratégie Trusted Publishing : propriétaire du dépôt `Kazo-ca`, dépôt `JsAnimationTimeline`, fichier `publish-nuget.yml` (nom seul), environnement `nuget-production`, et portée autorisant l'action nécessaire pour `JsTimeline.Blazor`. Sur `Kazo-ca/JsAnimationTimeline`, l'environnement GitHub `nuget-production` a été créé avec l'approbateur requis `werddomain` et une politique de tags `v.*` ; vérifier ces réglages avant toute activation. Dans un autre dépôt, configurer l'environnement avec un approbateur requis et une politique stricte des tags autorisés. La stratégie Trusted Publishing et le secret `NUGET_USER` ne sont pas encore configurés. Configurer ce secret `NUGET_USER` contenant le nom de profil nuget.org autorisé (pas son adresse courriel). Aucun secret ni clé durable n'est fourni dans ce dépôt. La stratégie doit être active et l'utilisateur choisi doit disposer des droits nécessaires ; voir la [documentation officielle NuGet](https://learn.microsoft.com/en-us/nuget/nuget-org/trusted-publishing).

Pour vérifier les garde-fous hors ligne sans publication : `python -m unittest tools/packaging/test_nuget_release.py`. Les tests utilisent uniquement des dépôts Git temporaires et des paquets de test, sans créer de tag dans ce dépôt.
