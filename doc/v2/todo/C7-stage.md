# C7 (scènes de l'éditeur) : reste à faire

Branche : `v2/C7-followups-4`. PR #93 ouverte vers `v2/base`, pas encore fusionnée (gate local vert, revue ECC approuvée).

## À faire
- Attendre la revue de l'intégrateur sur la PR #93 et corriger dans cette même branche si besoin.
- Note MEDIUM de la revue ECC, documentée mais non corrigée : les avertissements relevés pendant les nouvelles tentatives ou le retour arrière de `host.load` comptent comme relevés au chargement ; dans un cas rare, un avertissement peut être annoncé deux fois. Piste : distinguer le premier chargement des tentatives dans `EditorStageHost`.

## Points connus
- Le report des clés `afterLoad` dure jusqu'à un vrai passage complet (`sync` puis `render`, rattrapage d'une retenue compris).
