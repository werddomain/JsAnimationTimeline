<!-- demo/editor/README.md -->
# Démo de l’éditeur v2

Depuis la racine : `npm run build:demo --workspace demo/editor`, puis `npm run preview:demo --workspace demo/editor`. La page principale anime deux éléments HTML et ajoute le panneau optionnel de propriétés. « Votre scène » compare une scène canvas/audio fournie à l’éditeur avec le mode `stage: false`, qui utilise `onFrame` et `sample`. Le son ne démarre qu’après « Activer le son ».

Le serveur utilise `E2E_V2_EDITOR_PORT` (9002 par défaut). Les ports historiques `E2E_EDITOR_PORT` et `E2E_RUNTIME_PORT` restent réservés aux autres démos. Exemple PowerShell pour les tests isolés :

```powershell
$env:E2E_EDITOR_PORT='19300'; $env:E2E_RUNTIME_PORT='19301'; $env:E2E_V2_EDITOR_PORT='19302'
npm run build:demo
npx playwright test editor/editor-demo.spec.ts demo/demo-renders.spec.ts runtime --config e2e/playwright.config.ts
```

Les tests couvrent les interactions de la timeline et leur historique, le rendu HTML et les valeurs reçues par le canvas et l’audio dans les deux modes. Les scénarios complémentaires des plugins restent disponibles dans `e2e/validation/`.
