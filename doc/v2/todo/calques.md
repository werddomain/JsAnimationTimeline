# Calques (phase 3, Y0–Y8) — reste à faire

État au 2026-10-24 : Y0 à Y8 et toutes leurs suites (#25, #30, #37, #38, #45, #47, #51, #52, #57, #64, #65, #66, #75, #83, #90) sont fusionnés dans `v2/base`. Seul le travail ci-dessous reste ouvert.

## En cours (branche `v2/layers-window-blur`, non fusionnée, pas de PR)

Suite mineure de la revue de #90 : un changement de fenêtre ou d'onglet (Alt+Tab, Cmd+Tab) pendant un renommage envoie un `blur` sans destinataire alors que la ligne est encore affichée ; depuis #90 c'est compté comme un départ, donc la ligne perd sa place dans le parcours au clavier (seulement si le nom a changé).

- Fait : `blurLeaves` (`packages/editor/src/plugins/layers/selection/LayerSelectionPlugin.ts`) ne compte pas comme départ un `blur` sans destinataire quand `document.hasFocus()` est faux ; JSDoc mise à jour ; nouveau test « keeps the row focusable after a window or tab switch commits the rename » (`rename/__tests__/RenamePlugin.test.ts`).
- **À faire** : le test existant « treats a blur with no destination … (click into an iframe) » échoue maintenant, car jsdom renvoie `hasFocus() === false`. Y ajouter `jest.spyOn(document, 'hasFocus').mockReturnValue(true);` avant `input.blur()` (un vrai clic dans une iframe garde le focus du document), puis relancer tsc, jest, eslint, tools/conventions et la vérification complète (e2e avec `CI=1`), faire la revue ECC (ecc:typescript-reviewer) et ouvrir la PR vers `v2/base`.

## Pas à cette série

- **Y4** (`layers.target`, choix de la cible proposé par la scène) : attend C7 ; non commencé.

## Points connus, non bloquants (acceptés ou documentés)

- Dégroupage d'un dossier replié mais visible : deux `layers:selectionChanged` possibles (le cas d'un dossier visible et déplié n'en émet qu'un).
- `touch-action: none` sur les lignes (glisser tactile) bloque le défilement au doigt sur la liste (molette, barre et clavier fonctionnent) ; documenté dans `LayerReorder.less`.
- Pas de défilement automatique pendant un glisser-déposer près du bord de la liste.
- Ctrl+Alt+↑/↓ (déplacement au clavier) : sortir d'un dossier puis entrer dans le dossier vide suivant se fait en deux appuis.
- `Mod+Alt+L` (nouveau calque) peut entrer en conflit avec AltGr+L sur certaines dispositions Windows (actif seulement avec le focus dans la liste).
