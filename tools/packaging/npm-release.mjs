// tools/packaging/npm-release.mjs : Validate release metadata and safely resume npm publications.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const names = ['runtime', 'editor', 'export-css'];
const repository = 'https://github.com/Kazo-ca/JsAnimationTimeline.git';
const versionPattern = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/;

export function releasePlan(tag, packages) {
  assert.ok(tag.startsWith('v.'), 'Expected v.MAJOR.MINOR.PATCH tag');
  const version = tag.slice(2);
  assert.match(version, versionPattern, 'Invalid release version');
  return names.map(name => {
    const pkg = packages[name];
    assert.equal(pkg.name, `@kazo-ca/timeline-${name}`);
    assert.equal(pkg.version, version);
    assert.notEqual(pkg.private, true);
    assert.equal(pkg.repository?.url, repository);
    if (name !== 'runtime') assert.equal(pkg.dependencies?.['@kazo-ca/timeline-runtime'], version);
    return { name: pkg.name, version, archive: `kazo-ca-timeline-${name}-${version}.tgz` };
  });
}

export function publicationDecision(status, metadata, expectedIntegrity) {
  if (status === 404) return 'publish';
  assert.equal(status, 200, `Unexpected registry response: ${status}`);
  assert.equal(metadata?.dist?.integrity, expectedIntegrity, 'Existing package bytes differ; refusing publication');
  return 'skip';
}

async function main() {
  const [command, tag, name, archive] = process.argv.slice(2);
  const packages = Object.fromEntries(names.map(key => [key,
    JSON.parse(readFileSync(`packages/${key}/package.json`, 'utf8'))]));
  const plan = releasePlan(tag, packages);
  if (command === 'validate') return;
  assert.equal(command, 'publish', 'Expected validate or publish');
  const item = plan.find(entry => entry.name === name);
  assert.ok(item, 'Unknown package');
  assert.equal(archive, `artifacts/npm/${item.archive}`, 'Unexpected archive path');
  const integrity = `sha512-${createHash('sha512').update(readFileSync(archive)).digest('base64')}`;
  const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}/${item.version}`);
  const metadata = response.status === 200 ? await response.json() : null;
  if (publicationDecision(response.status, metadata, integrity) === 'skip') {
    process.stdout.write(`${name}@${item.version} is already published with identical bytes.\n`);
    return;
  }
  const result = spawnSync('npm', ['publish', archive, '--access', 'public', '--ignore-scripts'], { stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `Publishing ${name} failed`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
