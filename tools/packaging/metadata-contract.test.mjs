// tools/packaging/metadata-contract.test.mjs : Check independent npm and NuGet release versions.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { validateMetadata } from './metadata.mjs';

const packages = Object.fromEntries(['runtime', 'editor', 'export-css'].map(name => [name, {
  name: `@werddomain/timeline-${name}`, version: '1.0.0', license: 'MIT',
  exports: { '.': { types: './dist/types/index.d.ts' } },
  dependencies: { '@werddomain/timeline-runtime': '1.0.0' },
}]));
const project = version => `<Project><PropertyGroup><PackageId>JsTimeline.Blazor</PackageId><Version>${version}</Version></PropertyGroup></Project>`;

test('allows a 1.3.0 NuGet version independently of npm 1.0.0', () => {
  assert.doesNotThrow(() => validateMetadata(packages, project('1.3.0')));
});
test('rejects invalid NuGet or npm versions and mismatched npm dependencies', () => {
  for (const version of ['1.3', '01.3.0', '1.3.0-preview', '']) {
    assert.throws(() => validateMetadata(packages, project(version)));
  }
  assert.throws(() => validateMetadata({ ...packages, runtime: { ...packages.runtime, version: '01.0.0' } }, project('1.3.0')));
  assert.throws(() => validateMetadata({ ...packages, editor: { ...packages.editor, version: '1.0.1' } }, project('1.3.0')));
  assert.throws(() => validateMetadata({ ...packages, editor: { ...packages.editor, dependencies: { '@werddomain/timeline-runtime': '^1.0.0' } } }, project('1.3.0')));
});
test('tag workflow checks metadata before OIDC', () => {
  const workflow = readFileSync('.github/workflows/publish-nuget.yml', 'utf8');
  assert.ok(workflow.indexOf('node --test tools/packaging/metadata.test.mjs') > -1);
  assert.ok(workflow.indexOf('node --test tools/packaging/metadata.test.mjs') < workflow.indexOf('NuGet/login@v1'));
});

test('CI and release preparation derive the NuGet package version from the project', () => {
  for (const name of ['ci.yml', 'release.yml']) {
    const workflow = readFileSync(`.github/workflows/${name}`, 'utf8');
    assert.match(workflow, /dotnet msbuild dotnet\/JsTimeline\.Blazor\/JsTimeline\.Blazor\.csproj -getProperty:Version/);
    assert.match(workflow, /JsTimeline\.Blazor\.\$\{version\}\.nupkg/);
    assert.doesNotMatch(workflow, /JsTimeline\.Blazor\.1\.0\.0\.nupkg/);
  }
});
