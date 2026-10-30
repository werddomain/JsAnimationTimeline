<!-- doc/v2/todo/ha4-validation.md -->
# HA4 — Cibles et propriétés HTML

30 octobre 2026. Branche `v2/HA4-html-target-resolution`, base `2f5295d`.
Contrat consommé : HA-TL-001 r2. HA3 et HA4 terminent la phase B ; la phase C
reste soumise à la validation utilisateur de cette phase.

## Résultat

La scène HTML résout les groupes par élément et destination CSS, inspecte leurs
bases sources et expose leurs capacités à l'éditeur. Elle applique les priorités
de sélecteurs, le cas 59 et les décisions explicites des conflits non couverts.
Le contexte HTML est sérialisable séparément du document temporel générique.

Les couleurs, unités, composantes de transformation 2D et composantes de dégradé
ont des bindings explicites. Les points de dégradé gardent leur identité ; les
modifications et suppressions sont validées collectivement. Une piste importée
invalide reste réparable. Les bases divergentes d'un groupe sont signalées, sans
empêcher les modifications explicites d'une propriété commune dont seul le rendu
est surchargé par une cible spécifique.

La capture prend la valeur réellement affichée. Les commandes relisent les
capacités, refusent sans mutation et gardent undo/redo. L'aperçu restaure les
styles sources et leurs priorités ; les callbacks imbriqués ne contaminent pas
la base avec les valeurs d'animation.

API et limites : `doc/integration/timeline-ha4-api.md`.
Démo conservée : `demo/editor/html-properties.html`.
Schéma séparé : `schema/html-animation-context.schema.json`.

## Preuves et revues ECC

Planner et guide TDD ECC natifs exécutés avant implémentation. Les revues natives
générale, TypeScript et sécurité ne trouvent plus de constat bloquant après les
correctifs et relectures. La dernière relecture générale et TypeScript vérifie
21 tests ciblés, notamment suppression de dernière clé, réparation et undo/redo.
La revue sécurité a vérifié les frontières JSON, clés de prototype, décisions
enregistrées et callbacks ; les dictionnaires détachés sont sans prototype.

Les tests conservent les régressions trouvées : styles résiduels en entrant dans
un conflit, capture différente de la courbe locale, propriété CSS entière non
interpolable, gradient rendu invalide par plusieurs pistes ou par une suppression,
et inspection imbriquée pendant une modification des styles sources.

Playwright a reproduit un aperçu ignoré face à une classe `!important` (opacité
attendue 0,5, obtenue 1), puis vérifié sa correction et sa restauration. La démo
dispose de huit parcours UI réutilisables : groupes, capture, bases divergentes,
transformations, dégradés, refus d'interpolation, résolution et sauvegarde.

Le contrôle final a aussi reproduit deux erreurs TS2345 avec le cache habituel
de ts-jest dans les tests du bridge Blazor. Le consommateur `keyframeDrag.ts`
importe maintenant explicitement l'augmentation de type `layers:rowsChanged`.
Une compilation isolée avec retrait virtuel de cet import reproduit l'erreur ;
les mêmes suites passent avec l'import et sans purge du cache.

Aucune revue C# dans ce lot : aucun fichier C# ni modèle temporel générique n'est
modifié. La compatibilité .NET et les ressources Blazor sont vérifiées ci-dessous.
La revue sécurité rapporte zéro vulnérabilité de production ; les 15 alertes de
développement préexistantes restent inchangées, sans modification de dépendance.

## Vérification finale

- Cinq dossiers dist vérifiés et nettoyés, `npm ci` réussi, lockfile inchangé.
- `npm run lint` : zéro erreur ; `npm run typecheck` réussi.
- `npm test` : **3 782 tests / 246 suites** réussis : runtime 1 101,
  éditeur 2 481, export CSS 88, conventions 63, bridge JavaScript 49.
- `npm run build` et `npm run build:demo` réussis.
- `CI=1 npm run test:e2e -- -- --workers=2` : **185 tests** réussis,
  sans nouvelle tentative ; dernier passage 46,2 secondes.
- Playwright Blazor : **6 tests** ; sample Blazor : **3 tests**, tous réussis.
- `dotnet build dotnet/JsTimeline.sln -c Release` : **0 avertissement, 0 erreur**.
- `dotnet test ... -c Release --no-build` : **180 tests** réussis.
- Trois archives npm et pack NuGet locaux réussis ; consommateurs ESM/CommonJS,
  CSS, TypeScript Bundler/NodeNext, C# et ressources statiques vérifiés.

Ports : 9401/9402 (éditeur/runtime), 9403/9404 (Blazor), `CI=1` et cache Chromium
local du dépôt. Commandes ordinaires, sans UltraCode.
Archives : `%TEMP%/JsTimeline-HA4-artifacts-20261030`.

Les modes modernes utilisent le rendu exact par image, y compris si WAAPI est
demandé ; `effectiveMode` l'indique. Le Designer fournit la structure initiale
des dégradés. Les sorties modernes JSON/JavaScript/CSS restent HA5/HA6.
Aucun tag, aucune publication et aucune fusion vers `main`.
