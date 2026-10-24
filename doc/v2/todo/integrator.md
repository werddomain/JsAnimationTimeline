# Intégration v2 : ce qui reste à faire

*Arrêt demandé par Benoit le 24 octobre 2026 à 16 h 17. Rien n'a été fusionné après cette heure.*

- `v2/base` est à `6d60fb6`. Tout est fusionné jusqu'à #91, sauf #79.
- Rien n'a été fusionné dans `main`.
- Rien n'a été publié sur npm ou NuGet.

## Pull requests ouvertes

| PR | Tâche | Tête | Gate | Revue cloud | Prochaine étape |
|---|---|---|---|---|---|
| [#79](https://github.com/werddomain/JsAnimationTimeline/pull/79) | K3, copier-coller des images (3e tour) | `216899a` | verte | **bloquant** | La renvoyer au fil Grille avec les points ci-dessous. Le renvoi n'était pas encore parti au moment de l'arrêt. |
| [#92](https://github.com/werddomain/JsAnimationTimeline/pull/92) | Y4, régressions de #87 | `6ce2895` | verte | pas faite | La faire relire, puis la fusionner. |
| [#93](https://github.com/werddomain/JsAnimationTimeline/pull/93) | C7, suivis de #78 (`reportFeed`) | `33123c1` | verte | pas faite | La faire relire, puis la fusionner après #92. |

Arbres validés par la gate, valables tant que `v2/base` reste à `6d60fb6` :

- `merge-tree` de `v2/base` avec #92 : `c513b86` ;
- #93 par-dessus #92 : `bacdd05` ;
- #79 seule : `3cb0123`.

Si `v2/base` a bougé, ces arbres ne valent plus : il faut relancer la gate.

### #79, 3e tour : ce qu'il faut renvoyer

Les deux relecteurs ont trouvé le point 1 chacun de leur côté, et un vérificateur l'a confirmé. Les points 1 et 2 ont aussi été reproduits avec un test jetable sur la pile `f59de22`.

1. **Bloquant.** `clipboardOps.ts`, `pinAfterPaste` (lignes 118 à 134, appel aux lignes 154 à 159). Seules les propriétés écrites par le collage sont fixées. Or le runtime reporte la dernière valeur d'une propriété sur les plages suivantes. Une propriété posée par une plage que le collage supprime ou raccourcit change donc toutes les images après le collage, ce qui contredit l'en-tête du fichier (« les images après le collage gardent leurs valeurs »). Deux cas reproduits :
   - fixe 1-4 avec x=0, fixe 5-8 avec x=100, fixe 9-12 sans piste. On colle en 5 une suite de 4 images qui ne pose que y. Aux images 9 à 12, x passe de 100 à 0. Une suite vide donne le même résultat, à cause du retour anticipé quand `names.size === 0`.
   - interpolation 1-10 avec x de 0 à 100, puis fixe 11-30 sans piste. On colle en 5 une suite de 10 images qui ne pose que l'opacité. Aux images 15 à 17, x passe de 100 à 33,3.

   Correctif proposé : au début de la première plage non vide après le collage, fixer chaque propriété dont la valeur reportée diffère entre le calque d'origine et le résultat. Par exemple, prendre l'union de `collectLayerProperties(original)` et des noms collés, et enlever le retour anticipé. Il faut un test pour chacun des deux cas.
2. **Important (régression par rapport au 2e tour).** `clipboardOps.ts:124` : `evaluateValues` refuse les propriétés inconnues. Un collage qui tombe sur des bords de plage est donc refusé sur un calque qui porte une propriété inconnue du registre. Cas reproduit : fixe 1-4 avec `glow`, vide 5-6, fixe 7-10 avec x. On colle en 5 deux images qui posent y, et le collage est refusé avec « Unknown property "glow" ». Au 2e tour, le même collage passait. Correctif : évaluer avec `unknownProperties: 'skip'`, ou se rabattre sur les valeurs par défaut. Le corps de la PR présente ce point comme un LOW accepté, mais c'est une régression.
3. **Mineur.** Il manque deux tests :
   - `hasTextSelection` avec `focusNode` : une sélection qui commence dans la page et finit dans l'éditeur ;
   - la garde `isGrouping` sur Ctrl+V : le test actuel ne presse que Ctrl+C.
4. **Mineur (doc).** L'en-tête doit préciser deux choses :
   - la promesse ne vaut que pour les interpolations linéaires, car les morceaux d'une interpolation accélérée coupée changent ;
   - fixer la valeur par défaut du registre peut changer ce qu'on voit, par exemple une opacité de 1 sur un élément dont le CSS dit 0,5.

## Suivis envoyés, pas encore faits

Ils ont tous été transmis aux fils concernés par le coordinateur. Aucun n'est bloquant.

- **P2 (#86, aperçu en direct)**, 4 mineurs :
  - en mode limité, une image peut être rendue deux fois : il suffit de nuancer l'en-tête ;
  - le test du relâchement différé en mode limité passe aussi sur l'ancien code ;
  - le menu « Aperçu » disparaît sans rien dire si `toolbar.main` s'initialise après le plugin ;
  - l'éditeur du test des plugins par défaut n'est pas détruit dans `afterEach`.
- **T2 (#88, boutons des images clés)**, 2 importants :
  - « Supprimer l'image clé de propriété » peut supprimer toute une interpolation, quand la sélection couvre aussi le début de l'interpolation ;
  - l'infobulle d'un bouton indisponible n'affiche que la raison, jamais le nom du bouton.

  Et 4 mineurs :
  - Supprimer est actif sur une image ordinaire, où il ne fait rien ;
  - tout l'état est recalculé à chaque image pendant la lecture ;
  - le test du retour arrière à l'initialisation est vide ;
  - trois tests d'abonnement passent sans leur abonnement.
- **Calques (#90)**, 1 mineur : changer de fenêtre pendant un renommage laisse le focus sur `body` au lieu de la ligne.
- **W1 (#91)**, 1 mineur : la JSDoc de `mergedTracks` ne mentionne pas l'exception pour une image clé vide.
- **Y4 (#87)** : la réponse est #92, à relire.
- **C7 (#78)** : la réponse est #93, à relire.
- Suivis de K2 : je n'ai rien noté d'ouvert de mon côté. C'est à vérifier dans le fil concerné.

Le détail de chaque point, avec fichier et ligne, est dans les messages au coordinateur du 24 octobre.

## Phases en attente de validation

- Phases 0, 1 et 2 : validées le 22 octobre.
- Phase 2b : validée le 24 octobre à 16 h 12.
- **Phase 3** (structure de l'éditeur et calques) : bilan et démo dans `/mnt/project-files/analysis/phase3/`.
- **Phase 7** (export CSS) : bilan et démo dans `/mnt/project-files/analysis/phase7/`.

## Suite du plan

Rien ne démarre sans le feu vert de Benoit. Voici ce qu'il reste dans `doc/v2/plan-integration.md`, avec les dépendances entre parenthèses :

- **Phase 4** :
  - K3 (#79, voir plus haut) ;
  - W2, `tweens.propertyKeyframes` et `editor.setProperty()` (W1, C7) ;
  - W3, `tweens.easing` (W1).
- **Phase 5** : I1, `interaction.contextMenu` (K2, W1, Y8). T2 est fusionnée.
- **Phase 6** :
  - S1, `properties.panel` (W2, Y5, C7) ;
  - E1, démo de l'éditeur v2 et scénarios Playwright 1 à 10 et 9b (K3, W3, I1, S1 et les autres).
- **Phase 8** :
  - B3, composant Blazor `TimelineEditor` (E1, B3a, S2, C7) ;
  - B4, appli Blazor d'exemple (B2, B3).
- **Phase 9** :
  - Z1, retrait de l'ancien code (E1) ;
  - D1, documentation (Z1, X2, B4, R5, R8) ;
  - D2, publication 1.0.0. Elle se prépare, mais on ne publie jamais sans Benoit.

W2, W3 et I1 n'attendent que du travail déjà fusionné : ils peuvent démarrer en premier. S1 attend W2, puis E1 attend K3, W3, I1 et S1.

## Méthode d'intégration, pour reprendre

- **Règles de Benoit** :
  - fusionner librement dans `v2/base`, jamais dans `main` ;
  - ne jamais publier ;
  - lancer build et tests en commandes ordinaires, jamais par des agents UltraCode ;
  - s'arrêter pour validation à la fin de chaque phase ;
  - chaque PR doit indiquer le résultat de sa revue ECC.
- **Gate** (`integrator/gate.sh`) :
  - dist propre, `npm ci`, lint (0 erreur), typecheck, `npm test`, `npm run build`, `npm run build:demo` ;
  - `dotnet build -c Release` (0 avertissement) et `dotnet test` ;
  - `npm run test:e2e`.

  `integrator/gate-stack.sh` passe la gate sur chaque commit d'une pile, dans l'ordre. Les chemins sont ceux de la session cloud de l'intégrateur : adapter `S=` et le dossier du dépôt.
- **Pile** : empiler les PR avec `git merge-tree --write-tree` et `git commit-tree`, puis passer la gate sur chaque arbre intermédiaire. Fusionner une PR à la fois avec le SHA complet de 40 caractères. Juste avant chaque fusion, vérifier que l'arbre de `merge-tree` est celui qui a passé la gate ; juste après, que l'arbre de `v2/base` est le même.
- **Revue** : `integrator/review-prs-batch.js` est le workflow de revue en lecture seule (un relecteur par dimension, puis un vérificateur qui essaie de réfuter). Selon la gravité :
  - bloquant : renvoyer la PR ;
  - important ou mineur : fusionner, puis envoyer les suivis.
- **Cloud** :
  - Playwright a besoin d'un lien `PLAYWRIGHT_BROWSERS_PATH` ;
  - .NET 8 s'installe par `apt-get install dotnet-sdk-8.0`.
- **GitHub Actions** est bloqué par la facturation du compte. Les fusions reposent sur la gate locale et sur celle du cloud.
- **Paquet NuGet** : le dernier contrôle de `dotnet pack` date du 24 octobre, sur `37c5a0e`. Il passe avec 0 avertissement, et les fichiers JS sont inclus. Le paquet est resté dans le dossier de travail et n'a pas été publié.
