# doc/v2/validation/README.md

# Démonstrations et tests conservés des phases 3 et 7

Ces pages conservent les supports utilisés pour les validations des phases 3 et 7,
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
- Phase 7 : <http://localhost:9311/validation-phase7.html>.
- La page d'accueil du runtime contient aussi les deux liens.

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

Il s'agit du portage des démonstrations validées et de leurs tests. Les autres
scénarios de la tâche E1 et les fonctionnalités restantes du plan restent à faire.
Les sorties de test et les paquets NuGet locaux ne sont pas publiés ni versionnés.
