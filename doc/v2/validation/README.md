# doc/v2/validation/README.md

# Démonstrations et tests conservés des phases 3, 4 et 7

Ces pages conservent les supports des phases 3 et 7 et ajoutent la revue de phase 4,
ainsi que tous leurs contrôles automatisés. Elles utilisent les API existantes et
le serveur de démo du runtime ; aucun serveur personnel, chemin absolu de PC ou
téléchargement de dépendance supplémentaire n'est nécessaire.

## Ouvrir les pages

Depuis la racine du dépôt :

```powershell
npm ci
npm run build:demo
$env:E2E_EDITOR_PORT = '9310'
$env:E2E_RUNTIME_PORT = '9311'
npm run preview:validation
```

Sur une machine neuve, installer une fois Chromium avec
`npx playwright install chromium` avant les tests (voir aussi
[le guide E2E](../../../e2e/README.md)).

- Phase 3 : <http://localhost:9311/validation-phase3.html>.
- Phase 4 : <http://localhost:9311/validation-phase4.html>.
- Phase 7 : <http://localhost:9311/validation-phase7.html>.
- La page d'accueil du runtime contient aussi les trois liens.

Les ports proviennent de `tools/devPorts.ts`. Une autre copie de travail doit
choisir une autre paire. Pour travailler sur les pages sans reconstruire à chaque
modification, utiliser `npm run dev:validation` avec les mêmes variables.

## Relancer les contrôles

Après `npm ci` et `npm run build:demo`, dans un terminal où aucun de ces serveurs
n'est déjà en cours d'exécution :

```powershell
$env:CI = '1'
$env:E2E_EDITOR_PORT = '9310'
$env:E2E_RUNTIME_PORT = '9311'
npm run test:validation
```

Playwright démarre et arrête les deux serveurs lui-même. Cette commande sélectionne
`e2e/validation/` ; `npm run test:e2e` inclut également ces contrôles dans la suite
complète. Les captures sont écrites dans les résultats Playwright, pas dans Git.

Les gardes HTTP de l'ancien serveur temporaire sont conservées à part :

```powershell
npm test --workspace tools/conventions -- --runInBand validationPreviewServer
```

Elles vérifient un vrai serveur Node sur un port éphémère : seuls les fichiers
explicitement autorisés sont accessibles, les chemins absents renvoient 404 et
les méthodes d'écriture 405. Ces exigences concernent ce serveur de revue, et non
le serveur de développement Vite.

## Ce qui est couvert

### Phase 3 : calques et mise en page

Les onze contrôles d'origine sont conservés : chargement/arborescence, dossiers,
renommage avec undo/redo, perte de focus simulée, clic réel dans une iframe,
visibilité et verrouillage annulables, couleur, cible, déplacement au clavier,
zoom/défilement synchronisé, règle et tête de lecture au clavier.

La perte de focus du document est simulée de manière explicite. Le véritable
Alt+Tab du système reste un contrôle manuel. Les limites de mise en page et de
calques sont décrites dans `doc/v2/todo/layout-L1-L3.md` et `calques.md`.

### Phase 4 : images et interpolation

La nouvelle page propose une scène courte et trois calques : un carré avec deux
positions, une source vide aux images 1–4 et une orbe avec deux images clés. Les
boutons de démonstration de l'interpolation appellent le service existant
`tweens.motion` ; leur disponibilité suit la sélection. La checklist indique les
manipulations à refaire manuellement. La réinitialisation restaure le document,
la sélection, l'historique, le presse-papiers d'images et les coches.

Huit contrôles indépendants conservent la sélection simple/Ctrl/Maj sans
historique, F5 sans rechargement du navigateur, F6, F7 avec masquage réel de la
scène, un glisser horizontal de clé de contenu, le collage Ctrl+C/Ctrl+V d'une
plage vide, la création/suppression d'interpolation avec annuler/rétablir et la
réinitialisation. Le glisser déplace la clé intérieure 5 vers 7 sans collision.

Le cas de régression du presse-papiers part d'un carré à x = 0 sur 1–4, x = 100
sur 5–8, puis d'une plage statique sans piste sur 9–24. Coller le vide sur 5–8
doit masquer le carré puis conserver x = 100 dès 9. Les tests vérifient à la fois
`editor.sample()` et les styles calculés de la vraie scène, puis le document
complet après un seul annuler et après rétablir. Chaque contrôle collecte les
erreurs de page/console et joint une capture.

Pour ne lancer que ces contrôles, après construction, dans le même environnement
de ports et de CI :

```powershell
npm run e2e --workspace e2e -- validation/phase4.spec.ts
```

Cette page est un support de validation de la phase 4. Elle ne vaut pas validation
utilisateur et ne couvre pas tous les scénarios E1, les navigateurs autres que
Chromium, le tactile, les propriétés ou courbes à venir, ni les futurs contrôles
de barre d'outils de la phase 5.

### Phase 7 : export CSS

La démonstration réutilise `DEMO_ANIMATION`, sans seconde copie du document.
Les mêmes trois cibles sont rendues par le runtime et par les véritables
animations CSS exportées, dans deux racines isolées. Les tests comparent leurs
styles calculés aux 48 images entières : translation, matrice, opacité et
visibilité, dont la plage vide 25 à 32 et le retour à 33.

Les contrôles conservent aussi le curseur, les boutons des limites, les trois
codes d'avertissement, l'absence d'erreurs de navigateur et le contenu exact du
téléchargement CSS local.

La portée reste celle des cas vérifiés : cibles par sélecteur et propriétés CSS
connues. Le CSS anime tous les éléments correspondant au sélecteur, alors que le
runtime choisit le premier. Les courbes échantillonnées sont comparées aux images
entières. Avant une première plage tardive, le CSS peut tenir une valeur tandis
que le runtime conserve le style initial. La boucle est unique ou infinie.

## Périmètre

Les pages des phases 3 et 7 conservent les démonstrations validées et leurs tests ;
la page de phase 4 ajoute le support de revue de cette phase. Les autres
scénarios de la tâche E1 et les fonctionnalités restantes du plan restent à faire.
Les sorties de test et les paquets NuGet locaux ne sont pas publiés ni versionnés.
