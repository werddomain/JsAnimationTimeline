<!-- doc/integration/timeline-ha6-api.md -->
# HA6 — Export CSS continu et refus explicites

Contrat HA-TL-001 r2. Branche `v2/HA6-css-export-conformance`, issue de
`79aea4c` (HA5, PR #126). Cette page décrit l'API du chantier ; elle ne constitue
pas une annonce de publication. Les résultats finaux sont consignés dans
`doc/v2/todo/ha6-validation.md` du dépôt Timeline.

## API HTML stricte

```ts
import { exportHtmlCss } from '@kazo-ca/timeline-export-css';

const result = exportHtmlCss(project.timeline, {
  root: sceneContainer,
  animationContext: project.html,
  sourceStage: stage,
  prefix: 'project-',
  loop: false
});
if (result.status === 'exported') {
  saveStylesheet(result.css);
} else {
  showDiagnostics(result.diagnostics, result.alternatives);
}
```

Les options publiques `IExportHtmlCssOptions` comprennent `root` obligatoire,
`animationContext`, `registry`, `sourceStage`, `selectorForElement`,
`rootSelector`, `prefix`, `loop` et `maxKeyframes`. L'inspection s'effectue dans
`sourceStage.withSourceStyles` lorsque ce stage est fourni. Utiliser cette option
pour compiler pendant un aperçu actif, afin de lire la scène d'origine.

`HtmlCssExportResult` distingue :

- Succès : `{status:'exported',fidelity:'continuous',css,html,diagnostics}`.
- Refus : `{status:'refused',css:'',html:'',diagnostics,
  alternatives:['javascript','json']}`.

Un diagnostic possède `code`, `message` en français et, lorsque la localisation
est disponible, `layerId`, `property`, `fromFrame`, `toFrame`.
Un seul cas non représentable refuse tout l'artefact. L'application conserve
toujours son document éditable et peut présenter les alternatives HA5.

Pour les auteurs d'autres exporteurs, le runtime expose aussi
`withPreparedHtmlExport(document, options, action)`. Son callback synchrone reçoit
le document validé, le contexte, le registre, les cibles résolues, leurs trajectoires
et les bases de transformation pendant la suspension des styles d'aperçu. Le
résultat conserve la forme `PlaybackResult<T>`. `IHtmlResolutionPlan.trajectories()`
expose la provenance sélectionnée et les politiques avant première clé ; ce n'est
pas une reconstruction de courbe à partir d'échantillons. Le Designer n'a pas
besoin de ces points avancés pour appeler `exportHtmlCss`.

## Précision et limites

La sortie CSS acceptée décrit des trajectoires continues à partir des clés et
transitions résolues, sans ajustement d'une courbe sur les images HA5. Le temps de
l'image `f` est `(f-1)/fps`, la durée totale `N/fps`, et la dernière valeur reste
appliquée pendant la dernière image. Les maintiens utilisent un changement à la
clé, sans décalage artificiel juste avant celle-ci.

Le sous-ensemble numérique vérifié comprend l'opacité sans unité et les longueurs
CSS prises en charge en pixels. Les transitions linéaires/Bézier directes et les
maintiens de texte/couleur sont acceptés. Les dégradés maintenus peuvent être
exportés ; toute interpolation de paramètre de dégradé est refusée. Une transformation
composée doit conserver exactement la fonction temporelle de chaque composante.
Les effets Blend non traduisibles, sources de courbes découpées non prouvées,
interpolateurs personnalisés, interpolations riches incompatibles et compositions
non représentables sont refusés avec leur motif.

Les sources découpées linéaires sont acceptées lorsque leurs frontières restent
cohérentes, y compris avec changements de pente internes. Les sources Bézier
découpées sont refusées. Le préfixe est un identifiant simple de 1 à 64 caractères ;
utiliser des préfixes distincts pour plusieurs exports dans une même page. Une
collision avec un nom `@keyframes` déjà connu dans la scène source refuse l'export.
`maxKeyframes` peut abaisser la limite absolue de 10 000 points CSS.

Une garde commune aux exports HTML HA5/HA6 refuse `resource-limit` avant
l'inspection lorsque le travail estimé dépasse 100 000 unités pondérées. Elle
tient compte des correspondances DOM, des clés et sources, de la taille des
textes, des dégradés et de la résolution. HA5 borne également le rendu
images × cibles. Une petite taille JSON ne garantit donc pas qu'un groupe très
large puisse être exporté ; les fonctions personnalisées de l'hôte restent hors
garantie de durée d'exécution.

Les sorties JSON et JavaScript HA5 préévaluent les images entières et portent
`sampling:'frames'`. Elles restent utiles pour ces effets, mais leur précision
discrète ne doit pas être présentée comme une interpolation CSS continue.

## Scène, groupes et cascade

La préparation partage les règles de résolution HTML avec l'aperçu, y compris
spécificité, cas 59 et décisions enregistrées. Elle ne crée aucune clé d'édition.
Les sélecteurs de sortie doivent rester limités au container ; un ID unique
existant ou `rootSelector` permet de l'identifier. Les éléments aux trajectoires
distinctes exigent un ciblage stable, jamais un indice d'ordre dans le DOM.

Une règle CSS importante peut dominer l'animation exportée. Le compilateur
inspecte les contraintes applicables et refuse les cas où il ne peut pas certifier
le rendu. Il ne supprime pas les styles concurrents et n'ajoute pas de classe ou
d'ID pour faire réussir la compilation. Après modification de la structure ou de
la cascade de la page hôte, recompiler contre cette nouvelle scène.

Les racines prises en charge sont un `Document` ou un `Element` connecté et
identifiable de façon unique. Les racines détachées et Shadow DOM sont refusées.
L'inspection de cascade est conservatrice : une règle conditionnelle inactive
peut provoquer un refus. Les feuilles inaccessibles et les animations/transitions
concurrentes affectant la sortie ne sont pas ignorées.

Les déclarations sources `animation`, `animation-*` et `all` sont également
refusées sur les cibles concernées, même sans nom d'animation actuellement actif :
une durée ou un état de pause préexistant pourrait empêcher les réglages exportés
de s'appliquer. Le refus conserve les styles sources et le dernier export valide
que l'application aurait déjà sauvegardé.

Les pistes historiques doivent être migrées explicitement vers les pistes par
propriété avant cet export strict. Un choix de priorité `beforeFirst:'underlying'`
est actuellement refusé ; les choix initial/première clé et le cas 59 restent
pris en charge. L'hôte ne doit pas interpréter ces refus comme une absence de piste.

## Ancienne API

`exportCss(document, options)` conserve ses champs `css`, `html`, `warnings`.
Il reste le chemin historique sans inspection DOM et sans certification continue.
Toute partie ignorée auparavant refuse désormais la sortie entière : `css` et
`html` sont vides si `warnings` n'est pas vide. Les documents historiques entièrement
pris en charge conservent leur sortie. Le Designer utilise `exportHtmlCss`.

## Démonstration conservée

`demo/editor/css-exports.html` compare l'aperçu réel et une scène pilotée par le
CSS produit. `e2e/validation/css-exports.spec.ts` contrôle les vraies animations
CSS à des temps fractionnaires et aux frontières, ainsi que les refus et le
ciblage. Les tests d'archives vérifient l'export public en ESM, CommonJS et
TypeScript Bundler/NodeNext.
