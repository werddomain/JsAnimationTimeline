# Y4 (layers.target) : reste à faire

Branche : `v2/Y4-followups-2`. PR #92 ouverte vers `v2/base`, pas encore fusionnée (gate local vert, revue ECC approuvée).

## À faire
- Attendre la revue de l'intégrateur sur la PR #92 et corriger dans cette même branche si besoin.
- Note LOW de la revue ECC : le message d'état d'un choix sur la scène refusé ou en échec est perdu quand une reconstruction différée est rejouée (`onPickEnd`).
- Tests optionnels : le drapeau `edited` sur deux reconstructions de suite, et chaque chemin de fin de choix (null, abandon, échec, refus).

## Points connus
- La fenêtre ne se reconstruit pas pendant un choix sur la scène ; elle le fait à la fin du choix s'il n'a rien appliqué.
