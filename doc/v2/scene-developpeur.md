# Timeline sans HTML : scène fournie par le développeur

## Ce qui change

La partie du haut (barre d'outils, calques, règle, grille, images clés, interpolations) ne dépend plus de ce qu'elle anime. L'éditeur n'a jamais eu de zone de scène à lui : par défaut, il anime les éléments HTML de la page du développeur (sous `root`). Désormais, le développeur peut brancher n'importe quelle autre scène à la place. Les objets animés vivent dans une **scène** (`IStage`). Le développeur peut fournir la sienne (canvas, three.js, SVG, audio, servomoteurs, état Blazor) ou n'en fournir aucune. La timeline tient le temps avec un `Transport` sans DOM. Elle calcule les valeurs de chaque calque à l'image N avec l'évaluation déjà fusionnée (R2), puis les passe à la scène. La scène HTML actuelle (Web Animations) devient une scène parmi d'autres et reste celle par défaut : `createEditor(el, { data })` et `createPlayer(doc, { root })` gardent le même comportement. Le JSON gagne une deuxième forme de cible, `{ "ref": "hero", "stage": "canvas" }`. Une propriété peut aussi être un simple nombre sans nom CSS (`kind: 'value'`). Les documents existants restent valides.

## Utiliser la timeline avec sa propre scène

### Le contrat (runtime, sans type DOM)

```ts
// packages/runtime/src/stage/types.ts
export interface ITransportTime { timeMs: number; frame: number /* fractionnaire */; integerFrame: number }
export interface IStageLayerState<T = unknown> {
  layerId: string; target: LayerTarget; object: T; values: PropertyValues; spanId?: string;
  active: boolean;        // false sur une plage vide (blank)
  editorVisible: boolean; // œil du calque dans l'éditeur, toujours true dans le lecteur
}
export interface ITargetInfo {
  target: LayerTarget; label: string; icon?: string; group?: string;
  properties?: readonly (string | { name: string; label?: string; unit?: string })[]; // affichage par objet
}
// IStageLayer<T> = un calque et son objet résolu ; IStageContext = registre de propriétés et rapport d'erreurs.
export interface IStage<T = unknown> {
  readonly id: string;                                 // unique : 'html', 'canvas', 'audio'...
  readonly properties?: readonly PropertyDescriptor[]; // ajoutées au registre de l'éditeur ou du lecteur
  readonly targets?: { list(): readonly ITargetInfo[]; describe?(t: LayerTarget): ITargetInfo | undefined;
                       pick?(signal?: AbortSignal): Promise<LayerTarget | null>; subscribe?(onChange: () => void): () => void };
  accepts(target: LayerTarget): boolean;
  resolve(target: LayerTarget): T | null;              // null : calque dans missingTargets
  attach?(ctx: IStageContext): void;                   // une seule fois
  update?(doc: ITimelineDocument, layers: readonly IStageLayer<T>[]): void; // à chaque document
  sync?(time: ITransportTime, s: { playing: boolean; speed: number }): void; // play, pause, seek, vitesse, boucle
  render?(time: ITransportTime, states: readonly IStageLayerState<T>[]): void; // à chaque image
  release?(layerId: string, object: T): void;          // cible changée ou calque supprimé
  detach?(): void;                                     // fin ; l'objet reste au développeur
}
```

Une scène implémente `sync`, `render` ou les deux, mais au moins un des deux (sinon erreur à la création). `sync` sert à démarrer, arrêter ou repositionner un média. `render` est appelé une fois par image et par scène, avec tous ses calques : c'est là qu'on regroupe le dessin. Une exception de la scène part dans `onListenerError` (la première par scène et par calque, puis plus rien jusqu'au prochain document), et la lecture continue.

### Cycle de vie (écrit dans R7, testé avec une fausse scène)

1. `attach` est appelé une fois.
2. À chaque document (premier chargement, `update(doc)`, annuler/rétablir), le cœur compare les calques par id et par cible.
3. Pour un calque supprimé ou dont la cible a changé : `release(layerId, ancienObjet)`, puis un nouveau `resolve`.
4. `resolve` est mis en cache. Un échec est retenu et réessayé quand `targets.subscribe` signale un changement, ou sur `player.refreshTargets(layerId?)` / `editor.refreshTargets()`. Cela couvre un modèle GLTF chargé plus tard ou une entité créée à l'image 200.
5. `resolve` n'est jamais appelé à chaque image.
6. Ensuite `update(doc, calquesLiés)`, puis `sync` et/ou `render` de l'image courante. Fin : `release` de chaque calque, puis `detach`.

### Routage entre plusieurs scènes

- Si la cible a un `stage`, seule la scène de cet id est consultée. Un id inconnu est signalé `unknown-stage`.
- Sans `stage`, le calque va à la première scène du tableau dont `accepts` renvoie true. Si `resolve` renvoie null, on ne passe pas à la suivante.
- Deux scènes avec le même id : erreur à la création.
- Un calque qu'aucune scène n'accepte est signalé `unrouted` (dans `stage:report` et `missingTargets`).
- `refStage('canvas')` accepte `{ ref, stage: 'canvas' }`. `refStage('canvas', { unscoped: true })` prend aussi les `{ ref }` sans `stage`. La scène HTML ne prend jamais un `{ ref }` sans `stage`, elle ne vole donc pas les refs des autres.

### Exemple canvas (aide `createObjectStage`, tâche R8)

```ts
const canvasStage = createObjectStage<Sprite>({
  id: 'canvas', unscoped: true,
  properties: [{ name: 'frameIndex', kind: 'value', label: 'Image du sprite', defaultValue: 0, min: 0, interpolate: floorInterpolator }],
  objects: [{ id: 'hero', label: 'Héros', icon: 'sprite', object: heroSprite, properties: ['x', 'y', 'rotation', 'frameIndex'] }],
  apply(sprite, values, state) {
    sprite.visible = state.active && state.editorVisible;
    sprite.x = values.x; sprite.y = values.y; sprite.angle = values.rotation; sprite.frame = values.frameIndex;
  },
  reset(sprite) { sprite.restoreInitial(); }, // facultatif ; sinon apply reçoit les valeurs par défaut
  endFrame() { drawScene(ctx2d); }            // un seul dessin par image
});
createEditor(document.querySelector('#timeline')!, { data, stage: canvasStage });
```

Si le jeu a déjà sa propre boucle de dessin, on prend l'horloge manuelle (`advance` juste avant le dessin) et on omet `endFrame`. `floorInterpolator` fait défiler les images 0 à 11. `stepInterpolator` garderait la valeur de départ jusqu'à l'image clé suivante. `x`, `y` et `rotation` sont les propriétés intégrées, reçues comme de simples nombres.

### Exemple non visuel (audio ; même principe pour un servomoteur)

```ts
const audioStage: IStage<{ el: HTMLAudioElement; gain: GainNode }> = {
  id: 'audio',
  properties: [{ name: 'volume', kind: 'value', label: 'Volume', defaultValue: 1, min: 0, max: 1 }],
  targets: { list: () => [{ target: { ref: 'music', stage: 'audio' }, label: 'Musique' }] },
  accepts: refStage('audio'),
  resolve: t => (isRefTarget(t) ? tracks.get(t.ref) ?? null : null),
  sync(time, { playing }) { for (const m of tracks.values()) { m.el.currentTime = time.timeMs / 1000; playing ? m.el.play() : m.el.pause(); } },
  render(_t, states) { for (const s of states) s.object.gain.gain.setTargetAtTime(s.active ? s.values.volume : 0, audioCtx.currentTime, 0.02); }
};
```

`setTargetAtTime` évite les clics. Comme `requestAnimationFrame` s'arrête dans un onglet caché, une scène audio peut fournir son propre `IPlayerClock` basé sur `AudioContext.currentTime`.

### Sans scène (mode tiré) et horloge externe

```ts
const editor = createEditor(el, { data, stage: false, registry: myRegistry });
editor.onFrame(sample => robot.send(sample.layers.map(l => ({ ref: isRefTarget(l.target) ? l.target.ref : undefined, values: l.values }))));
const s = editor.sample(12); // calques dans l'ordre du document, s.layer(id)

const clock = createManualClock();                  // un IPlayerClock ordinaire
const player = createPlayer(doc, { stage: canvasStage, clock });
gameLoop(deltaMs => clock.advance(deltaMs));        // en millisecondes
```

`onFrame` est appelé une fois par image rendue. `seek` et `update` appliquent l'image tout de suite, quelle que soit l'horloge. Donner `root` et `stage` ensemble est une erreur.

## HTML reste le défaut

- `createHtmlStage({ root, mode, exclude, refs })` reprend le code actuel (`targets.ts`, `keyframes.ts`, `buildAnimations`, `syncAnimations`, `cancelAnimations`).
- Mode `'waapi'` (défaut du lecteur) : Web Animations, comme aujourd'hui. Mode `'frame'` (défaut de l'éditeur) : styles en ligne écrits par le même `computeCssDeclarations`. Cela évite de reconstruire les animations à chaque commande pendant un glisser.
- Sauvegarde des styles **par élément** avec un compteur : deux calques sur le même élément ne s'effacent pas. Ce cas est signalé `duplicate-target`.
- Parité testée **aux images entières** (images clés calculées contre le mode `frame`). Entre deux images, un calque échantillonné peut différer en mode `waapi`, parce que le navigateur interpole en ligne droite. L'écart est documenté.
- L'éditeur passe son propre conteneur dans `exclude` : un sélecteur comme `div` ne touche jamais la timeline, et `targets.list()` ne la propose pas. Un test le vérifie.
- Un sélecteur invalide part dans `missingTargets` au lieu de lever une erreur.
- SVG : la scène HTML anime les éléments SVG par le CSS (`transform`, `opacity`, `stroke-dashoffset`...). Pour des attributs comme `cx` ou `r`, on écrit une petite scène avec `createObjectStage` et sa propre fonction `resolve`.
- Remplacement de la cible `{ element }` dans l'éditeur : `{ ref: 'logo', stage: 'html' }`, résolu par `data-timeline-target="logo"` ou par `createHtmlStage({ refs: { logo: el } })` / `stage.bind('logo', el)`. Blazor peut y passer un `ElementReference`.
- `EditorOptions.root` reste comme raccourci de la racine de la scène HTML par défaut.

## Format JSON

```json
"RefTarget": { "type": "object", "additionalProperties": false, "required": ["ref"],
  "properties": { "ref": { "type": "string", "minLength": 1 }, "stage": { "type": "string", "minLength": 1 } } },
"target": { "oneOf": [ { "$ref": "#/$defs/SelectorTarget" }, { "$ref": "#/$defs/RefTarget" } ] }
```

```json
{ "id": "l-hero", "type": "layer", "name": "Héros", "target": { "ref": "hero", "stage": "canvas" },
  "spans": [ { "id": "s1", "start": 1, "end": 48, "kind": "tween",
    "tracks": { "x": [ { "frame": 1, "value": 0 }, { "frame": 48, "value": 320 } ],
                "frameIndex": [ { "frame": 1, "value": 0 }, { "frame": 48, "value": 11 } ] } } ] }
```

- Les formes se distinguent par leur clé (`selector`, `ref`, et `element` à l'exécution seulement). Toute future forme aura sa propre clé obligatoire. Le contrôle de forme exige exactement une clé.
- Noms de propriétés : on garde le motif strict du schéma, `^[a-zA-Z][a-zA-Z0-9]*$`, et on aligne le registre dessus. `constructor` et `prototype` sont refusés partout. Raison : un fichier importé ne doit pas pouvoir créer une piste `__proto__`.
- La version reste `2.0.0` : le changement est additif et la v2 n'est pas publiée.
- `validateDocument` gagne le contrôle de forme écrit à la main : version, fps entier de 1 à 240, totalFrames entier ≥ 1, nœuds, cibles, noms, valeurs finies. L'option `allowLiveTargets` vaut **true par défaut**, donc le lecteur ne change pas. Le Store (C6) et S2 passent `false`. Un test compare ajv et ce contrôle sur les mêmes fichiers.

## Propriétés qui ne sont pas du CSS

- `PropertyKind` devient `'transform' | 'style' | 'value'`. Une propriété `value` n'a pas de `cssName`. Son `unit` sert seulement à l'affichage.
- On ajoute `label` et `group`. Interpolateurs prêts à l'emploi : `stepInterpolator`, `floorInterpolator`, `roundInterpolator`, regroupés dans une table `interpolators` (`linear`, `step`, `floor`, `round`) que Blazor réutilise par nom.
- Les contrôles CSS et l'unicité de `cssName` ne concernent que `transform` et `style`. `computeCssDeclarations` ignore `value`. `keyframes.ts` décide de l'échantillonnage avec les seules pistes CSS.
- `evaluateLayer` et `evaluateDocument` reçoivent l'option `unknownProperties: 'throw' | 'skip'`. `'throw'` reste le défaut. Avec `'skip'`, seule la piste inconnue est retirée et signalée (`unknown-property`), le calque continue de s'animer.
- Le registre est construit avant le Store et figé ensuite : clone de `options.registry ?? defaultPropertyRegistry`, plus les `properties` de chaque scène. Un conflit de nom lève une erreur claire. Les noms sont partagés par toutes les scènes combinées : quand le sens diffère, on préfixe (`meshRotationX`). Libellé et unité par objet passent par `ITargetInfo.properties`.
- Valeurs numériques seulement en v2.0. Une couleur se découpe en `colorR`, `colorG`, `colorB`.

## Lecture et aperçu sans HTML

- Le code de temps de `Player.ts` va dans `transport/`, avec une seule fonction temps vers image (`frame = 1 + t * fps / 1000`, plus la règle actuelle pour l'image entière). `IPlayer` est étendu de façon additive : option `stage`, événement `tick` (image fractionnaire), `refreshTargets`, `warnings`.
- Éditeur : `ctx.playback` et `ctx.registry` remplacent `ctx.root` (C6). `ctx.stage` arrive en C7. Événements : `playhead:changed`, `frame:render`, `playback:play|pause|loop|complete`, `stage:report` (seulement les avertissements nouveaux par rapport au document précédent) et `stage:targetsChanged` (la liste `ctx.stage.missingTargets` a changé : document, `refreshTargets` ou `targets.subscribe` d'une scène ; le `StageHost` le signale par son option `onTargetsChanged`).
- Glisser la tête de lecture appelle `ctx.playback.seek(n)` : les calques sont évalués, puis la scène reçoit `sync` et/ou `render`. Pas besoin de `getComputedStyle`.
- Pendant un glisser, les `seek` et les modifications sont regroupés : une seule évaluation et un seul `render` par image d'affichage (C6). `sample(n)` reste synchrone.
- Le Store refuse les cibles vivantes `{ element }`, parce que `freezeDocument` gèlerait un nœud DOM ou un objet three.js. Un nom de piste inconnu donne un avertissement, ou un refus avec `strictProperties`.
- On évalue seulement les calques liés à une scène `render`, avec un cache d'index de plages par calque. Un test de performance est ajouté.
- Une scène n'est jamais un slot, et l'éditeur ne détruit jamais une scène fournie par le développeur.

## Export CSS et Blazor

- **X1** : outil pour la scène HTML. Avant d'évaluer, il copie le calque en gardant seulement les pistes `transform`/`style` connues, ce qui fonctionne avant F06. Le reste est sauté avec un avertissement (`unsupported-target`, `non-css-property`, `unknown-property`), sans jamais échouer. Test avec un calque mixte.
- **B1** : modèle C# généré au build depuis le schéma. `LayerTarget { Selector?, Ref?, Stage? }`, avec `JsonIgnoreCondition.WhenWritingNull` et un test aller-retour contre le schéma.
- **B3** : paramètre `Stage` = `Html` (défaut), `JsModule("./js/maScene.js")` pour 60 images/s, `DotNet(ITimelineStage)` ou `None`. Le contrat C# `ITimelineStage` (`Targets`, `Properties` avec interpolation par nom, `RenderAsync`) est écrit à la main. Il reçoit un état compact (`layerId`, `target`, `values`, `active`), un seul appel à la fois, et c'est la dernière image qui gagne. `FrameCallbackMode` : `Off`, `IntegerFrames` (défaut), `EveryTick`.
- **B2** `TimelinePlayer` reste HTML.

## Impact sur ce qui est déjà fusionné

| Tâche | Changement |
|---|---|
| F05 | `RefTarget`, `oneOf`, contrôle de forme, `isRefTarget`. Documents existants valides. |
| R1 | Type `value`, `label`, `group`, interpolateurs. Registre limité au motif strict (rien n'utilise `_` ou `$`). |
| R2 | Option `unknownProperties`, défaut inchangé. |
| R3 | Code déplacé dans `transport/` et `stage/html/`. Suite conservée, sauf trois tests changés volontairement : sélecteur invalide (`Player.test.ts:107-109`) et les deux tests de retour arrière (`:364-383`), qui utiliseront une autre panne (`Element.animate` absent sur une cible). |
| C3 | Refus des cibles vivantes, avertissement sur les noms inconnus. |
| C4 | `ctx.root` retiré (lu seulement par des tests). |
| R4, R5, C1, C2 | Aucun changement. |

## Changements du plan

Six nouvelles tâches (54 → 60), regroupées dans une **phase 2b** avec son propre point de validation : je t'enverrai un bilan avec la démo canvas + audio de R8. F06, R6, R7, C6 et C7 sont des **Contrat** (règle 4).

| ID | Vague | Tâche | Dépend de |
|---|---|---|---|
| F06 | 4 | Contrat : cible `ref`, propriétés `value`, interpolateurs, motif des noms, `unknownProperties`, contrôle de forme | F05, R1, R2 |
| R6 | 5 | Contrat : `Transport` sans DOM, `tick`, `createManualClock` | R3 |
| R7 | 6 | Contrat : `IStage`, cycle de vie, routage, `createHtmlStage` (waapi/frame) | R6, F06 |
| C6 | 6 | Contrat : lecture et registre dans l'éditeur, `sample`/`onFrame`, Store | C4, R6, F06 |
| C7 | 7 | Contrat : scène dans l'éditeur (`stage`, `ctx.stage`, `stage:report`) | C6, R7 |
| R8 | 7 | `createObjectStage` + page de démo canvas/audio dans `demo/runtime` + Playwright 11b | R7, R5 |

Tâches modifiées : L2 (+C6, vague 7), L3 (8), T4 (9), P1 (+C6, vague 7), P2 (C7 + L2, vague 8), Y4 (+C7, F06, vague 8), W1 (+C6), W2 et S1 (+C7), E1 (+C7, R8), B3 (+C7), D1 (+R8), S2 et B1 (+F06, pour partir du schéma amendé). I2 limite les raccourcis au conteneur de l'éditeur, avec une option pour y ajouter l'élément de la scène.

- E1 reste à la vague 10, mais la chaîne R3 → R6 → C6 → L2 → L3 → T4 → E1 a la même longueur que le chemin critique. R6, C6, L2, L3 et T4 n'ont donc plus aucune marge : on les traite en priorité.
- Démarrent tout de suite : L1, K1 et I2 (déjà lancées), puis X1, F06 et R6. S2 et B1 suivent dès que F06 est fusionnée.
- Le rapport reçoit un amendement daté des décisions 2, 5 (« élément → ref liée à l'exécution »), 8, 15 et 16.

## Choix faits par défaut

- Cibles distinguées par leur clé, `stage` facultatif, version 2.0.0.
- Motif strict des noms gardé dans le schéma, registre aligné dessus.
- HTML par défaut : mode `frame` dans l'éditeur, `waapi` en production, conteneur de l'éditeur toujours exclu.
- `allowLiveTargets` vaut true par défaut. Le Store et S2 passent false.
- Horloge manuelle fournie sous forme de `IPlayerClock` (`createManualClock`). `clock` ne change pas de type.
- Pistes inconnues : retirées et signalées dans le lecteur et X1, avertissement dans le Store.
