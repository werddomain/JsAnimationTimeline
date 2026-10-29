// tools/packaging/metadata.test.mjs : Verify the release package contract without publishing.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

for (const name of ['runtime', 'editor', 'export-css']) {
  test(`${name} has consistent public release metadata`, () => {
    const pkg = JSON.parse(readFileSync(`packages/${name}/package.json`, 'utf8'));
    assert.equal(pkg.version, '1.0.0');
    assert.notEqual(pkg.private, true);
    assert.equal(pkg.license, 'MIT');
    assert.equal(pkg.exports['.'].types, './dist/types/index.d.ts');
    if (name !== 'runtime') assert.equal(pkg.dependencies['@werddomain/timeline-runtime'], '1.0.0');
  });
}
test('NuGet release version matches npm', () => {
  assert.match(readFileSync('dotnet/JsTimeline.Blazor/JsTimeline.Blazor.csproj', 'utf8'), /<Version>1\.0\.0<\/Version>/);
});
