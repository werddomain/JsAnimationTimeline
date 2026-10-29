// tools/packaging/metadata.mjs : Validate npm and NuGet package metadata independently.
import assert from 'node:assert/strict';

const versionPattern = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/;

export function projectVersion(project) {
  const matches = [...project.matchAll(/<Version>([^<]*)<\/Version>/g)];
  assert.equal(matches.length, 1, 'Expected exactly one project version');
  assert.match(matches[0][1], versionPattern, 'Invalid NuGet version');
  assert.match(project, /<PackageId>JsTimeline\.Blazor<\/PackageId>/);
  return matches[0][1];
}

export function validateMetadata(packages, project) {
  projectVersion(project);
  const version = packages.runtime.version;
  assert.match(version, versionPattern, 'Invalid npm version');
  for (const name of ['runtime', 'editor', 'export-css']) {
    const pkg = packages[name];
    assert.equal(pkg.name, `@werddomain/timeline-${name}`);
    assert.equal(pkg.version, version);
    assert.notEqual(pkg.private, true);
    assert.equal(pkg.license, 'MIT');
    assert.equal(pkg.exports['.'].types, './dist/types/index.d.ts');
    if (name !== 'runtime') assert.equal(pkg.dependencies['@werddomain/timeline-runtime'], version);
  }
}
