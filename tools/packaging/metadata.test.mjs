// tools/packaging/metadata.test.mjs : Verify the release package contract without publishing.
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { validateMetadata } from './metadata.mjs';
import './metadata-contract.test.mjs';

test('repository npm and NuGet metadata are consistent', () => {
  const packages = Object.fromEntries(['runtime', 'editor', 'export-css'].map(name => [name,
    JSON.parse(readFileSync(`packages/${name}/package.json`, 'utf8'))]));
  validateMetadata(packages, readFileSync('dotnet/JsTimeline.Blazor/JsTimeline.Blazor.csproj', 'utf8'));
});
