# JsAnimationTimeline : rapport d'analyse et plan de la v1

*Rédigé le 19 octobre 2026 pour Benoit, à partir du dépôt `werddomain/JsAnimationTimeline` (branche `main`, commit `8e64b14`) et des 18 décisions prises dans le fil de discussion.*

---

## 1. Résumé

Le dépôt actuel est un **bon prototype d'interface** : calques, dossiers, images clés, lecture, sélection et menus contextuels fonctionnent, le build passe et 152 tests Jest sont verts. Mais ce n'est **pas encore un outil d'animation** ni **une librairie réutilisable** :

1. Les images clés ne portent **aucune valeur** (pas de x, d'opacité…) et aucun calque n'est relié à un élément de la page. Rien ne peut donc être animé.
2. Le modèle d'interpolation est le « classic tween » de Flash MX, alors que la cible est le **motion tween de Flash CS4**.
3. L'architecture **en plugins** demandée par les consignes du projet n'est pas appliquée.
4. Le packaging npm est cassé, et il n'y a ni NuGet, ni tests d'interface, ni Playwright.

La v1 visée se compose de **quatre livrables** dans un seul dépôt :

| Package | Rôle |
|---|---|
| `runtime` | Lecteur sans interface : charge le JSON et anime les éléments HTML via l'API Web Animations. |
| `editor` | Le contrôle timeline façon Flash CS4, construit en plugins, qui utilise `runtime` pour l'aperçu en direct. |
| `export-css` | Plugin qui transforme une animation en CSS pur (`@keyframes`). |
| NuGet `Blazor` | Razor Class Library qui livre les fichiers JS/CSS **et** un composant Blazor C# avec interop typée. |

---

## 2. Décisions prises

| # | Sujet | Décision |
|---|---|---|
| 1 | Usage final | Éditeur **et** lecteur léger, en packages séparés (`runtime` + `editor`) |
| 2 | Ce qu'on anime | Éléments HTML via CSS, construit sur une couche de valeurs génériques |
| 3 | Code existant | Refactorisation progressive vers les plugins, en gardant la logique |
| 4 | Modèle d'interpolation | **Motion tween de CS4** : plage liée à un objet, images clés par propriété |
| 5 | Calque | Un calque = une seule cible (sélecteur CSS ou élément) |
| 6 | Saisie des valeurs | L'API est la base ; un panneau de propriétés est un plugin optionnel |
| 7 | Éditeur de courbes CS4 | Pas en v1 ; préréglages d'accélération par plage |
| 8 | Sortie | JSON joué par `runtime` (Web Animations) **+** export CSS `@keyframes` en plugin |
| 9 | Dépôt | Monorepo avec plusieurs packages npm, plus NuGet |
| 10 | Distribution | npm (modules ES + types + UMD) **et** NuGet |
| 11 | Navigateurs testés | Chromium seulement, en CI à chaque push |
| 12 | Annuler/rétablir | Oui en v1, chaque action passe par une commande annulable |
| 13 | En-tête de fichier | Chemin relatif à la racine du dépôt |
| 14 | NuGet | Razor Class Library **+** composant Blazor C# avec interop typée |
| 15 | Propriétés animables | Transformations + opacité intégrées, et **toute propriété CSS numérique** déclarable par un plugin |
| 16 | Aperçu en direct | Oui, déplacer la tête de lecture applique l'image courante aux cibles via `runtime` |
| 17 | Fonctions du lecteur | Lecture, pause, aller à l'image, boucle, vitesse, événements (pas d'étiquettes, pas de lecture à l'envers, pas de déclenchement au défilement) |
| 18 | Ajouts à l'éditeur | Zoom de la règle + modification de la cadence (fps) et de la durée depuis la barre d'outils |

---

## 3. État actuel du dépôt

### 3.1 Inventaire

| Zone | Fichiers | Lignes | État |
|---|---|---|---|
| Point d'entrée | `src/JsTimeLine.ts` | 751 | Crée la mise en page, branche tout à la main, contient les raccourcis clavier |
| Logique | `src/core/*Manager.ts`, `PlaybackEngine.ts` | ~1 700 | Correcte et testée, mais couplée au contexte global |
| Interface | `src/ui/LayerPanel.ts`, `TimelineGrid.ts`, `TimeRuler.ts`, `ContextMenu.ts`, `TweenPropertiesDialog.ts` | ~2 300 | Fonctionne, mais ce sont de gros fichiers multi-fonctions (LayerPanel : 994 lignes) |
| Données | `src/data/ITimeLineData.ts`, `TimelineData.ts` | ~190 | Modèle trop pauvre pour animer (voir 4.1) |
| Plugins | `src/plugins/IPlugin.ts` | 8 | Interface déclarée, **jamais utilisée** |
| Styles | `src/styles/JsTimeLine.less` | 939 | Un seul fichier LESS, bien scopé sous `.JsTimeLine` |
| Tests | `src/__tests__/core/*`, `data/*` | — | 152 tests Jest, **uniquement la logique** |
| Docs | `doc/*.md` | ~2 600 | Spécification Flash MX en français, listes de tâches, consignes de développement |

### 3.2 Ce qui est réutilisable tel quel (ou presque)

- La logique de `LayerManager` (ajout, suppression annulable, renommage, réordonnancement, changement de parent, visibilité, verrou).
- La logique de `KeyframeManager` (insertion, suppression, déplacement, copier/coller) : à adapter au nouveau modèle.
- `PlaybackEngine` : remplacé à terme par le `runtime`, mais son API (`play`, `pause`, `goToFrame`) sert de base.
- `SelectionManager` (sélection simple, Ctrl, Maj) pour les images.
- La synchronisation du défilement par `requestAnimationFrame` (`JsTimeLine.ts:222`) : elle règle déjà la question soulevée dans ton document de design (garder les calques alignés quand on défile).
- Les styles LESS et l'accessibilité (rôles ARIA, navigation au clavier).
- Les 152 tests, qui deviennent les tests des plugins correspondants.

### 3.3 Problèmes constatés

| Problème | Où | Conséquence |
|---|---|---|
| `main` pointe vers `dist/JsTimeLine.bundle.js`, alors que le build produit `main.[hash].js` + `runtime.[hash].js` | `package.json`, `webpack.config.js` | **Le package npm est inutilisable** |
| `types` pointe vers `dist/index.d.ts`, qui n'existe pas | `package.json` | Pas de types pour les utilisateurs |
| Pas de sortie en modules ES, seulement de l'UMD | `webpack.config.js` | Pas d'import propre ni de tree-shaking |
| Le `dist` contient les `.d.ts` des tests et une `index.html` de démo | `tsconfig.json` | Package pollué |
| `files` et `.npmignore` se contredisent (`src/**` publié) | `package.json`, `.npmignore` | Contenu publié imprévisible |
| Le texte de release du CI montre une API qui n'existe pas (`new JsTimeLine.TimelineControl({...})`) | `.github/workflows/build.yml` | Documentation fausse |
| Le CI n'exécute pas les tests, et utilise Node 18 (fin de vie) | `.github/workflows/build.yml` | Régressions non détectées |
| Contexte typé `any` (`layerPanel?: any`, etc.) et `Function` dans l'EventManager | `IJsTimeLineContext.ts`, `EventManager.ts` | Événements non typés, contraire à la consigne « pas de `any` » |
| Sélection : seulement les images, **pas les calques** | `SelectionManager.ts` | Impossible de « grouper les objets sélectionnés » |
| Pas de couleur ni d'icône par calque | `ITimeLineData.ts`, `LayerPanel.ts` | Exigences du cahier non couvertes |
| Pas de barre d'outils au-dessus de la timeline (la zone « Scene 1 ») | — | Boutons du cahier absents |
| Pas de zoom de la règle | — | Exigence du document de design non couverte |
| Le README décrit Flash MX et une structure `v2/` qui n'existe plus | `README.md` | À réécrire |

---

## 4. Ce qui manque pour atteindre la v1

### 4.1 Le modèle de données (le point bloquant)

Aujourd'hui :

```ts
interface IKeyframe { frame: number; isEmpty?: boolean }
interface ITween    { startFrame: number; endFrame: number; type?: string }
```

Il faut un modèle qui sache **quoi** animer (la cible), **quelles** propriétés, et **quelles valeurs** à quelles images, selon la logique CS4.

#### Rappel du fonctionnement CS4 qu'on reproduit

- Un calque contient une suite de **plages** (*spans*) qui couvrent la ligne de temps.
- Une plage commence toujours par une **image clé de contenu** (le rond noir). Elle est soit **statique** (l'objet ne bouge pas jusqu'à la plage suivante), soit **vide** (rond blanc : l'objet est masqué), soit une **interpolation de mouvement** (fond bleu).
- Dans une interpolation, chaque modification d'une propriété à une image crée une **image clé de propriété** (le petit losange) *pour cette propriété seulement*. Les autres propriétés ne bougent pas.
- L'accélération (*easing*) s'applique à la plage entière en v1.

#### Adaptation des boutons de ton cahier à ce modèle

| Bouton du cahier | Comportement proposé avec CS4 |
|---|---|
| Ajouter une image clé (objet + temps sélectionnés) | Coupe la plage à cette image et crée une image clé de contenu. Dans une interpolation, l'image clé reçoit les valeurs interpolées à cet endroit, pour que rien ne saute. |
| Créer un motion tween sur les 2 images clés sélectionnées | Transforme la plage qui commence à la 1re image clé en interpolation jusqu'à la 2e. Avec **une seule** image clé sélectionnée, l'interpolation va jusqu'à la fin de sa plage (comme dans CS4). |
| Supprimer une image clé ou le motion tween sélectionné | Image clé de contenu : fusionne sa plage avec la précédente. Image clé de propriété : retire juste cette valeur. Motion tween : la plage redevient statique, et ses images clés de propriété sont supprimées (après une commande annulable). |
| Éditer l'image clé si elle ne fait pas partie d'un motion tween | Ouvre l'édition des valeurs de la plage statique. **Dans** une interpolation, on édite à la place les valeurs de l'image courante, ce qui crée des images clés de propriété. |

#### Schéma JSON v2 proposé

```jsonc
{
  "version": "2.0.0",
  "settings": { "fps": 24, "totalFrames": 120 },
  "layers": [
    {
      "id": "l1", "type": "layer", "name": "Logo",
      "color": "#4a90d9", "icon": "element",
      "visible": true, "locked": false,
      "target": { "selector": "#logo" },
      "spans": [
        {
          "id": "s1", "start": 1, "end": 48, "kind": "tween", "easing": "ease-in-out",
          "tracks": {
            "x":       [ { "frame": 1, "value": 0 }, { "frame": 48, "value": 300 } ],
            "opacity": [ { "frame": 1, "value": 0 }, { "frame": 12, "value": 1 } ]
          }
        },
        { "id": "s2", "start": 49, "end": 120, "kind": "static",
          "tracks": { "x": [ { "frame": 49, "value": 300 } ] } }
      ]
    },
    { "id": "f1", "type": "folder", "name": "Personnage", "color": "#e67e22", "children": [ /* calques */ ] }
  ]
}
```

Choix faits dans ce schéma (modifiables) :
- Les numéros d'image sont **absolus** (commencent à 1, comme Flash), et non relatifs à la plage : c'est plus simple à lire et à déplacer.
- Une valeur non définie dans une plage reprend la dernière valeur connue, sinon la valeur par défaut de la propriété.
- `kind: "blank"` masque la cible (`visibility: hidden`) pendant la plage.
- Un **migrateur v1 → v2** convertit les anciens fichiers (images clés → plages statiques, tweens → plages `tween` sans pistes).

### 4.2 Le registre de propriétés (décision 15)

Une même définition sert au `runtime`, à l'éditeur et à l'export CSS :

```ts
interface IPropertyDescriptor {
  name: string;                 // "x", "opacity", "width"...
  kind: 'transform' | 'style';  // compose `transform` ou écrit une propriété CSS
  cssName?: string;             // "translateX", "opacity", "width"
  unit?: string;                // "px", "deg", ""
  defaultValue: number;
  interpolate?(a: number, b: number, t: number): number; // linéaire par défaut
}
```

- **Intégrées en v1** : `x`, `y`, `rotation`, `scaleX`, `scaleY`, `skewX`, `skewY`, `opacity`.
- **Ajoutées par plugin** : n'importe quelle propriété CSS numérique (`width`, `borderRadius`, `letterSpacing`…) via `registerProperty(descriptor)`.
- Les transformations sont **toujours composées dans un ordre fixe** (translate → rotate → scale → skew) pour que l'aperçu, le lecteur et l'export CSS donnent exactement le même rendu.
- Les couleurs ne sont pas numériques. Elles ne sont donc pas en v1, mais le champ `interpolate` laisse la porte ouverte (un plugin couleur pourra interpoler en RGB).

### 4.3 Le package `runtime`

API publique proposée :

```ts
const player = createPlayer(data, { root: document, autoplay: false });
player.play(); player.pause(); player.seek(30);   // seek en images
player.loop = true; player.speed = 1.5;
player.on('frame', ({ frame }) => {}); player.on('complete', () => {});
player.update(newData);  // l'éditeur pousse les modifications
player.destroy();        // retire les animations et restaure les styles
```

Comment ça marche :
- Pour chaque calque, on résout la cible (`selector` dans `root`, ou élément passé directement).
- On rassemble toutes les images où **au moins une** propriété a une image clé, et on calcule toutes les valeurs à chacune d'elles. Ça donne une liste d'images clés Web Animations avec `offset = (image - 1) / (totalFrames - 1)`, une chaîne `transform` complète et l'accélération de la plage.
- Un seul `Animation` par cible, piloté par `currentTime` pour `seek`, et `playbackRate` pour la vitesse.
- L'événement `frame` est émis par une boucle `requestAnimationFrame` légère pendant la lecture.
- **Point d'attention** : avec Web Animations, l'accélération s'applique entre deux images clés voisines. Une accélération « par plage » avec des images clés de propriété au milieu demande d'échantillonner la courbe (ajouter des images intermédiaires). Le `runtime` le fait automatiquement, et c'est testé.

### 4.4 Le package `editor` : architecture en plugins

#### Le noyau

| Pièce | Rôle |
|---|---|
| `PluginHost` | Enregistre les plugins, vérifie leurs dépendances, les initialise dans l'ordre (tri topologique), refuse une dépendance manquante ou circulaire avec une erreur claire. |
| `EventBus` typé | `on/off/emit/emitCancellable` avec une `TimelineEventMap` que chaque plugin enrichit (augmentation d'interface TypeScript). Plus de `Function` ni de `any`. |
| `CommandStack` | Toute modification passe par une commande `{ do(), undo(), label }`. Ctrl+Z / Ctrl+Y, regroupement des commandes pendant un glisser-déposer, plafond de l'historique configurable. |
| `Store` | Contient le document JSON v2 ; seules les commandes le modifient, et chaque modification émet un événement. |
| `PropertyRegistry` | Réexporté depuis `runtime`. |

#### Contrat d'un plugin

```ts
// packages/editor/src/core/plugin/IPlugin.ts
export interface IPlugin {
  readonly id: string;               // "layers.color"
  readonly dependencies: string[];   // ["core", "layers.list"]
  init(ctx: IEditorContext): void;   // s'abonne aux événements, enregistre ses commandes
  render?(slot: HTMLElement): void;  // dessine son propre contenu dans son emplacement
  destroy(): void;
}
```

#### En-tête obligatoire de chaque fichier (décision 13)

```ts
// packages/editor/src/plugins/layers/color/LayerColorPlugin.ts
/**
 * Plugin : layers.color
 * Epic : layers
 * Dépend de : core, layers.list
 * Écoute : layer:added, layer:selected
 * Émet : layer:colorChanged
 */
```

Un test vérifiera automatiquement que **chaque** fichier `.ts` commence par son propre chemin et que les dépendances déclarées dans l'en-tête correspondent au champ `dependencies`.

#### Les epics et leurs plugins

Chaque epic est un plugin parent qui enregistre ses plugins de fonctionnalité. Entre parenthèses : ce qui est repris du code actuel.

| Epic | Plugins de fonctionnalité |
|---|---|
| **layout** | `layout.shell` (la grille à 4 zones), `layout.scrollSync` (repris de `JsTimeLine.ts`), `layout.ruler` (repris de `TimeRuler`), `layout.playhead`, `layout.zoom` **nouveau** |
| **layers** | `layers.list` (affichage de l'arbre), `layers.rename`, `layers.visibility`, `layers.lock`, `layers.color` **nouveau**, `layers.icon` **nouveau**, `layers.target` **nouveau** (associe la cible), `layers.selection` **nouveau** (sélection multiple de calques), `layers.reorder` (glisser-déposer, entrer/sortir d'un dossier), `layers.groups` (dossiers + « grouper la sélection »), `layers.toolbar` (Nouveau / Grouper / Supprimer) |
| **frames** | `frames.grid` (rendu, repris de `TimelineGrid`), `frames.selection` (repris de `SelectionManager`), `frames.keyframes` (ajout/suppression/déplacement), `frames.clipboard` (copier/coller) |
| **tweens** | `tweens.motion` (créer/supprimer une interpolation CS4), `tweens.propertyKeyframes` (les losanges), `tweens.easing` (préréglages, remplace `TweenPropertiesDialog`) |
| **toolbar** | `toolbar.main` (la zone « Scene 1 »), `toolbar.keyframeActions` (les 4 boutons du cahier), `toolbar.timeSettings` **nouveau** (fps et durée), `toolbar.zoomControl` **nouveau** (liste déroulante + curseur) |
| **playback** | `playback.controls` (lecture, pause, boucle, vitesse), `playback.livePreview` **nouveau** (pilote le `runtime` pendant le déplacement de la tête de lecture) |
| **interaction** | `interaction.contextMenu` (repris), `interaction.shortcuts` (F5/F6/F7, Ctrl+C/V/Z/Y, repris de `JsTimeLine.ts`) |
| **history** | `history.undoRedo` (boutons + raccourcis, branché sur `CommandStack`) |
| **persistence** | `persistence.json` (import/export), `persistence.migrate` (v1 → v2) |
| **properties** *(optionnel)* | `properties.panel` (formulaire des valeurs de l'image courante pour le calque sélectionné) |

#### Règles du verrouillage

Un calque verrouillé (ou dont un dossier parent est verrouillé) refuse toute commande qui crée, déplace, modifie ou supprime une image clé ou une plage. Le refus se fait **dans les commandes**, pas seulement dans l'interface, pour que l'API respecte aussi le verrou.

#### API publique de l'éditeur (proposition)

```ts
const editor = createEditor(container, {
  data,                 // JSON v2 (ou v1, migré automatiquement)
  root: document,       // où chercher les cibles
  plugins: [propertiesPanel()], // plugins optionnels en plus du jeu par défaut
});
editor.setProperty(layerId, 'x', 120, { frame: 30 }); // la voie « API » de la décision 6
editor.on('selection:changed', e => {});
editor.undo(); editor.redo();
editor.toJSON(); editor.load(json);
editor.destroy();
```

### 4.5 Le package `export-css`

```ts
const { css, html } = exportCss(data, { prefix: 'tl-' });
```

- Génère un bloc `@keyframes` par calque et une règle qui l'applique au sélecteur de la cible, avec `animation-duration` calculée à partir de `totalFrames / fps`.
- Les accélérations par plage sont converties en `animation-timing-function` **par image clé** (le CSS le permet).
- **Limites signalées dans le résultat** (un tableau `warnings`) : une cible définie par élément et non par sélecteur, une propriété déclarée par plugin avec une interpolation spéciale, ou une boucle avec un nombre de répétitions précis.

### 4.6 Le package NuGet / Blazor (décision 14)

- Projet `dotnet/JsTimeline.Blazor` (Razor Class Library, cible .NET 8 par défaut).
- `wwwroot/` contient les builds ES de `runtime` et `editor` et le CSS, copiés par le build npm, puis servis sous `_content/JsTimeline.Blazor/...`.
- Composants : `<TimelineEditor @bind-Data="..." OnSelectionChanged="..." OnFrame="..." />` et `<TimelinePlayer Data="..." Loop Speed />`.
- Modèle C# miroir du JSON v2 (`TimelineDocument`, `Layer`, `Span`, `PropertyKeyframe`) avec `System.Text.Json`.
- Interop via `IJSObjectReference` (import du module ES), des callbacks `DotNetObjectReference` pour les événements, et `IAsyncDisposable` pour nettoyer.
- Les types C# sont **générés** à partir du schéma JSON pour qu'ils ne divergent pas des types TypeScript (outil choisi au moment de l'implémentation).

---

## 5. Organisation du dépôt cible

```
/
├─ packages/
│  ├─ runtime/        src/{model,properties,player,migrate}/…   (aucune dépendance DOM d'éditeur)
│  ├─ editor/         src/{core,plugins/<epic>/<feature>}/…, styles/<epic>/<feature>.less
│  └─ export-css/     src/…
├─ dotnet/
│  └─ JsTimeline.Blazor/   (+ JsTimeline.Blazor.Tests)
├─ demo/              page de démo (GitHub Pages)
├─ e2e/               tests Playwright
├─ schema/            timeline.schema.json (source des types TS et C#)
└─ doc/
```

- **npm workspaces** pour lier les packages entre eux.
- Noms proposés : `@werddomain/timeline-runtime`, `@werddomain/timeline-editor`, `@werddomain/timeline-export-css` (le scope npm doit exister ; à confirmer au moment de publier).
- **Build** : Vite en mode librairie pour chaque package (modules ES + UMD + `.d.ts`), noms de fichiers **sans hash**, et un champ `exports` correct dans chaque `package.json`.
- **Styles** : un fichier LESS par plugin qui rend du contenu, tous imbriqués sous `.JsTimeLine`, compilés en un seul `editor.css`. Les couleurs et tailles passent en variables CSS pour permettre les thèmes.

---

## 6. Stratégie de tests

| Niveau | Outil | Ce qui est couvert |
|---|---|---|
| Unitaire `runtime` | Jest | Interpolation, composition des transformations, accélérations, construction des images clés Web Animations, migration v1 → v2, `seek`/boucle/vitesse (avec un faux `Element.animate`) |
| Unitaire `editor` | Jest + jsdom | `PluginHost` (ordre, dépendances manquantes ou circulaires), `EventBus` typé, chaque commande **et son annulation**, verrouillage, règles CS4 (couper une plage, supprimer une interpolation…). Les 152 tests actuels sont réaffectés aux plugins. |
| Unitaire `export-css` | Jest | CSS généré comparé à des fichiers de référence, et liste des avertissements |
| Conventions | Jest | En-tête de chemin dans chaque fichier, dépendances d'en-tête = `dependencies`, aucun `any` (règle ESLint) |
| Bout en bout | Playwright (Chromium) | Voir la liste ci-dessous |
| .NET | xUnit + bUnit | Sérialisation du modèle C#, rendu des composants, appels d'interop simulés |

Scénarios Playwright prévus pour la v1 :
1. Ajouter un calque, le renommer, changer sa couleur, le masquer, le verrouiller.
2. Sélectionner plusieurs calques (Ctrl/Maj) et les grouper ; glisser un calque dans et hors d'un dossier ; réordonner.
3. Ajouter une image clé avec le bouton et avec F6 ; la déplacer par glisser ; la supprimer.
4. Créer un motion tween à partir de deux images clés, puis à partir d'une seule ; le supprimer.
5. Modifier `x` à l'image 30 dans une interpolation et vérifier qu'un losange apparaît.
6. Vérifier qu'un calque verrouillé refuse toute modification (boutons, raccourcis et glisser).
7. Défilement horizontal : la colonne des calques reste visible ; défilement vertical : calques et lignes restent alignés.
8. Zoom de la règle, changement des fps et de la durée.
9. Déplacer la tête de lecture et vérifier, avec `getComputedStyle`, que la cible a le bon `transform` et la bonne opacité à l'image N (aperçu en direct).
10. Annuler/rétablir après chacune des actions ci-dessus.
11. `runtime` seul : lecture, pause, boucle, événement `complete`.
12. Le CSS exporté appliqué à une page vide donne le même style à l'image N que le `runtime` (test de cohérence).

CI GitHub Actions à chaque push et pull request : installation, lint, Jest (avec seuil de couverture proposé à 80 % sur `runtime`), build, Playwright, `dotnet test`. La publication npm, NuGet et GitHub Pages se fait seulement sur un tag `v*`. Node 22.

---

## 7. Plan de réalisation par phases

Chaque phase laisse le dépôt **compilable et testé**, et peut faire l'objet d'une pull request séparée.

| Phase | Contenu | Résultat vérifiable |
|---|---|---|
| **0. Fondations** | Passage en monorepo (workspaces), code actuel déplacé dans `packages/editor` sans changement, Vite à la place de webpack, correction de `package.json`, ESLint, CI avec tests, installation de Playwright avec un premier test « la timeline s'affiche » | La démo actuelle fonctionne toujours, CI verte, un package installable localement |
| **1. Runtime** | Schéma JSON v2, registre de propriétés, interpolation, lecteur Web Animations, migrateur v1 → v2 | Une page de démo anime un `div` à partir d'un JSON écrit à la main |
| **2. Noyau de l'éditeur** | `PluginHost`, `EventBus` typé, `CommandStack`, `Store` ; les managers actuels deviennent des services de commandes | Tests du noyau ; annuler/rétablir sur les actions existantes |
| **3. Epic layout + layers** | Découpage de `JsTimeLine.ts` et `LayerPanel.ts` en plugins ; couleur, icône, cible, sélection multiple, grouper la sélection, barre d'outils des calques | Scénarios Playwright 1, 2 et 7 |
| **4. Epic frames + tweens (CS4)** | Plages, images clés de contenu et de propriété, motion tween, préréglages d'accélération, verrouillage dans les commandes | Scénarios 3 à 6 |
| **5. Barre d'outils + lecture** | Barre principale, 4 boutons du cahier, zoom, fps/durée, contrôles de lecture, aperçu en direct via `runtime` | Scénarios 8 à 11 |
| **6. Propriétés + persistance** | Plugin panneau de propriétés, import/export, API `setProperty` | Scénario 5 par le panneau et par l'API |
| **7. Export CSS** | Package `export-css` | Scénario 12 |
| **8. NuGet / Blazor** | Razor Class Library, composants, modèle C# généré, tests bUnit, publication | Une appli Blazor d'exemple qui édite et joue une animation |
| **9. Finition** | README réécrit (CS4, nouvelle API), documentation de l'API, démo GitHub Pages, version 1.0.0 | Publication des tags npm et NuGet |

---

## 8. Points laissés à l'implémentation

Rien de ce qui suit ne change ce que fait la v1 ; j'ai pris une valeur par défaut, à confirmer en route :
- Le scope npm (`@werddomain/...`) et le nom NuGet (`JsTimeline.Blazor`).
- La version .NET ciblée (.NET 8, version LTS).
- Le jeu d'icônes des calques (proposition : quelques icônes SVG intégrées, et une icône personnalisée par URL ou par classe CSS).
- Les préréglages d'accélération : `linear`, `ease`, `ease-in`, `ease-out`, `ease-in-out`, plus `cubic-bezier(...)` saisi à la main.
- Les niveaux de zoom de la règle (proposition : 25 % à 400 %, et « ajuster à la fenêtre »).
- La migration v1 → v2 : on n'écrit jamais au format v1 ; les vieux fichiers sont convertis à la lecture.
