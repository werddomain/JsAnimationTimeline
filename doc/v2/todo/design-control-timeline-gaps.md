<!-- doc/v2/todo/design-control-timeline-gaps.md -->
# Écarts Timeline relevés pendant la discussion du contrôle Design

Date : 29 octobre 2026. État inspecté : `v2/base`, commit
`e90be9d5338b81ad644455c89ca64d22c526eb09`.
Dernières précisions produit : 30 octobre 2026.

Ce document est une liste de suivi de JsAnimationTimeline, et non la spécification
du futur contrôle Design ni un plan d'implémentation. Les décisions sont consolidées
dans [les spécifications du Designer](../../integration/specifications-designer.md).
Le [contrat cible autonome](../../integration/timeline-contract.md) accompagne
la copie de ces spécifications dans `Kazo-ca/HtmlAnimation` pour le travail parallèle.
L'inspection a été effectuée en lecture seule ; aucun code n'a été modifié et
aucun test n'a été exécuté pour cet audit. Les constats décrivent le code local.

## Responsabilités confirmées

- Le contrôle Design appartient à un autre dépôt. Il inspecte et édite du HTML
  fourni par l'application, expose un panneau de propriétés, un arbre DOM et des
  outils visuels, et s'intègre à une instance de JsAnimationTimeline.
- **Réponse 52A** : créer un nouveau monorepo avec trois packages publiés
  indépendamment : panneau de propriétés CSS, HierarchicalDomTree et Designer.
  JsAnimationTimeline conserve son dépôt distinct. Aucun dépôt ni package n'est
  créé pendant cette discussion.
- **Réponse 53A** : le périmètre initial de ces nouveaux contrôles est JavaScript /
  TypeScript. Les wrappers Blazor et leurs packages NuGet sont une extension
  ultérieure, pas une exigence de cette première version.
- JsAnimationTimeline reste indépendante du DOM : cibles HTML ou objets, valeurs
  utilisées pour du canvas, de l'audio ou d'autres comportements de l'application.
- Créer/modifier les clés, calculer les valeurs courantes, maintenir une valeur
  jusqu'à la clé suivante, capturer la valeur évaluée à l'insertion et interpoler avec MotionTween,
  préserver les courbes existantes relèvent de la Timeline. Le Designer ne doit
  pas réimplémenter ces règles.
- Une propriété pilotée par la Timeline ne signifie pas nécessairement un mouvement
  interpolé : elle peut changer instantanément à une clé.
- **Précision ultérieure aux réponses 4 et 10** : une modification de position à
  l'image 50 ajoute sa propre piste/clé, sans ajouter de clé d'opacité ni changer
  l'animation d'opacité existante de 1 à 100. Cette précision remplace l'interprétation
  précédente selon laquelle toute édition capturerait les autres propriétés.
- **Réponse 16, qui remplace les réponses 13/14 sur la durée d'une clé.** Une clé
  applique une valeur jusqu'à la clé suivante. Aucun retour automatique à la base
  n'a lieu à l'image suivante. Pour l'exemple bleu → rouge à 10 → bleu à 11 → jaune
  à 20 → bleu à 21, l'utilisateur crée d'abord les clés à 11, 19 et 21 alors que
  leur valeur évaluée est encore bleue, puis modifie la couleur aux images 10 et 20
  (la clé est créée si elle manque). La clé à 19 a mémorisé bleu avant ces changements ;
  l'édition à 20 ne doit pas modifier rétroactivement 19 ni remplacer la clé 21.
  La clé finale d'un MotionTween suit également la règle de maintien jusqu'à la
  clé suivante. La règle antérieure de clés valables une seule image est abandonnée.
- **Précision 42 : création d'une clé sans changement de valeur.** Une clé nouvellement
  créée capture la valeur évaluée à son image. L'expression antérieure « clé vide »
  désignait ces clés encore non modifiées ; elle ne demande ni reset vers le CSS
  d'origine ni effacement ni masquage. Si 20 contient bleu, créer 21 capture bleu ;
  si 20 contient déjà jaune et aucune autre clé ne modifie la valeur, créer 21
  capture jaune. L'ordre de création explique l'exemple 11/19/21. La fonctionnalité
  de reset précédemment ajoutée à cette note résultait d'une mauvaise interprétation
  de l'assistant et est retirée du périmètre.
- **Réponse 19 : insertion au milieu d'un MotionTween.** Dans une interpolation
  de 1 à 100, ajouter une clé à 50 sans supprimer le MotionTween reprend la valeur
  évaluée à 50 et produit les deux transitions 1 → 50 et 50 → 100 souhaitées par
  l'utilisateur. Pour rétablir volontairement à 50 la valeur de la clé 1, le parcours
  décrit est de supprimer le MotionTween, créer la clé à 50, lui donner la valeur
  de la clé 1, puis recréer ou non les transitions selon le résultat voulu.
  Ne pas remplacer ce parcours par une remise à zéro implicite au milieu du tween.
- **Réponse 22A** : les transitions obtenues de part et d'autre de la nouvelle clé
  sont indépendantes sur la propriété concernée. Chacune peut être modifiée ou
  supprimée séparément et avoir son propre easing. La seule insertion de la clé
  préserve exactement le mouvement initial, conformément à la réponse 6A.
- **Réponse 11** : seules les propriétés modifiées sont affichées. Modifier une
  propriété absente de la liste crée automatiquement sa ligne et sa clé dans le
  contexte d'édition temporelle ; aucune étape manuelle d'ajout de piste n'est requise.
  Le principe initial de deux modes modifiant soit la base soit les clés (3A)
  est remplacé par la précision 37 ci-dessous.
- **Réponse 37 : toute édition du Designer porte sur les clés.** La cible de la
  modification est l'image courante : création d'une clé si elle manque, sinon
  modification de cette clé. Au début, modifier la première clé change l'état
  dès le départ de l'animation. Le Designer ne modifie pas les valeurs de base
  du HTML/CSS fourni par l'application ; l'application des styles pour l'aperçu
  reste temporaire. Ne pas conserver un mode permettant de modifier silencieusement
  la source CSS ou de décaler globalement les clés lors d'un changement de base.
- **Réponse 40B** : conserver la numérotation actuelle de 1 à N. « Keyframe 0 »
  désignait le début de l'animation, pas une demande de migration du modèle.
- **Réponse 41A, recommandation acceptée par réponse partielle au groupe 40–42** :
  une première modification à 50 crée seulement la clé à 50. Avant celle-ci, la
  cible utilise son état d'origine ; l'utilisateur crée explicitement une clé
  de départ s'il souhaite y définir une valeur. Aucune clé initiale n'est ajoutée
  automatiquement.
  La précision 59 ci-dessous définit une exception ciblée pour le cas de
  recouvrement discuté ; ne pas étendre cette exception à toute première clé.
- **Réponse 24A, périmètre Designer** : distinguer l'outil Dimensions (largeur/hauteur)
  de l'outil Mise à l'échelle (`scaleX`/`scaleY`). La Timeline enregistre les propriétés
  correspondantes ; les poignées et les gestes restent du ressort du Designer.
- **Réponse 25C, panneau CSS** : permettre l'édition de toutes les propriétés CSS,
  y compris par saisie libre pour celles sans contrôle spécialisé. Un groupe
  optionnel rassemble les propriétés courantes : position, dimensions,
  transformations, opacité, marges/espacements, fonds, bordures, arrondis, ombres,
  typographie. Le Designer active ce groupe. L'extraction du contrôle de propriétés
  CSS en package réutilisable dans d'autres projets est confirmée par la réponse 28 ;
  les détails de son contrat restent à fixer. Ne pas confondre édition
  d'une propriété CSS et capacité à l'interpoler ou à l'exporter dans tous les formats.
- **Réponses 26A/27A, dégradés** : couvrir les dégradés linéaires, radiaux et coniques,
  avec une présentation et des manipulations inspirées de Microsoft Expression
  Blend 4. Les paramètres possèdent leurs propres clés/transitions indépendantes,
  regroupées sous « Dégradé » dans la Timeline. Cela concerne notamment l'angle,
  les couleurs, positions et opacités des points de couleur ainsi que la géométrie
  propre à chaque type. La correspondance exacte des contrôles visuels et la
  représentation des paramètres restent à préciser.
- **Réponse 47A et précision utilisateur** : ajouter ou supprimer un point de couleur
  agit à l'image choisie ; les autres points conservent leur identité et leurs
  animations. Le changement de structure est instantané. Pour obtenir un autre
  effet (variation d'opacité, déplacement du point), l'utilisateur définit l'état
  correspondant dans la clé précédente, puis utilise le MotionTween approprié.
  Ne pas inventer un état précédent, un fondu ou un déplacement automatiquement.
  Un point à interpoler doit avoir des états de départ et d'arrivée compatibles.
- **Réponse 28A, package CSS autonome** : il reçoit les propriétés/valeurs, présente
  les contrôles et émet les modifications ; l'application hôte assure lecture,
  application et enregistrement. Un callback/événement signale le changement de
  propriété avec `oldValue` et `newValue`. Ne pas lui imposer une dépendance à la
  Timeline pour le réutiliser dans d'autres applications.
- **Réponse 29A, recommandation acceptée par réponse partielle au groupe 28–30** :
  autoriser les changements instantanés par clés ; proposer un MotionTween seulement
  pour une propriété dont l'interpolation est prise en charge, avec une indication
  claire de cette capacité dans le panneau.
- **Notification à la création d'un MotionTween, demande explicite après 47** :
  informer l'utilisateur lorsqu'une transition demandée est impossible avec les
  états/propriétés sélectionnés. Le diagnostic doit permettre de comprendre le
  problème et sa correction. La décision d'interpolation relève de la Timeline
  et des capacités déclarées par les propriétés/intégrations ; le Designer affiche
  cette information. Ne pas confondre incompatibilité d'interpolation et limitation
  d'un format d'export particulier.
- **Réponse 48 : création d'un MotionTween sur une seule propriété.** La commande
  agit sur la ligne d'une seule propriété, pas sur plusieurs lignes simultanément.
  Le bouton est désactivé si plus de deux clés sont sélectionnées, ou si la sélection
  concerne plusieurs lignes. La situation de création partielle sur plusieurs
  propriétés proposée par l'assistant n'appartient donc pas au besoin.
  Les avertissements non bloquants n'empêchent pas la création ; une incompatibilité
  bloquante de la propriété concernée refuse la transition avec une explication.
  L'utilisateur précise aussi qu'on ajoute une propriété à la fois ; distinguer
  cette opération de la gestion éventuelle de plusieurs valeurs par un geste visuel.
- **Réponse 50A** : le bouton MotionTween exige exactement deux clés sélectionnées
  sur la même ligne de propriété. Il est désactivé avec zéro ou une seule clé,
  plus de deux clés, ou une sélection répartie sur plusieurs lignes.
- **Réponse 51A** : un geste visuel peut modifier plusieurs composantes (X/Y,
  largeur/hauteur). Chaque propriété reçoit sa propre clé et son événement de
  modification ; les opérations d'un même geste sont regroupées en une seule
  annulation. Cela n'autorise pas la création d'un MotionTween sur plusieurs lignes.
- **Réponse 49A, recommandation acceptée par réponse partielle au groupe 48–49** :
  refuser une modification de clé qui rendrait un MotionTween existant invalide,
  expliquer la cause et proposer d'adapter ou de supprimer d'abord ce MotionTween.
  Ne pas conserver un tween invalide ni le supprimer automatiquement à la place
  de l'utilisateur.
- **Réponse 30A** : l'édition du dégradé est possible dans le panneau et directement
  sur l'élément sélectionné avec des poignées synchronisées.
- **Complément à 30 : HierarchicalDomTree réutilisable** : ce contrôle est lui aussi
  destiné à un package réutilisable dans d'autres applications. Sa sélection est
  synchronisée avec celle de la Timeline ; le panneau CSS réagit aux changements
  issus de l'un ou de l'autre pour afficher la sélection courante, sans annuler
  l'indépendance du panneau CSS décidée en 28A.
- **Réponse 31A** : le Designer coordonne les événements et transmet la sélection
  et les valeurs aux composants. Le panneau CSS et HierarchicalDomTree ne dépendent
  pas directement l'un de l'autre ni de JsAnimationTimeline.
- **Réponse 32A** : sélectionner un objet Timeline dont le sélecteur représente
  plusieurs éléments sélectionne tous les nœuds correspondants dans l'arbre DOM
  et les surligne dans la scène. Le panneau montre leurs propriétés communes et
  signale individuellement les propriétés incompatibles pour une animation collective.
- **Réponse 33A** : un outil Sélection permet de choisir directement un élément
  dans la scène, intercepte le clic et synchronise les vues. Un mode Test permet
  les interactions normales des boutons/liens et autres éléments de la page.
- **Réponse 34A** : sélectionner un nœud DOM privilégie son objet Timeline associé
  à l'ID, si cet objet existe. Sinon, sélectionner l'unique objet correspondant ;
  demander un choix si plusieurs objets restent possibles. La simple sélection
  ne crée toujours pas de nouvel objet Timeline.
- **Réponse 43A, priorité de l'intégration HTML** : lorsqu'une classe commune et
  l'ID d'un élément pilotent la même propriété, l'objet associé à l'ID est prioritaire
  pour cette propriété sur cet élément. Les autres propriétés du groupe continuent
  de s'appliquer, et les autres éléments conservent les valeurs du groupe. Cette
  priorité ne doit pas introduire de dépendance CSS dans les cibles génériques.
- **Réponse 55** : le sélecteur le plus spécifique gagne. Par exemple,
  `.button.primary` est prioritaire sur `.button` pour une propriété commune.
  Cette règle prolonge la priorité ID/classe déjà décidée, sans en faire un
  nouveau choix produit à redemander.
- **Réponse 56, portée à distinguer** : l'utilisateur précise que l'objet
  sélectionné détermine la ligne concernée : `#button-2` pour cet objet, `.button`
  pour l'objet de classe. Cela précise la cible d'édition ; la réponse 58 décrit
  ensuite le résultat voulu et la résolution explicite des conflits.
- **Réponses 58/59 : cas de référence résolu, sans dialogue.** `.button` possède
  une clé d'opacité 50 % à l'image 1 et `#button-2` uniquement une clé d'opacité
  80 % à l'image 50. Le résultat est 80 % pendant toute l'animation pour
  `#button-2`, et 50 % pour les autres boutons. La réponse 59 confirme B dans
  ce cas précis : aucune clé à l'image 1 n'est ajoutée pour le bouton spécifique.
  L'utilisateur précise que ce cas n'est pas ambigu ; ne pas redemander un choix
  de résolution lorsqu'il se présente. Cette exception ciblée à 41A ne vaut pas
  validation d'une généralisation à toutes les premières clés, cibles et propriétés.
- **Réponse 59 : conflits non résolus par les règles établies.** Détecter les cas
  non couverts ou dans lesquels plusieurs règles conduisent à des résultats
  incompatibles. Les présenter à l'utilisateur avec les cibles/propriétés et les
  conséquences des choix. La sélection courante oriente le choix proposé ; la
  décision est ensuite enregistrée pour la lecture et les exports. La solution A
  est disponible lorsqu'elle résout le cas : proposer une valeur de départ
  explicite et créer la clé correspondante après validation. Ne pas ajouter cette
  clé silencieusement ni utiliser le dialogue pour les cas déjà tranchés.
- **Précision 44 : objets distincts à l'export.** `.button` et `#button-2` sont deux
  objets distincts dans le JSON, avec leurs propres changements, même si le second
  élément appartient aussi au groupe. Ne pas les fusionner au motif que leurs
  cibles se recouvrent ; la règle de priorité 43A s'applique à la lecture.
  L'organisation recommandée en 44A est un dictionnaire d'images par objet,
  regroupé sous son identifiant dans l'export complet ; aucun nom de champ concret
  n'est encore arrêté.
- **Réponses 45A/46A, recommandations acceptées par réponse partielle au groupe 44–46** :
  l'export complet contient cadence, durée et dictionnaires de valeurs. La sauvegarde
  éditable est distincte : elle conserve les clés originales, les MotionTween,
  leurs réglages et les données du Designer. Les exports CSS, JavaScript et JSON
  préévalué servent à la lecture et ne remplacent pas ce document de travail.
- **Réponse 54A** : refuser l'export CSS lorsqu'il ne peut pas reproduire fidèlement
  une animation valide à la lecture. Expliquer les parties incompatibles et proposer
  JavaScript ou JSON ; ne pas produire silencieusement un CSS partiel. La sauvegarde
  du document éditable reste disponible indépendamment de cette limitation.
- **Réponse 35A, outil Designer** : le pivot de rotation/mise à l'échelle est
  déplaçable visuellement, avec des positions prédéfinies au centre, sur les côtés
  et dans les coins. Déplacer uniquement le pivot conserve la position visuelle
  de l'élément. Le contrat de propriétés doit permettre de décrire les changements
  nécessaires sans introduire les gestes ou la géométrie HTML dans le moteur générique.
- **Réponse 36A, aides Designer** : grille optionnelle, guides d'alignement avec
  le parent et les autres éléments, accrochage activable avec désactivation
  temporaire pendant le geste, et déplacements précis au clavier.
- **Réponses 38A/39A, recommandations acceptées par réponse partielle au groupe 37–39** :
  conserver les unités CSS existantes lorsque le geste peut y être converti ;
  proposer explicitement le remplacement d'une expression qui ne peut pas être
  conservée. Un historique commun, coordonné par le Designer, annule les modifications
  dans leur ordre, une action utilisateur pouvant regrouper plusieurs propriétés
  ou composants. Les packages autonomes ne doivent pas imposer leur propre historique
  séparé à cette intégration.
- L'aperçu Design peut utiliser les styles inline. L'application doit pouvoir choisir
  une sortie CSS, JavaScript ou JSON ; la sauvegarde du design reste séparée et
  complémentaire du document Timeline.
- **Réponse 12** : proposer un JSON lisible par le lecteur et un JavaScript autonome
  pour les cibles HTML, qui applique uniquement les propriétés de style pilotées.
  Le JavaScript destiné au DOM ne doit pas être appliqué aux objets génériques.
  Pour un objet simple, le JSON souhaité est un dictionnaire numéro d'image → objet
  contenant seulement les valeurs modifiées ; les données ne doivent pas imposer
  de notions CSS/DOM.
- **Réponse 14 : export préévalué.** Chaque image couverte par un MotionTween est
  exportée avec ses valeurs calculées. Sans MotionTween, l'export décrit les changements
  issus des valeurs enregistrées dans les clés, y compris les valeurs capturées
  avant d'autres éditions (précision 42). Aucune opération spéciale de reset et
  aucune restitution automatique à `image + 1` ne sont demandées.
  Ne pas confondre ces valeurs produites pour la lecture
  avec les clés créées par l'utilisateur dans le document d'édition.
  Cadence/durée accompagnent l'export complet (45A), et les objets restent distincts
  (44). Avant sa première clé, une cible sans autre objet concurrent conserve son
  état d'origine selon 41A ; le cas de recouvrement 59 suit son exception explicite.
  L'export de lecture doit reproduire le 80 % dès l'image 1 sans ajouter de clé à
  l'image 1 dans le document éditable. La forme détaillée du contrat est un travail
  technique ultérieur.
- **Réponse 15 : sélecteur choisi par l'utilisateur.** Au premier rattachement HTML,
  demander ID ou classe si les deux sont présents. Si l'utilisateur choisit les
  classes et qu'il y en a plusieurs, proposer une classe ou une combinaison des
  classes de l'élément. Il peut aussi choisir un nouveau nom `#UnNouveauNom` ou
  `.UneClasseQuilChoisit`. Le sélecteur retenu devient le nom de l'objet. Cela remplace
  la proposition d'attribution automatique d'un identifiant.
- **Réponse 57A et complément utilisateur** : conserver le choix des nouveaux
  ID/classes dans le projet ; l'application hôte conserve ou réapplique ces
  attributs dans son HTML. Les modifications apportées au document original doivent
  être signalées dans l'interface et par événement. Fournir également une liste
  des changements d'identifiant avec le XPath complet de chaque élément dans le
  document original, par exemple `/html/body/div[1]/ghcc-consent`, et les anciennes
  et nouvelles valeurs. Le chemin demandé est un Full XPath, pas seulement un
  sélecteur CSS fondé sur l'identifiant modifié. Les styles temporaires d'aperçu
  ne constituent pas des modifications persistantes du document source.
- **Réponse 17 : plusieurs correspondances autorisées.** Une classe ou combinaison
  peut représenter plusieurs éléments avec les mêmes changements. Avertir l'utilisateur
  lors de la première création de cet objet dans la Timeline ; ne pas bloquer le
  rattachement au motif que le sélecteur n'est pas unique.
- **Réponses 20/21 : compatibilité par propriété dans un groupe HTML.** Un sélecteur
  commun peut piloter seulement les propriétés dont les valeurs sont identiques
  entre ses éléments. Une différence sur `margin-top`, due à une règle CSS plus
  spécifique, un style inline ou une autre source, interdit l'animation collective
  de cette propriété mais pas celle des autres propriétés identiques.
  Le panneau marque la propriété incompatible avec une icône d'information et une
  explication au survol. Demander des ID individuels pour animer cette propriété
  séparément ; les éléments peuvent conserver leur classe commune en plus de leurs ID.
  L'option « Valeurs multiples puis saisie commune » n'est pas retenue pour l'animation.
  Cette analyse du DOM appartient au contrôle Design/à l'intégration HTML, pas au
  moteur générique des objets. La réponse 37 confirme que les modifications du
  Designer s'enregistrent dans les clés, sans modifier la base externe.
- **Réponse 23A** : comparer les valeurs effectives du design de base, hors aperçu
  de la Timeline, indépendamment de leur origine (classes, styles inline, héritage).
  Une animation donnant temporairement la même valeur ne rend pas compatibles
  des propriétés dont les valeurs de base diffèrent.
- **Réponse 18A** : demander le sélecteur à la première modification enregistrée
  et pas à la simple inspection. Depuis la précision 37, les modifications du
  Designer vont dans les clés ; créer le calque Timeline lorsqu'une propriété
  y est enregistrée, pas à la sélection.
- La sélection doit déplier la ligne de l'élément pour montrer ses propriétés ;
  la désélection restaure l'état manuel antérieur lorsque l'ouverture était automatique.

## Capacités déjà présentes — à préserver

- **Maintien sans MotionTween** : les plages `static` conservent les valeurs jusqu'au
  changement suivant. Ce principe est conforme à la réponse 16, qui annule la
  demande temporaire de clés ponctuelles. Cela ne résout ni l'insertion automatique
  à l'image courante ni la lecture initiale des valeurs du DOM ou de l'objet fourni.
  Sources : [span.ts](../../../packages/runtime/src/model/span.ts),
  [evaluateLayer.ts](../../../packages/runtime/src/evaluate/evaluateLayer.ts).
- **Pistes de données par propriété** : `PropertyTracks` contient déjà une liste de
  clés par nom de propriété. L'absence de lignes visuelles ne signifie pas que ce
  modèle est absent. Sources : [span.ts](../../../packages/runtime/src/model/span.ts).
- **Cibles non HTML** : références de cibles, propriétés `kind: 'value'` et
  `createObjectStage` existent. L'application peut appliquer les valeurs à ses objets.
  Sources : [target.ts](../../../packages/runtime/src/model/target.ts),
  [object/types.ts](../../../packages/runtime/src/stage/object/types.ts).
- **CSS, JSON et lecture JavaScript** : l'export CSS, la sérialisation du document et
  le lecteur JavaScript existent. Cela ne constitue pas encore un exporteur de
  JavaScript autonome. Sources : [exportCss.ts](../../../packages/export-css/src/exportCss.ts),
  [PersistenceJsonPlugin.ts](../../../packages/editor/src/plugins/persistence/json/PersistenceJsonPlugin.ts),
  [API](../api.md).

## Écarts confirmés par rapport aux attentes exprimées

- [ ] **Créer/modifier la clé à l'image courante.**
  `setProperty` écrit à `span.start` dans une plage statique, et refuse une plage
  `blank` ou une image hors contenu. Le contrat demandé prévoit la création d'une
  clé à l'image courante lorsqu'elle manque, ou sa mise à jour lorsqu'elle existe.
  Ne pas confondre la position de cette clé avec la règle d'évaluation avant elle :
  le cas 59 conserve sa clé à 50 tout en s'appliquant dès le début, sans clé inventée.
  « Sans clé » et « plage blank » doivent toutefois être distingués dans le contrat.
  Source : [propertyValue.ts](../../../packages/editor/src/model/properties/propertyValue.ts).
- [ ] **Préserver exactement les courbes des propriétés non modifiées.** L'insertion
  F6 échantillonne les valeurs courantes et peut ajouter des clés à plusieurs pistes.
  Le code documente une limite : dans une plage à easing non linéaire, les valeurs
  voisines peuvent changer. La réponse 6A exige la conservation exacte de la
  trajectoire et du rythme, avant et après insertion.
  Source : [insertKeyframe.ts](../../../packages/editor/src/model/spans/insertKeyframe.ts).
- [ ] **Créer deux transitions indépendantes lors de l'insertion.** Le comportement
  demandé en 19 reprend la valeur interpolée à 50 entre 1 et 100 puis sépare les
  transitions autour de cette clé. L'insertion F6 actuelle dans un tween ajoute
  des clés de propriété sans couper la plage. La réponse 22A exige deux transitions
  modifiables/supprimables indépendamment sur cette propriété, tout en préservant
  exactement le mouvement lors de la seule insertion.
  Source : [insertKeyframe.ts](../../../packages/editor/src/model/spans/insertKeyframe.ts).
- [ ] **Afficher et éditer une ligne par propriété.** Les lignes visibles actuelles
  représentent uniquement des calques ou dossiers ; la grille fusionne les clés
  de différentes propriétés en un seul marqueur par image. La sélection de frames
  et les actions visuelles ne portent pas d'identité de propriété.
  Sources : [visibleRows.ts](../../../packages/editor/src/model/rows/visibleRows.ts),
  [gridCells.ts](../../../packages/editor/src/plugins/frames/grid/gridCells.ts),
  [selection/types.ts](../../../packages/editor/src/plugins/frames/selection/types.ts).
- [ ] **Respecter l'indépendance temporelle des propriétés.** Le cas demandé est une
  opacité interpolée de 1 à 100, conservée telle quelle, avec une nouvelle clé de
  position à 50. Le modèle possède des pistes distinctes, mais `kind` et `easing`
  appartiennent à la plage commune du calque. L'ajout de lignes visuelles ne suffit
  pas à garantir des transitions propres à chaque propriété ni l'absence de
  MotionTween implicite pour une propriété nouvellement enregistrée.
  Source : [span.ts](../../../packages/runtime/src/model/span.ts).
- [ ] **Déplier temporairement les propriétés lors de la sélection.** Seuls les
  dossiers possèdent actuellement un état de repli. La sélection ne déplie pas de
  calque et ne mémorise pas une ouverture temporaire distincte du choix manuel.
  Sources : [layer.ts](../../../packages/runtime/src/model/layer.ts),
  [LayerSelectionPlugin.ts](../../../packages/editor/src/plugins/layers/selection/LayerSelectionPlugin.ts).
- [ ] **Lire/exporter le dictionnaire générique de changements demandé.** Le lecteur
  accepte actuellement un `ITimelineDocument` avec `version`, `settings`, `layers`,
  pas directement un dictionnaire numéro d'image → objet de valeurs modifiées.
  Le nouveau contrat doit prendre en charge les valeurs préévaluées de chaque image
  des MotionTween et les changements de valeurs enregistrés dans les clés. Il nécessite
  une prise en charge explicite, à préciser avant de choisir une évolution du format
  ou un adaptateur.
  Sources : [document.ts](../../../packages/runtime/src/model/document.ts),
  [shape.ts](../../../packages/runtime/src/model/shape.ts),
  [Player.ts](../../../packages/runtime/src/player/Player.ts).
- [ ] **Proposer l'export JavaScript autonome HTML demandé.** Un lecteur JavaScript
  et l'export CSS existent ; aucun exporteur JavaScript autonome correspondant à
  ce besoin n'a été identifié dans les API inspectées. La sortie doit être limitée
  aux cibles HTML et aux styles pilotés, sans écraser les styles indépendants.
- [ ] **Aligner le ciblage multiple entre aperçu et exports.** Le contrat documenté
  de l'export CSS indique qu'il vise toutes les correspondances, tandis que le lecteur
  prend le premier élément. Le besoin confirmé en 17 exige les mêmes éléments dans
  l'aperçu et les sorties, avec un avertissement au premier rattachement à la Timeline.
  Le filtrage demandé en 20/21 doit empêcher l'animation collective d'une propriété
  dont les valeurs diffèrent entre les éléments, sans supprimer les autres pistes.
  Vérifier aussi la priorité par propriété de l'objet par ID sur l'objet de classe
  commune (43A), en conservant les autres propriétés du groupe dans toutes les sorties.
  Source : [exportCss.ts](../../../packages/export-css/src/exportCss.ts).

## Exigences complémentaires à vérifier dans le moteur et l'intégration HTML

Ces exigences issues de la dernière clarification n'ont pas fait l'objet d'un
nouvel audit du code ; ne pas les présenter comme des régressions reproduites.

- [ ] **Évaluation du cas 59** : appliquer 80 % sur toute la durée au bouton
  spécifique malgré sa seule clé à 50 ; conserver 50 % sur les autres boutons.
  Garder le document éditable sans clé initiale supplémentaire. Vérifier la lecture
  linéaire, l'accès direct à une image et tous les exports de lecture.
- [ ] **Détection des conflits non couverts** : diagnostiquer les règles qui se
  contredisent sur une même cible/propriété, sans dialogue pour une priorité déjà
  déterminée. Présenter une résolution explicite et mémorisée. Si la résolution
  ajoute une clé de départ, cette modification doit être annoncée, validée et annulable.
  L'identification des éléments/sélecteurs appartient à l'intégration HTML ; les
  opérations sur les clés et l'évaluation restent dans la Timeline.

## Référence Flash et distinction à conserver

La documentation Adobe distingue l'ajout d'une clé de propriété dans une plage
et la division explicite de cette plage avec « Split Motion ». Cette dernière
produit deux plages, et Adobe indique qu'un easing peut changer le mouvement
après division. Ne pas présenter la division automatique demandée ni la garantie
de conservation exacte des courbes comme des comportements identiques garantis
par toutes les variantes de Flash. Le comportement voulu par l'utilisateur reste
prioritaire ; la référence aide à clarifier les opérations.

Sources officielles consultées :
[clés de propriété](https://helpx.adobe.com/animate/desktop/animation/using-property-keyframes.html),
[division des plages](https://helpx.adobe.com/animate/desktop/animation/setting-animation-tween-spans-in-the-timeline.html).
Ce sont les pages actuelles d'Adobe Animate. Le texte indexé du manuel original
« Using Flash CS4 Professional » a aussi été retrouvé (pages imprimées 186, 191,
196), mais le téléchargement de la copie consultée renvoyait 403 : le PDF complet
n'a pas été inspecté. Ne pas revendiquer une vérification exhaustive du manuel CS4.

## Référence visuelle Blend 4

Le texte de l'extrait officiel de
[Microsoft Expression Blend 4 Step by Step](https://www.microsoftpressstore.com/content/images/9780735639010/samplepages/9780735639010.pdf)
décrit le panneau Properties/Brushes, une barre avec des points de couleur
sélectionnables, la couleur et l'alpha d'un point, les choix linéaire/radial et
des réglages avancés comme l'origine du dégradé radial (pages imprimées 55–56 et
85–89). Les captures du PDF n'ont pas pu être rendues par l'outil : seule la
consultation textuelle est confirmée. Les dégradés coniques sont une demande du
nouveau Designer, pas une capacité de Blend 4 vérifiée dans cette référence.

## Contrats techniques à définir à partir des décisions produit

Les contrats techniques ci-dessous n'impliquent pas chacun une nouvelle question
produit : leurs mécanismes devront respecter les comportements déjà décidés.
Le cas 59 est tranché sans clé initiale ajoutée. Les situations non couvertes ou
ambiguës passent par le mécanisme de résolution explicitement demandé. Les
contrats techniques restent à concevoir lors d'un travail ultérieurement autorisé.

- **Capture globale** : l'édition d'une propriété laisse les autres pistes intactes.
  Une nouvelle action « Capturer l'état » n'a pas été demandée/validée par la
  clarification de la réponse 10 ; ne pas l'ajouter implicitement au périmètre Design.
- **Valeurs de base** : le runtime utilise les valeurs par défaut du registre ; il
  ne lit pas automatiquement les styles du DOM. Préciser comment une intégration
  fournit l'état initial propre à chaque cible, HTML ou objet générique, tant
  qu'aucune règle d'animation ne le remplace, et lors de la création d'une clé.
  La réponse 37 interdit leur modification directe par le Designer. Ne pas assimiler
  cette base externe aux valeurs explicitement posées dans une clé. La réponse 41A
  exclut la création automatique d'une première clé ; la précision 42 exclut toute
  remise à la base implicite lors de l'insertion d'une clé. Le cas 59 doit conserver
  son exception explicite, sans clé initiale ajoutée.
- **Historique commun** : déterminer le contrat de regroupement des changements
  du Designer avec les commandes Timeline, y compris les gestes multi-propriétés
  et les valeurs de callbacks `oldValue`/`newValue`, sans doubles entrées d'historique.
- **Couleurs et dégradés** : les clés et `setProperty` acceptent des nombres.
  Des valeurs structurées ou une décomposition numérique demandent un contrat à
  définir ; ne pas présenter le support complet des dégradés comme déjà disponible.
  Les réponses 26/27 imposent trois types de dégradés et l'indépendance de leurs
  paramètres, avec un regroupement lisible des pistes. Identifier aussi les paramètres
  de points de couleur de façon stable lors de leur ajout, déplacement ou suppression.
  La réponse 47A conserve l'identité et les animations des autres points, sans création
  automatique d'états antérieurs pour rendre la nouvelle transition possible.
- **Validation d'un MotionTween** : l'utilisateur demande une notification lorsqu'une
  transition ne peut pas être créée. La création est limitée à une seule ligne de
  propriété et exactement deux clés sélectionnées (48/50A).
  Les avertissements non bloquants sont acceptés et une modification invalidante
  est refusée (49A). Définir la forme des diagnostics utilisables par l'interface.
- **Geste visuel et propriété unique** : la réponse 51A autorise plusieurs composantes
  dans un geste, avec une clé et un événement distincts par propriété et une seule
  annulation. Définir le contrat transactionnel permettant de respecter ces règles
  entre les composants autonomes et la Timeline.
- **Édition CSS et capacités de la Timeline** : le panneau réutilisable doit couvrir
  toutes les propriétés CSS (25C), alors que le modèle actuel de clés est numérique.
  Les changements instantanés et les interpolations selon les capacités disponibles
  sont retenus en 29A. Préciser la représentation des valeurs non numériques et les
  limitations des sorties, sans déplacer la logique d'animation dans le panneau CSS.
- **JSON minimal et lecture** : la préévaluation des MotionTween est choisie.
  Cadence et durée sont incluses dans l'export complet (45A) ; les objets à cibles
  distinctes restent distincts même si leurs correspondances se recouvrent (44).
  Définir encore la forme détaillée du contrat et la reconstruction lors d'un accès
  direct à une image sans rejouer les précédentes. La sauvegarde éditable des clés
  et des MotionTween est confirmée comme distincte (46A) ; ne pas demander au JSON
  préévalué de reconstruire les courbes d'édition d'origine.
- **Sélecteur choisi** : plusieurs correspondances sont autorisées avec l'avertissement
  initial convenu. La comparaison porte sur le design de base (23A). Préciser la
  réévaluation lors de changements du contenu ou du CSS après rattachement.
  Les propriétés différentes sont
  déjà décidées comme non animables avec une explication, pas comme un champ de
  saisie commune. Un nom d'objet lisible n'établit pas à lui seul
  une identité stable en cas de renommage.
  La priorité du sélecteur le plus spécifique est validée en 43A/55. La réponse 59
  résout le cas précis discuté et demande une résolution explicite pour les autres
  cas que les règles ne tranchent pas. Le suivi des
  modifications du document original comprend interface, événement et liste de
  Full XPath avec les changements d'identifiant (57).
- **Priorité CSS et fidélité de l'aperçu** : une animation CSS ne l'emporte pas sur
  toutes les déclarations possibles (`!important`, transitions actives). L'export
  actuel peut aussi cibler plusieurs éléments là où le lecteur prend le premier.
  Prévoir un contrat de ciblage et de conflit explicite, sans promettre une priorité
  universelle. La réponse 54A fixe le résultat attendu si le CSS est insuffisant :
  refuser cet export avec une explication, proposer JavaScript ou JSON et conserver
  la sauvegarde éditable. Sources : [exportCss.ts](../../../packages/export-css/src/exportCss.ts),
  [cascade CSS — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Cascade/Introduction).
- **Sélection issue du Designer** : le service de sélection ignore actuellement les
  calques non visibles dans un dossier replié. Préciser la révélation d'un élément
  sélectionné depuis le DOM et la conservation des états manuels des ancêtres.
  La synchronisation est coordonnée par le Designer (31A) ; un objet Timeline à
  sélecteur commun sélectionne tous les nœuds correspondants (32A). Le choix inverse
  privilégie l'objet associé à l'ID, puis l'unique correspondance, ou demande un
  choix si plusieurs objets restent possibles (34A). La révélation des ancêtres
  repliés et la restauration de leur état manuel restent à préciser.
- **Actions ponctuelles** : le callback d'application des valeurs d'une scène objet
  n'est pas un contrat de déclenchement unique d'actions. Lecture, recherche d'une
  image, boucle et retour arrière nécessiteraient des règles spécifiques si cette
  capacité devient une demande distincte ; elle n'est pas à implémenter ici.

## Vérifications à conserver lors d'une future implémentation autorisée

- Élément bleu : créer d'abord les clés à 11/19/21, qui capturent bleu ; modifier
  ensuite 10 en rouge puis 20 en jaune. Résultat : rouge à 10, bleu de 11 à 19,
  jaune à 20, bleu à partir de 21 sans MotionTween ; l'édition à 20 préserve 19 et 21.
- À l'inverse, créer 21 après avoir posé jaune à 20 (sans clé intermédiaire ni tween)
  capture jaune à 21, et non la couleur bleue du CSS d'origine.
- Sans clés ultérieures : la valeur rouge à 10 persiste jusqu'au prochain changement,
  sans restitution implicite à 11 ; même maintien après la clé finale d'un MotionTween.
- Export d'un MotionTween : valeurs calculées à chaque image couverte, avec la même
  courbe et les mêmes bornes que l'aperçu.
- Édition à une image intermédiaire : clé enregistrée à l'image demandée ; les
  valeurs antérieures respectent la règle applicable, y compris l'exception 59.
- Insertion sans changement : valeurs et courbes inchangées, y compris easing non linéaire.
- Insertion à 50 dans un MotionTween 1..100 : valeur évaluée à 50 conservée,
  deux transitions indépendantes ; supprimer ou modifier l'une laisse l'autre intacte.
- Déplacement d'une clé de propriété : aucune autre propriété déplacée implicitement.
- Opacité interpolée de 1 à 100 et position modifiée à 50 : piste d'opacité inchangée,
  nouvelle ligne de position créée automatiquement, aucune clé d'opacité ajoutée à 50.
- Sélection/désélection : restauration de l'état manuel de dépliage.
- Annuler/rétablir et Échap : restauration cohérente des valeurs, clés et aperçu.
- Vérification équivalente sur une cible HTML et sur un objet non DOM.
- JSON générique sans dépendance DOM et export JavaScript réservé aux cibles HTML.
- Sélecteur visant plusieurs éléments : avertissement initial, même ciblage dans
  l'aperçu et les exports ; propriétés communes animables et propriétés divergentes
  bloquées individuellement avec explication et invitation à utiliser des ID.
- Comparaison de groupe sur le design de base : des valeurs temporairement identiques
  pendant l'aperçu n'effacent pas une incompatibilité initiale.
- Sélection de groupe dans la Timeline : tous les nœuds et éléments correspondants
  sont sélectionnés/surlignés, sans création d'objet lors de la simple inspection.
- Mode Sélection : le clic sélectionne l'élément sans déclencher son action normale ;
  le mode Test restitue les interactions normales de la page.
- Sélection d'un nœud correspondant à une classe et à un objet Timeline par ID :
  privilégier l'objet par ID ; aucun objet n'est créé par une simple sélection.
- Groupe `.button` avec opacité à 50 %, objet `#button-1` avec opacité à 80 % :
  ce bouton reçoit 80 %, les autres 50 %, sans suppression des autres propriétés
  pilotées par le groupe ; vérifier l'équivalence entre aperçu et exports.
- Cas 59 : `.button` avec clé à 1 = 50 %, `#button-2` avec seule clé à 50 = 80 %.
  Aux images 1, 20, 49, 50 et après : 80 % pour le bouton spécifique, 50 % pour
  les autres. Aucun dialogue de conflit et aucune clé éditable ajoutée à l'image 1.
- Deux règles incompatibles sans priorité décidée : diagnostic visible, proposition
  contextualisée par la sélection, décision enregistrée. La clé initiale proposée
  par A n'est ajoutée qu'après validation ; annuler restaure l'état précédent.
- Objets `.button` et `.button.primary` pilotant la même propriété : le sélecteur
  `.button.primary` est prioritaire sur les éléments qui lui correspondent.
- Changement d'identifiant : notification dans l'interface, événement et entrée
  dans la liste des changements avec Full XPath, ancienne et nouvelle valeur ;
  l'application hôte peut conserver ou réappliquer la modification.
- Export avec `.button` et `#button-2` : conserver deux objets et leurs changements
  indépendants ; inclure cadence/durée et respecter les priorités à la lecture.
- Sauvegarde/réouverture du document de travail : retrouver les clés et courbes
  originales, sans les remplacer par toutes les images calculées pour l'export.
- Ajout/suppression d'un point de dégradé à une image : préserver les autres points
  et leurs animations ; aucun fondu ou état précédent n'est ajouté implicitement.
- Demande de MotionTween incompatible : expliquer la propriété/plage concernée et
  la cause, sans présenter une simple limitation d'export comme une impossibilité générale.
- Création d'un MotionTween : désactiver le bouton pour plus de deux clés ou pour
  une sélection de plusieurs lignes de propriété ; un avertissement non bloquant
  n'empêche pas une création valide.
- Exiger exactement deux clés sur une même ligne : zéro ou une seule clé ne permet
  pas de créer un MotionTween.
- Geste X/Y ou largeur/hauteur : créer/modifier chaque clé et émettre chaque changement,
  puis annuler/rétablir tout le geste en une seule opération d'historique.
- Modification rendant un MotionTween invalide : refuser le changement avec une
  explication, sans supprimer automatiquement la transition existante.
- Animation valide mais non reproductible fidèlement en CSS : refuser l'export CSS
  avec un diagnostic, proposer JavaScript ou JSON et permettre la sauvegarde éditable.
- Déplacement du pivot seul : conserver la position visuelle de l'élément.
- Modification via le Designer : créer/modifier la clé à l'image courante ; les
  valeurs de base externes ne sont pas modifiées, y compris lors d'une édition au début.
- Numérotation conservée de 1 à N ; une première modification à 50 ne crée pas
  implicitement de clé à 1. Hors cas 59, les images antérieures suivent 41A ; le cas
  59 suit sa règle dédiée. Ne pas étendre l'exception aux objets génériques.
- Historique commun : annuler dans l'ordre inverse des actions provenant des
  différents contrôles, avec une seule entrée pour un geste multi-propriétés.

Cette liste sera mise à jour au fil des décisions. Aucun de ces points n'autorise
à commencer leur implémentation ni à fusionner une PR vers `main`.
