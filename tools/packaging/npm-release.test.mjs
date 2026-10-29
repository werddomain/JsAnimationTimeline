// tools/packaging/npm-release.test.mjs : Verify npm release validation and retry decisions.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { releasePlan, publicationDecision } from './npm-release.mjs';

const packages = Object.fromEntries(['runtime', 'editor', 'export-css'].map(name => [name, {
  name: `@kazo-ca/timeline-${name}`, version: '1.0.0', private: false,
  repository: { url: 'https://github.com/Kazo-ca/JsAnimationTimeline.git' },
  dependencies: name === 'runtime' ? {} : { '@kazo-ca/timeline-runtime': '1.0.0' },
}]));

test('accepts only matching canonical tag and ordered packages', () => {
  const plan = releasePlan('v.1.0.0', packages);
  assert.deepEqual(plan.map(entry => entry.name), ['@kazo-ca/timeline-runtime', '@kazo-ca/timeline-editor', '@kazo-ca/timeline-export-css']);
  for (const tag of ['v1.0.0', 'v.01.0.0', 'v.1.0.1', 'v.1.0.0-rc']) assert.throws(() => releasePlan(tag, packages));
});

test('rejects wrong package identity, private flag, dependency, and provenance', () => {
  for (const patch of [
    { name: '@other/timeline-editor' }, { private: true },
    { dependencies: { '@kazo-ca/timeline-runtime': '^1.0.0' } },
    { repository: { url: 'https://github.com/example/project.git' } },
  ]) assert.throws(() => releasePlan('v.1.0.0', { ...packages, editor: { ...packages.editor, ...patch } }));
});

test('retries skip only byte-identical registry packages and reject conflicts or registry errors', () => {
  assert.equal(publicationDecision(404, null, 'sha512-good'), 'publish');
  assert.equal(publicationDecision(200, { dist: { integrity: 'sha512-good' } }, 'sha512-good'), 'skip');
  assert.throws(() => publicationDecision(200, { dist: { integrity: 'sha512-other' } }, 'sha512-good'));
  for (const status of [401, 403, 429, 500]) assert.throws(() => publicationDecision(status, null, 'sha512-good'));
});

test('workflow publishes only validated archives in dependency order', async () => {
  const { readFileSync } = await import('node:fs');
  const workflow = readFileSync('.github/workflows/publish-npm.yml', 'utf8');
  assert.match(workflow, /git merge-base --is-ancestor HEAD origin\/main/);
  assert.match(workflow, /id-token: write/);
  assert.match(workflow, /sha256sum -c -/);
  const lines = workflow.split('\n').filter(line => line.includes('npm-release.mjs publish'));
  assert.equal(lines.length, 3);
  assert.match(lines[0], /@kazo-ca\/timeline-runtime/);
  assert.match(lines[1], /@kazo-ca\/timeline-editor/);
  assert.match(lines[2], /@kazo-ca\/timeline-export-css/);
  assert.doesNotMatch(workflow, /continue-on-error:\s*true/);
});
