

# **Spécification Technique pour un Contrôle de Timeline de Type Flash MX**

Ce document fournit une spécification technique et visuelle exhaustive pour la création d'un contrôle d'interface utilisateur (UI) de timeline en JavaScript/TypeScript. L'objectif est de reproduire avec une haute fidélité les fonctionnalités et le design du panneau de la timeline de Macromedia Flash MX. La spécification est destinée aux ingénieurs logiciels et se concentre exclusivement sur le contrôle de la timeline, en omettant les autres aspects de l'application Flash.

## **Section 1 : Architecture Visuelle et Anatomie des Composants**

La conception visuelle de la timeline de Flash MX est fondée sur un principe fondamental : la séparation de la gestion verticale des objets (calques) et de la gestion horizontale du temps (images). Cette architecture garantit que l'utilisateur conserve toujours son contexte, peu importe comment il navigue dans une animation complexe. La structure est composée de trois régions principales et interconnectées : le panneau des calques, la règle temporelle et la grille de la timeline.

### **1.1. La Disposition Composite : Une Structure en Trois Parties**

Le contrôle est une composition de trois régions distinctes qui fonctionnent de concert pour offrir une expérience d'édition cohérente.1

* **Panneau des Calques (Gauche) :** Un panneau à orientation verticale et à largeur fixe, positionné sur le côté gauche. Il contient la liste de tous les calques et dossiers de calques, ainsi que leurs contrôles d'état respectifs. Ce panneau est conçu pour ne pas défiler horizontalement, assurant que les noms des calques et les contrôles restent toujours visibles lorsque l'utilisateur navigue dans le temps.1  
* **Règle Temporelle (Haut) :** Un panneau à orientation horizontale et à hauteur fixe, situé en haut du contrôle. Il affiche les numéros d'images et les graduations temporelles. De même, ce panneau ne défile pas verticalement, garantissant que la référence temporelle est toujours visible lors du défilement de la liste des calques.2  
* **Grille de la Timeline (Zone Principale) :** C'est la zone interactive principale où les images, les images clés et les interpolations sont affichées et manipulées. Elle est structurée comme une grille où les lignes correspondent aux calques du panneau de gauche et les colonnes correspondent aux numéros d'images de la règle temporelle.4 Cette grille est la seule région qui défile à la fois horizontalement et verticalement, de manière synchronisée avec la règle temporelle et le panneau des calques, respectivement.

Cette séparation délibérée des panneaux fixes (calques et règle) de la grille de contenu défilante est la décision architecturale la plus critique. Elle résout le problème fondamental de la perte de contexte dans les éditeurs de grille bidimensionnels. Un utilisateur qui fait défiler des centaines d'images horizontalement ne perd jamais de vue le calque qu'il est en train de modifier. De même, en faisant défiler une longue liste de calques verticalement, la référence au numéro d'image actuel reste ancrée en haut de l'écran. Ce comportement est la cause première des exigences de défilement spécifiques et doit être le principal guide pour la mise en page de l'interface utilisateur.

### **1.2. Le Panneau des Calques : Hiérarchie des Objets et Contrôles d'État**

Chaque ligne du panneau des calques représente un objet unique, qu'il s'agisse d'un calque ou d'un dossier, et expose une série de contrôles iconiques pour gérer son état.1

* **Nom du Calque/Dossier :** Une étiquette de texte qui peut être modifiée, généralement par un double-clic, pour permettre à l'utilisateur de nommer ses calques de manière descriptive.5 Le calque actuellement actif est mis en évidence visuellement, souvent avec une couleur de fond distincte et une icône de crayon, pour indiquer où les prochaines opérations d'édition auront lieu.1  
* **Contrôles de Dossier :** Les dossiers permettent d'organiser les calques de manière hiérarchique, ce qui est essentiel pour gérer la complexité des projets d'animation importants.5 Chaque dossier doit être rendu avec un bouton de basculement (par exemple, une icône de triangle ou de chevron) pour afficher ou masquer ses calques enfants.  
* **Bascule de Visibilité (Icône d'Œil) :** Une icône, typiquement un œil, qui permet de basculer la visibilité de tout le contenu d'un calque pendant l'édition. Un état caché est clairement indiqué par un changement d'icône, comme un 'X' rouge, pour informer l'utilisateur que le contenu du calque est masqué.1 Une icône maîtresse dans l'en-tête de la colonne permet de basculer la visibilité de tous les calques simultanément.1  
* **Bascule de Verrouillage (Icône de Cadenas) :** Une icône, généralement un cadenas, qui empêche toute modification du contenu d'un calque. L'état verrouillé est indiqué visuellement (par exemple, un cadenas fermé).5 Tout comme pour la visibilité, une icône maîtresse dans l'en-tête de la colonne permet de verrouiller ou déverrouiller tous les calques en une seule fois.1

L'état de ces bascules (visibilité, verrouillage) doit avoir des conséquences fonctionnelles directes sur la grille de la timeline. Un état "verrouillé" ne se contente pas de changer une icône ; il doit désactiver toutes les interactions de la souris (sélection, glisser-déposer, etc.) sur la ligne correspondante dans la grille. De même, un état "caché" devrait altérer visuellement le rendu des images de cette ligne (par exemple, en les estompant) pour fournir un retour visuel clair. Cela implique la nécessité d'un système de gestion d'état centralisé où l'état d'un objet calque influence directement les propriétés et la gestion des événements de ses composants UI correspondants dans la grille.

### **1.3. La Règle Temporelle : Navigation Temporelle**

La règle temporelle fournit le cadre de référence horizontal pour l'animation, représentant le temps sous forme d'images discrètes.2

* Elle affiche les numéros d'images de manière séquentielle, avec des étiquettes numériques placées à des intervalles réguliers (par exemple, toutes les 5 images) pour une meilleure lisibilité.1 De fines graduations marquent chaque image individuelle.  
* **La Tête de Lecture :** Un marqueur visuel proéminent, traditionnellement un rectangle rouge avec une ligne verticale qui s'étend à travers tous les calques, indiquant l'image actuellement active et affichée.2 La tête de lecture est un élément interactif clé : l'utilisateur peut cliquer et la faire glisser horizontalement ("scrubbing") pour naviguer rapidement dans l'animation et prévisualiser le mouvement en temps réel.5  
* **Informations d'État :** Généralement situées sous la règle, des zones de texte affichent des informations contextuelles importantes : le numéro de l'image actuelle, la fréquence d'images (FPS \- Frames Per Second) de l'animation, et le temps écoulé correspondant.9

### **1.4. La Grille de la Timeline : Un Glossaire Visuel des Images et des Séquences**

Le langage visuel de la grille de la timeline communique l'état et la fonction de chaque segment de temps. Chaque type d'image a une apparence distincte pour transmettre son rôle dans l'animation.

* **Images Vides :** Représentées par de simples rectangles blancs ou gris clair avec une bordure discrète. Elles signifient une absence de contenu sur ce calque à ce moment précis.1  
* **Images Standard (Séquence d'Images Statiques) :** Une séquence continue de rectangles remplis de gris qui suit une image clé. Cela indique que le contenu de l'image clé précédente persiste sans changement pendant toute cette durée.11 La fin d'une telle séquence est marquée par un rectangle creux.11  
* **Image Clé :** Une image qui marque un changement défini par l'utilisateur dans le contenu de l'animation. Elle est représentée visuellement par un cercle plein (noir ou gris) à l'intérieur du rectangle de l'image.12  
* **Image Clé Vide :** Une image clé qui ne contient explicitement aucun contenu, utilisée pour marquer un point où un objet est retiré de la scène. Elle est représentée par un cercle creux à l'intérieur du rectangle de l'image.13  
* **Séquence d'Interpolation de Mouvement :** La série d'images entre deux images clés où le logiciel génère automatiquement l'animation intermédiaire. Cette séquence est visuellement distincte, généralement avec un fond bleu clair et une flèche horizontale pleine pointant de l'image clé de début à celle de fin, symbolisant le flux du mouvement.1

Le rendu de la grille de la timeline est intrinsèquement contextuel. L'apparence d'une image donnée n'est pas déterminée uniquement par ses propres données, mais par sa relation avec ses voisines. Un simple rectangle gris n'a de sens que parce qu'il suit une image clé. Une séquence bleue avec une flèche n'existe que parce qu'elle se trouve *entre* deux images clés désignées comme une interpolation. Par conséquent, la logique de rendu pour une image N donnée doit interroger l'état de l'image N-1 et les propriétés de la séquence à laquelle elle appartient. Une simple boucle qui rend chaque image de manière isolée serait insuffisante ; l'algorithme doit être conscient de l'état de la séquence entière pour déterminer l'apparence correcte de chaque image.

## **Section 2 : Fonctionnalités de Gestion des Calques et des Objets**

Cette section détaille les flux de travail de l'utilisateur et les comportements du système pour la gestion de la liste hiérarchique d'objets (calques et dossiers) dans le panneau des calques.

### **2.1. Opérations de Base sur les Calques**

Le contrôle doit fournir un ensemble complet d'opérations pour manipuler la structure des calques.

* **Ajout d'un Calque/Dossier :** L'utilisateur peut créer de nouveaux calques ou dossiers en cliquant sur des icônes dédiées (par exemple, une page ou une icône de dossier) situées généralement en bas du panneau des calques.1 Un nouvel élément est inséré au-dessus du calque ou du dossier actuellement sélectionné.1  
* **Suppression d'un Calque/Dossier :** Un calque ou un dossier sélectionné peut être supprimé soit en cliquant sur une icône de corbeille, soit via une option dans le menu contextuel du clic droit.1 La suppression d'un dossier doit entraîner la suppression de tous les calques qu'il contient.  
* **Renommage d'un Calque/Dossier :** Un double-clic sur le nom d'un calque ou d'un dossier transforme l'étiquette de texte statique en un champ de saisie modifiable, permettant un renommage intuitif.5  
* **Réorganisation des Calques/Dossiers :** L'ordre de superposition visuel des éléments est directement contrôlé par l'ordre des calques dans le panneau. Les utilisateurs peuvent faire glisser et déposer des calques et des dossiers pour les réorganiser, ce qui affecte directement leur ordre de rendu (Z-index).5

### **2.2. Contrôle de l'État des Calques (Impact Fonctionnel)**

Les bascules de visibilité et de verrouillage sont plus que de simples indicateurs visuels ; elles modifient le comportement de l'ensemble du contrôle.

* **Basculement de la Visibilité :** Lorsque la visibilité d'un calque est désactivée, tous les éléments de sa ligne correspondante dans la grille de la timeline (images, images clés, interpolations) doivent être visuellement atténués (par exemple, estompés ou affichés en mode contour). C'est une aide visuelle cruciale à l'édition qui permet à l'utilisateur de se concentrer sur des parties spécifiques de l'animation.5  
* **Basculement du Verrouillage :** Lorsqu'un calque est verrouillé, tous les éléments de sa ligne correspondante dans la grille doivent devenir non interactifs. Cela signifie que la sélection d'images clés, le déplacement de séquences ou la création de nouvelles images clés sur ce calque doivent être désactivés.5 Le curseur de la souris doit changer d'apparence (par exemple, en une icône d'interdiction) lorsqu'il survole cette ligne pour indiquer son état non modifiable.

### **2.3. Organisation Hiérarchique (Dossiers)**

La capacité à grouper des calques dans des dossiers est une fonctionnalité essentielle pour la gestion de projets complexes.

* Les utilisateurs peuvent organiser leur timeline en faisant glisser des calques dans un dossier.5  
* L'icône de développement/réduction d'un dossier permet d'afficher ou de masquer ses calques enfants dans le panneau des calques.  
* Lorsqu'un dossier est réduit, non seulement ses calques enfants sont masqués dans la liste, mais les lignes correspondantes dans la grille de la timeline doivent également être masquées, ce qui réduit l'espace vertical qu'elles occupent et simplifie la vue.

L'introduction de dossiers impose une contrainte fondamentale sur le modèle de données sous-jacent. Une simple liste (ou tableau) de calques est insuffisante pour représenter une telle hiérarchie. La structure de données doit être arborescente. Chaque élément de la liste doit avoir des propriétés telles que id, nom, type: ('calque'|'dossier'), et un tableau enfants: \[...\]. Cette décision a des implications importantes pour le format de sérialisation (Section 7\) et la logique de rendu, qui doit maintenant être capable de parcourir récursivement la hiérarchie des calques. De plus, la logique de glisser-déposer doit être suffisamment sophistiquée pour gérer le déplacement d'éléments *dans*, *hors de*, et *entre* les dossiers.

## **Section 3 : Flux de Travail pour les Images, Images Clés et Interpolations**

Cette section définit les mécanismes d'interaction fondamentaux de la grille de la timeline, en se concentrant sur la manière dont les utilisateurs créent et manipulent les éléments qui définissent une animation.

### **3.1. Manipulation des Images Clés**

Les images clés sont les piliers de l'animation, marquant les moments de changement.

* **Insérer une Image Clé (F6) :** Crée une image clé à l'image sélectionnée, en dupliquant le contenu de l'image clé précédente. C'est la méthode principale pour définir un nouveau point de changement dans l'animation.12  
* **Insérer une Image Clé Vide (F7) :** Crée une image clé vide à l'image sélectionnée. Ceci est utilisé pour retirer explicitement du contenu à un moment donné.14  
* **Insérer une Image (F5) / Supprimer une Image (Maj+F5) :** Ajoute ou supprime du temps à la timeline en insérant ou en supprimant des images standard (grises). Cela prolonge ou raccourcit la durée du contenu de l'image clé précédente sans créer un nouveau point de changement.14  
* **Déplacement des Images Clés/Séquences :** Les utilisateurs peuvent cliquer et faire glisser une image clé ou une séquence entière d'images vers une nouvelle position dans le temps, soit sur le même calque, soit sur un calque différent.3

### **3.2. Modèles de Sélection par l'Utilisateur**

Le contrôle doit prendre en charge plusieurs modes de sélection pour permettre des modifications efficaces.

* **Sélection Unique :** Un simple clic sur une image clé ou une image la sélectionne.  
* **Sélection d'une Plage Continue :** Un clic sur une image suivi d'un Maj-clic sur une autre image sélectionne toutes les images entre les deux.  
* **Sélection Multiple Non Contiguë d'Images Clés (Ctrl-Clic) :** Une exigence clé est la capacité de sélectionner plusieurs images clés distinctes. L'utilisateur doit pouvoir maintenir la touche CTRL enfoncée et cliquer sur des images clés individuelles. L'interface doit fournir un retour visuel clair pour chaque image clé sélectionnée (par exemple, une couleur de surbrillance ou une bordure distincte).

La prise en charge de la sélection non contiguë représente un défi technique notable. L'état de l'application doit conserver un tableau des identifiants des images clés sélectionnées, plutôt qu'une simple paire d'indices de début et de fin. Toutes les actions ultérieures, en particulier le remplissage du menu contextuel et la commande "Créer une interpolation de mouvement", doivent opérer sur ce tableau d'éléments sélectionnés. Par exemple, lorsque l'utilisateur effectue un clic droit, le code qui génère le menu contextuel doit vérifier la longueur du tableau des sélections. Si elle est exactement de deux, l'option "Créer une interpolation de mouvement" doit être activée. Cela démontre comment une fonctionnalité apparemment simple nécessite un gestionnaire d'état de sélection personnalisé et une logique de génération de menu dynamique.

### **3.3. Implémentation de l'Interpolation de Mouvement**

Le flux de travail pour créer une interpolation de mouvement doit suivre la méthode spécifiée.

* **Flux de Travail :**  
  1. L'utilisateur crée une image clé à un instant de début (par exemple, l'image 1).  
  2. L'utilisateur crée une seconde image clé à un instant de fin (par exemple, l'image 20).  
  3. L'utilisateur sélectionne la première image clé, puis, tout en maintenant la touche CTRL enfoncée, clique sur la seconde image clé. Les deux sont maintenant dans un état sélectionné.  
  4. L'utilisateur fait un clic droit sur l'une des images clés sélectionnées pour ouvrir le menu contextuel.  
  5. L'utilisateur sélectionne "Créer une interpolation de mouvement" dans le menu.  
* **Réponse du Système :** Le système valide qu'exactement deux images clés sont sélectionnées sur le même calque. Il convertit alors toute la séquence d'images entre elles en une séquence d'interpolation de mouvement, changeant la couleur de fond en bleu et ajoutant la flèche caractéristique.1 Les propriétés de l'interpolation sont alors associées à cette séquence dans le modèle de données.

Il est à noter que bien que d'autres flux de travail existent (comme créer l'interpolation sur la première image clé puis déplacer l'objet à la dernière image) 15, la méthode de sélection de deux images clés spécifiée doit être l'implémentation principale.

## **Section 4 : Navigation, Lecture et Défilement**

Cette section détaille les mécanismes de déplacement dans la timeline, que ce soit manuellement ou via une lecture automatisée, et spécifie le comportement précis du défilement.

### **4.1. Gestion de la Fenêtre d'Affichage et Défilement**

Le comportement du défilement est un aspect fondamental de l'utilisabilité du contrôle.

* **Défilement Horizontal :** Une barre de défilement horizontale sera présente en bas de la grille de la timeline. La manipulation de cette barre de défilement fera défiler la grille de la timeline et la règle temporelle horizontalement en parfaite synchronisation. Le panneau des calques à gauche restera complètement statique et fixe.  
* **Défilement Vertical :** Une barre de défilement verticale sera présente sur le bord droit du contrôle. La manipulation de cette barre de défilement fera défiler la grille de la timeline et le panneau des calques verticalement en parfaite synchronisation. La règle temporelle en haut restera complètement statique et fixe.

Ce comportement de défilement spécifique peut être réalisé efficacement avec les technologies web modernes. Une approche consiste à utiliser une grille CSS pour la disposition globale. Le conteneur de la grille de la timeline serait le seul élément avec overflow: scroll. Un écouteur d'événements JavaScript onScroll sur ce conteneur lirait alors ses propriétés scrollTop et scrollLeft et appliquerait des transformations CSS (transform: translate(...)) ou ajusterait les positions de défilement du panneau des calques et de la règle temporelle pour les maintenir synchronisés. Une autre approche, potentiellement plus performante, serait d'utiliser position: sticky pour la règle temporelle et pour une colonne dédiée au panneau des calques, laissant le navigateur gérer le positionnement de manière native.

### **4.2. Moteur de Lecture et Contrôles**

Le contrôle doit inclure des boutons d'interface utilisateur pour "Lecture", "Pause" et "Retour au début".

* **Lecture :** Déclenche l'avancement automatique de la tête de lecture à la fréquence d'images (FPS) spécifiée. Une boucle de minuterie interne (idéalement, requestAnimationFrame pour des performances fluides) gérera cette progression.  
* **Pause :** Arrête l'avancement automatique de la tête de lecture.  
* **Retour au Début :** Déplace immédiatement la tête de lecture à l'image 1\.  
* **Raccourcis Clavier :** Pour imiter le comportement original de Flash, la touche Entrée doit basculer entre Lecture et Pause.1 Les touches , (virgule) et . (point) peuvent être utilisées pour avancer ou reculer d'une seule image, respectivement.1

### **4.3. Navigation Temporelle Directe (Scrubbing)**

Comme décrit dans la section 1.3, l'utilisateur peut cliquer et faire glisser la tête de lecture dans la règle temporelle. Pendant cette opération de glissement, le contrôle doit continuellement mettre à jour l'image actuelle et déclencher l'événement onTimeSeek en temps réel. Cela permet à l'application parente de mettre à jour son affichage (par exemple, un aperçu sur la scène) et de fournir un retour visuel instantané.

## **Section 5 : Menus Contextuels Sensibles au Contexte**

Cette section définit le contenu du menu contextuel du clic droit, qui doit s'adapter en fonction de l'élément de l'interface utilisateur sur lequel on clique. Elle inclut également l'adaptation demandée pour les appareils mobiles.

### **5.1. Spécification du Menu Contextuel pour Ordinateur**

Un menu contextuel dynamique est essentiel pour un flux de travail efficace. Le tableau suivant détaille les options de menu pour chaque cible possible.

| Cible du Clic Droit | Options du Menu |
| :---- | :---- |
| **Nom du Calque** | Insérer un calque, Insérer un dossier de calques, Afficher/Masquer les autres, Verrouiller les autres, Supprimer le calque, Renommer le calque, Propriétés... 1 |
| **Image Clé (Sélection unique)** | Insérer une image, Supprimer des images, Insérer une image clé, Insérer une image clé vide, Effacer l'image clé, Copier les images, Coller les images, Inverser les images, Actions... 13 |
| **Image Clé (Deux sélectionnées avec CTRL)** | Toutes les options de la sélection unique, plus Créer une interpolation de mouvement. |
| **Séquence d'Interpolation de Mouvement** | Supprimer l'interpolation, Copier les images, Coller les images, Sélectionner toutes les images. |
| **Zone d'Image Vide** | Insérer une image, Insérer une image clé, Insérer une image clé vide. |

### **5.2. Adaptation pour les Écrans Tactiles et Mobiles**

Pour garantir la parité fonctionnelle sur les appareils sans clic droit, une adaptation est nécessaire. Une icône "trois points" (...) sera affichée sur l'élément actuellement sélectionné (par exemple, à la fin d'une ligne de calque sélectionnée, ou superposée à une image clé sélectionnée). Taper sur cette icône ouvrira un menu modal ou une info-bulle contenant exactement les mêmes options contextuelles que le menu du clic droit sur ordinateur.

## **Section 6 : Modèle d'Événements et Spécification de l'API**

Cette section est cruciale pour le développeur qui utilisera le contrôle, car elle définit l'interface publique du composant. Elle détaille tous les événements que le contrôle émettra pour communiquer ses changements d'état et les interactions de l'utilisateur à l'application consommatrice.

### **6.1. Catalogue des Événements**

Le contrôle doit implémenter un système d'événements robuste pour permettre une intégration transparente. Le tableau suivant spécifie le nom de chaque événement, son déclencheur, les données qu'il transporte (payload), et si l'action peut être annulée par l'écouteur d'événements. La fourniture d'événements annulables, tels que onBeforeObjectDelete, est particulièrement importante. Elle permet à l'application hôte d'implémenter une logique de confirmation (par exemple, une boîte de dialogue "Êtes-vous sûr?") avant que des actions destructrices ne soient exécutées. La logique interne du contrôle pour un tel événement serait : let event \= new CustomEvent(...); dispatchEvent(event); if (\!event.defaultPrevented) { /\* procéder à la suppression \*/ }.

| Nom de l'Événement | Déclencheur | Données de la Charge Utile (Payload) | Annulable |
| :---- | :---- | :---- | :---- |
| onObjectAdd | Un nouveau calque ou dossier est créé. | { id: string, type: 'layer'|'folder', parentId: string|null } | Non |
| onBeforeObjectDelete | L'utilisateur initie la suppression d'un calque/dossier. | { ids: string } | Oui |
| onObjectDelete | Un calque ou un dossier a été supprimé. | { ids: string } | Non |
| onObjectRename | Le nom d'un calque ou d'un dossier est modifié. | { id: string, newName: string, oldName: string } | Non |
| onObjectReparent | Un calque est déplacé dans/hors d'un dossier. | { id: string, newParentId: string|null, oldParentId: string|null } | Non |
| onObjectReorder | L'ordre des calques est modifié. | { id: string, newIndex: number, oldIndex: number } | Non |
| onObjectVisibilityChange | La visibilité d'un calque est basculée. | { id: string, isVisible: boolean } | Non |
| onObjectLockChange | L'état de verrouillage d'un calque est basculé. | { id: string, isLocked: boolean } | Non |
| onKeyframeAdd | Une nouvelle image clé est ajoutée. | { id: string, layerId: string, frame: number, type: 'content'|'blank' } | Non |
| onBeforeKeyframeDelete | L'utilisateur initie la suppression d'image(s) clé(s). | { ids: string } | Oui |
| onKeyframeDelete | Une ou plusieurs images clés ont été supprimées. | { ids: string } | Non |
| onKeyframeMove | Une ou plusieurs images clés sont déplacées vers un nouveau temps. | { moves: \[{ id: string, newFrame: number, oldFrame: number }\] } | Non |
| onKeyframeSelect | L'utilisateur sélectionne une ou plusieurs images clés. | { selectedIds: string } | Non |
| onTweenAdd | Une interpolation de mouvement est créée. | { layerId: string, startFrame: number, endFrame: number, type: 'motion' } | Non |
| onTweenRemove | Une interpolation de mouvement est supprimée. | { layerId: string, startFrame: number, endFrame: number } | Non |
| onTimeSeek | La tête de lecture est déplacée manuellement. | { currentFrame: number } | Non |
| onPlaybackStart | La lecture commence. | { currentFrame: number } | Non |
| onPlaybackPause | La lecture est mise en pause. | { currentFrame: number } | Non |
| onFrameEnter | La tête de lecture entre dans une nouvelle image pendant la lecture. | { currentFrame: number, keyframeIdsOnFrame: string } | Non |

## **Section 7 : Persistance des Données et Sérialisation**

Cette section définit une structure de données claire pour représenter l'état complet de la timeline, permettant de la sauvegarder et de la charger.

### **7.1. Schéma de Données de la Timeline**

L'état complet du contrôle sera représenté par un seul objet JSON. Ce schéma est conçu pour une sérialisation et une désérialisation faciles via JSON.stringify et JSON.parse.

* **Objet Racine :**  
  * version: string (pour les futures migrations de schéma)  
  * settings: { fps: number, totalFrames: number }  
  * layers: Object (un tableau d'objets calque/dossier)  
* **Objet Calque/Dossier :**  
  * id: string (identifiant unique)  
  * name: string  
  * type: 'layer' ou 'folder'  
  * isVisible: boolean  
  * isLocked: boolean  
  * children: Object (uniquement pour les dossiers)  
  * keyframes: Keyframe (uniquement pour les calques)  
  * tweens: Tween (uniquement pour les calques)  
* **Objet Image Clé :**  
  * id: string (identifiant unique)  
  * frame: number (le numéro de l'image sur laquelle elle se trouve)  
  * type: 'content' ou 'blank'  
  * data: any (espace réservé pour les propriétés de l'objet associé)  
* **Objet Interpolation :**  
  * startFrame: number  
  * endFrame: number  
  * type: 'motion'  
  * properties: any (par exemple, les paramètres d'accélération)

### **7.2. Exemple de Sortie de Sérialisation**

Un exemple JSON complet mais concis est fourni ci-dessous pour illustrer le schéma en action. Il montre un dossier contenant un calque enfant, qui à son tour contient deux images clés avec une interpolation de mouvement entre elles. Cet exemple sert de cas de test concret pour le développeur.

JSON

{  
  "version": "1.0",  
  "settings": {  
    "fps": 24,  
    "totalFrames": 120  
  },  
  "layers":,  
          "tweens": \[  
            {  
              "startFrame": 1,  
              "endFrame": 30,  
              "type": "motion",  
              "properties": { "easing": "ease-in-out" }  
            }  
          \]  
        }  
      \]  
    },  
    {  
      "id": "layer\_2",  
      "name": "Arrière-plan",  
      "type": "layer",  
      "isVisible": true,  
      "isLocked": true,  
      "keyframes": \[  
        {  
          "id": "kf\_3",  
          "frame": 1,  
          "type": "content",  
          "data": { "assetId": "bg\_forest" }  
        }  
      \],  
      "tweens":  
    }  
  \]  
}

## **Conclusion**

Cette spécification technique fournit un plan directeur complet pour le développement d'un contrôle de timeline qui émule fidèlement le composant de Macromedia Flash MX. En adhérant à l'architecture visuelle, aux flux de travail fonctionnels, au modèle d'événements et au schéma de données décrits, une équipe de développement peut construire un composant robuste, intuitif et hautement fonctionnel. Les points clés à retenir pour l'implémentation sont la structure de mise en page en trois parties avec un défilement synchronisé, la nécessité d'un modèle de données hiérarchique pour prendre en charge les dossiers, et la mise en œuvre d'un gestionnaire de sélection personnalisé pour permettre la sélection non contiguë d'images clés, qui est une condition préalable au flux de travail de création d'interpolation spécifié. L'API d'événements définie garantit que le contrôle peut être intégré de manière transparente dans une application plus large, en fournissant les points d'ancrage nécessaires pour la logique métier et les mises à jour de l'interface utilisateur.

#### **Sources des citations**

1. The Timeline Window | Macromedia Flash8 Bible \- Flylib.com, consulté le octobre 26, 2025, [https://flylib.com/books/en/4.403.1.43/1/](https://flylib.com/books/en/4.403.1.43/1/)  
2. Using Macromedia Flash MX, consulté le octobre 26, 2025, [https://profspevack.com/archive/animation/tech\_support/using\_flash\_mx.1.pdf](https://profspevack.com/archive/animation/tech_support/using_flash_mx.1.pdf)  
3. How to use the Timeline in Animate \- Adobe Help Center, consulté le octobre 26, 2025, [https://helpx.adobe.com/animate/using/timeline.html](https://helpx.adobe.com/animate/using/timeline.html)  
4. Example 7: Timeline Editing, consulté le octobre 26, 2025, [http://www.w3.org/WAI/AU/2003/WD-ATAG20-20030722/example7.html](http://www.w3.org/WAI/AU/2003/WD-ATAG20-20030722/example7.html)  
5. The Timeline | Macromedia Flash MX 2004 Game Programming (Premier Press Game Development) \- Flylib.com, consulté le octobre 26, 2025, [https://flylib.com/books/en/4.70.1.26/1/](https://flylib.com/books/en/4.70.1.26/1/)  
6. Working with Layers in Flash \- GeeksforGeeks, consulté le octobre 26, 2025, [https://www.geeksforgeeks.org/computer-science-fundamentals/working-with-layers-in-flash/](https://www.geeksforgeeks.org/computer-science-fundamentals/working-with-layers-in-flash/)  
7. Introduction to Flash, consulté le octobre 26, 2025, [https://www.sfu.ca/\~tutor/techbytes/Flash/](https://www.sfu.ca/~tutor/techbytes/Flash/)  
8. Basic Flash Animation Tutorial \- YouTube, consulté le octobre 26, 2025, [https://www.youtube.com/watch?v=-hVg1yTJUZo](https://www.youtube.com/watch?v=-hVg1yTJUZo)  
9. Layers Guide for Macromedia Flash 8 (Animation Classroom) \- YouTube, consulté le octobre 26, 2025, [https://www.youtube.com/watch?v=98Dm17qxV\_8](https://www.youtube.com/watch?v=98Dm17qxV_8)  
10. Flash Interface \- Mystery Productions, consulté le octobre 26, 2025, [http://www.mystery-productions.com/flash/interface.html](http://www.mystery-productions.com/flash/interface.html)  
11. Macromedia Flash MX: A Brief Tutorial For "Programming Usable Interfaces" | PDF \- Scribd, consulté le octobre 26, 2025, [https://www.scribd.com/doc/140558258/Flash-Tutorial](https://www.scribd.com/doc/140558258/Flash-Tutorial)  
12. Macromedia Flash MX Key Concepts Tutorial Learn the basics of Flash animation, consulté le octobre 26, 2025, [https://www.openeye-training.com/downloads/FLASHkeyconcepts.pdf](https://www.openeye-training.com/downloads/FLASHkeyconcepts.pdf)  
13. How to use frames and keyframes in Animate \- Adobe Help Center, consulté le octobre 26, 2025, [https://helpx.adobe.com/animate/using/frames-keyframes.html](https://helpx.adobe.com/animate/using/frames-keyframes.html)  
14. Flash MX \- CustomGuide, consulté le octobre 26, 2025, [https://www.customguide.com/pdf/flashmac-quick-reference-mx.pdf](https://www.customguide.com/pdf/flashmac-quick-reference-mx.pdf)  
15. Macromedia Flash MX Tutorial: Part 1, consulté le octobre 26, 2025, [http://www.geocities.ws/duppyduppy138/MacromediaFlashMXTutorial.htm](http://www.geocities.ws/duppyduppy138/MacromediaFlashMXTutorial.htm)  
16. Learn to create motion tween and key frames in Flash \- YouTube, consulté le octobre 26, 2025, [https://www.youtube.com/watch?v=PDt4GmyNB78](https://www.youtube.com/watch?v=PDt4GmyNB78)  
17. Flash Quick Reference, Adobe Flash MX Cheat Sheet, consulté le octobre 26, 2025, [https://www.wpschools.org/cms/lib/NJ01001331/Centricity/Domain/9/flash-quick-reference-mx.pdf](https://www.wpschools.org/cms/lib/NJ01001331/Centricity/Domain/9/flash-quick-reference-mx.pdf)  
18. Using Flash, consulté le octobre 26, 2025, [http://ndl.ethernet.edu.et/bitstream/123456789/32217/1/21.pdf.pdf](http://ndl.ethernet.edu.et/bitstream/123456789/32217/1/21.pdf.pdf)  
19. Flash Motion Tween Overview, consulté le octobre 26, 2025, [http://gcctech.org/cmm/cmm21g/flash/flash%20motion%20tween.htm](http://gcctech.org/cmm/cmm21g/flash/flash%20motion%20tween.htm)