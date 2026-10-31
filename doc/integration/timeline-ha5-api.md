<!-- doc/integration/timeline-ha5-api.md -->
# HA5 — Données de lecture et JavaScript autonome

30 octobre 2026. Contrat HA-TL-001 r2, branche `v2/HA5-playback-exports`,
base `fef760a`. Cette page décrit les API de cette branche ; elle n'annonce pas
une nouvelle version publiée. Les résultats de vérification sont consignés dans
`doc/v2/todo/ha5-validation.md` du dépôt Timeline.

## Trois documents distincts

Le document éditable conserve les clés originales, leurs transitions, leurs
effets et les sources des courbes découpées. Il reste la source de conception.
Un export ne le modifie pas et ne transforme pas les images évaluées en clés.

Le document de lecture générique contient `version:1`, `sampling:'frames'`,
`fps`, `totalFrames`, un dictionnaire `objects` et un dictionnaire `frames`.
Les objets sont indexés par leur identifiant de calque, avec leur nom et leur
cible sérialisable éventuelle. Chaque image contient, pour chaque objet,
`{active,values}` : l'état complet des seules propriétés enregistrées, avec
leurs valeurs typées. Les autres propriétés de l'objet hôte ne sont pas exportées.

Le document de lecture HTML contient `version:1`, `sampling:'frames'`, `source`,
`groups` et `frames`. `source` conserve le document de lecture générique et ses
objets distincts. Les images HTML contiennent les déclarations CSS résolues par
groupe et font autorité pour le rendu DOM : elles intègrent spécificité, cas 59,
décisions de conflit et composition des transformations/dégradés. Relire seulement
`source` ne remplace donc pas le lecteur HTML.

## Précision temporelle

Ces formats préévaluent chaque image entière, conformément à la sortie demandée
dans la section 7 du contrat. Une recherche fractionnaire utilise le plancher,
puis le bornage entre 1 et N. Par exemple, 20,5 relit l'image 20. Les valeurs se
maintiennent jusqu'à l'image suivante ; aucune interpolation n'est inventée
entre deux échantillons d'un effet élastique ou d'un interpolateur personnalisé.

Le début de l'image 1 correspond à zéro milliseconde. La durée est `N / fps`
secondes, avec maintien de la dernière image jusqu'à la fin. Le rendu du document
éditable reste exact aux images fractionnaires ; les sorties HA5 annoncent
explicitement leur précision par image et ne prétendent pas remplacer ce mode.

## Compilation et lecture génériques

```ts
const result = compilePlayback(document, { registry });
if (result.status === 'exported') {
  const data = parsePlayback(JSON.parse(JSON.stringify(result.data)));
  const snapshot = samplePlayback(data, 20);
  const clock = createManualClock();
  const player = createPlaybackPlayer(data, {
    clock,
    render: (objects, time) => renderObjects(objects, time.integerFrame)
  });
  player.seek(20);
  player.play();
  clock.advance(1000 / data.fps);
  player.destroy();
}
```

L'horloge est explicite. Le lecteur n'installe aucune scène HTML implicite : son
callback peut piloter des objets ordinaires, un canvas ou un autre hôte.
Le transport existant fournit lecture, pause, recherche, vitesse, boucle,
événements et destruction. Les snapshots remis à l'hôte sont détachés.

`compilePlayback` retourne un `PlaybackResult<IPlaybackDocument>` :
`{status:'exported',data,diagnostics}` ou `{status:'refused',diagnostics}`.
Chaque diagnostic possède `code`, `message` et éventuellement `layerId`,
`property`, `frame`. Un refus ne fournit pas d'artefact partiel.

`parsePlayback(input: unknown)` valide et détache une valeur déjà décodée ; passer
le résultat de `JSON.parse` pour un texte JSON. Il refuse les données mal formées,
versions inconnues, valeurs non finies et objets exécutables. La compilation et
la lecture sont bornées pour éviter la création de tableaux d'images démesurés.
`maxCells` peut abaisser le budget de compilation, sans relever sa limite absolue.

Une garde distincte refuse avec `resource-limit` les entrées dépassant dix millions
d'unités de travail estimées, avant validation sémantique et évaluation. Elle tient
compte des parcours de clés, transitions et sources de courbes, en plus de la taille
de sortie. Cette estimation conservatrice ne garantit pas le temps d'exécution
d'un interpolateur personnalisé fourni par l'hôte.

## Compilation HTML et ciblage

```ts
const result = compileHtmlPlayback(document, {
  root: sceneContainer,
  animationContext: project.html,
  registry,
  sourceStage: stage
});
```

Fournir `sourceStage` quand une scène pilote déjà l'aperçu. La compilation utilise
alors `withSourceStyles` pour lire les styles sources et rétablir l'aperçu ensuite.
Les capacités de groupe, validations de dégradé et décisions sont les mêmes que
dans la scène HA4 ; un conflit non résolu ou périmé refuse l'export entier.

Un groupe exporté possède `{id,include,exclude,count}`. Il résout les sélecteurs
inclus et exclus, sans dépendre de l'ordre des éléments dans le DOM. Les éléments
de ce groupe reçoivent le même flux de déclarations. Si des bases non animées,
comme une rotation différente, imposent des flux distincts, le compilateur doit
pouvoir les séparer par ID unique vérifié ou par un sélecteur unique fourni via
`selectorForElement`. À défaut, il refuse et demande un ciblage explicite.
Il n'ajoute aucun ID ni classe au document original.

Les références DOM directes, cibles génériques et cibles absentes ne deviennent
pas silencieusement des sélecteurs exportés. Le format HTML exige une scène
HTML complète exportable ; utiliser le format générique pour les autres objets.
Les groupes décrivent la scène capturée : après changement de sa structure ou de
ses styles sources, recompiler au lieu de réutiliser un export devenu inapplicable.

## Lecteur HTML et module autonome

```ts
const data = parseHtmlPlayback(JSON.parse(savedHtmlJson));
const player = createHtmlPlaybackPlayer(data, { root: outputContainer });
player.seek(50);
player.play();
player.pause();
player.setSpeed(0.5);
player.destroy();
const javascript = exportHtmlJavascript(data);
```

Le module JavaScript produit exporte `createPlayer(options)` et contient ses
données de lecture. Il ne télécharge aucune dépendance et ne demande ni Timeline,
ni `eval`, ni constructeur `Function`. L'hôte peut le sauvegarder comme fichier
`.mjs`, l'importer normalement et appeler `createPlayer({root})`.

Le lecteur HTML expose `currentFrame`, `playing`, `speed`, `loop`, `play`,
`pause`, `seek`, `setSpeed`, `destroy`. Il accepte une horloge explicite ; à défaut,
il utilise celle du navigateur. `autoplay` est une option explicite.

Les correspondances sont vérifiées avant application. Seules les déclarations
pilotées sont écrites dans `style`, avec la priorité nécessaire à l'aperçu.
La destruction restaure leurs valeurs et priorités d'origine en préservant les
styles voisins. Les données sérialisées restent des données, y compris les noms
contenant guillemets, retours de ligne ou texte ressemblant à une balise script.

Les schémas séparés sont `schema/playback-document.schema.json` et
`schema/html-playback-document.schema.json`. Ils ne changent pas le modèle .NET
du document éditable. Leurs parseurs runtime vérifient également les références,
la couverture des images et les budgets que le schéma seul ne peut pas garantir.

## Démonstration et suite

`demo/editor/playback-exports.html` compare la source avec un JSON rechargé et le
module autonome réellement généré, dans des scènes séparées. Les tests sont dans
`e2e/validation/playback-exports.spec.ts` et restent réutilisables.
L'export CSS fidèle et ses refus motivés constituent HA6 ; cette API HA5 ne les
annonce pas comme livrés.
