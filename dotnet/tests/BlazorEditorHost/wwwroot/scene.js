// dotnet/tests/BlazorEditorHost/wwwroot/scene.js
export function createStage() {
  document.querySelector('[data-testid="module-stage"]').textContent = 'created';
  return { id: 'module', accepts: () => false, resolve: () => null, render() {} };
}
