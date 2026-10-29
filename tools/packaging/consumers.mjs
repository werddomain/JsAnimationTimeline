// tools/packaging/consumers.mjs : Verify packed npm and NuGet packages without contacting registries.
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const npmCli = process.env.npm_execpath;
assert.ok(npmCli, 'Run via npm run test:packaging -- <nupkg>');
const nupkg = resolve(process.argv[2] ?? 'artifacts/release-preparation/JsTimeline.Blazor.1.0.0.nupkg');
assert.ok(existsSync(nupkg), `NuGet package missing: ${nupkg}`);
const dependencySource = resolve(process.env.PACKAGING_NUGET_SOURCE ?? join(homedir(), '.nuget', 'packages'));
assert.ok(existsSync(dependencySource), `Offline NuGet dependency source missing: ${dependencySource}`);
const temp = mkdtempSync(join(tmpdir(), 'jstimeline-package-check-'));

function run(command, args, cwd, env = {}) {
  const result = spawnSync(command, args, { cwd, env: { ...process.env, ...env }, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`${command} failed (${result.status}):\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
function write(path, content) { writeFileSync(join(temp, path), content); }
function xml(value) { return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;'); }

try {
  const env = { npm_config_cache: join(temp, 'npm-cache'), npm_config_offline: 'true' };
  const names = ['runtime', 'editor', 'export-css'];
  const packed = JSON.parse(run(process.execPath, [npmCli, 'pack', ...names.flatMap(n => ['--workspace', `packages/${n}`]), '--pack-destination', temp, '--ignore-scripts', '--json'], root, env));
  assert.equal(packed.length, 3);
  for (const name of names) {
    const pkg = packed.find(item => item.name === `@werddomain/timeline-${name}`);
    assert.ok(pkg, `Missing ${name} archive`);
    for (const path of ['LICENSE', `dist/timeline-${name}.mjs`, `dist/timeline-${name}.umd.js`, 'dist/types/index.d.ts', ...(name === 'editor' ? ['dist/timeline-editor.css'] : [])]) {
      assert.ok(pkg.files.some(file => file.path === path), `${pkg.name}: ${path} missing`);
    }
  }
  write('package.json', '{"private":true,"type":"module"}\n');
  run(process.execPath, [npmCli, 'install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', ...packed.map(item => join(temp, item.filename))], temp, env);
  for (const name of names) assert.deepEqual(readFileSync(join(temp, 'node_modules', '@werddomain', `timeline-${name}`, 'LICENSE')), readFileSync(join(root, 'LICENSE')));
  write('consumer.mjs', `import { createRequire } from 'node:module';\nimport { createEmptyDocument } from '@werddomain/timeline-editor';\nimport { exportCss } from '@werddomain/timeline-export-css';\nimport { validateDocument } from '@werddomain/timeline-runtime';\nimport assert from 'node:assert/strict';\nfor (const fn of [createEmptyDocument, exportCss, validateDocument]) assert.equal(typeof fn, 'function');\nconst require = createRequire(import.meta.url);\nfor (const name of ['runtime', 'editor', 'export-css']) assert.ok(Object.keys(require('@werddomain/timeline-' + name)).length);\nassert.ok(require.resolve('@werddomain/timeline-editor/timeline-editor.css'));\n`);
  run(process.execPath, ['consumer.mjs'], temp);
  write('consumer.ts', `import { createEmptyDocument } from '@werddomain/timeline-editor';\nimport { exportCss } from '@werddomain/timeline-export-css';\nimport { validateDocument } from '@werddomain/timeline-runtime';\nexportCss(createEmptyDocument());\nvalidateDocument(createEmptyDocument());\n`);
  run(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '--noEmit', '--strict', '--module', 'esnext', '--moduleResolution', 'bundler', '--target', 'es2020', 'consumer.ts'], temp);
  console.log('npm: three archives, license, ESM, CommonJS, CSS and TypeScript OK');

  mkdirSync(join(temp, 'nuget-feed'));
  copyFileSync(nupkg, join(temp, 'nuget-feed', basename(nupkg)));
  write('NuGet.Config', `<configuration><packageSources><clear/><add key="local" value="${xml(join(temp, 'nuget-feed'))}"/><add key="dependencies" value="${xml(dependencySource)}"/></packageSources><packageSourceMapping><packageSource key="local"><package pattern="JsTimeline.Blazor"/></packageSource><packageSource key="dependencies"><package pattern="*"/></packageSource></packageSourceMapping></configuration>`);
  write('Consumer.csproj', '<Project Sdk="Microsoft.NET.Sdk.Web"><PropertyGroup><TargetFramework>net8.0</TargetFramework><DefaultItemExcludes>$(DefaultItemExcludes);nuget-cache/**;node_modules/**</DefaultItemExcludes></PropertyGroup><ItemGroup><PackageReference Include="JsTimeline.Blazor" Version="1.0.0" /></ItemGroup></Project>');
  write('Program.cs', 'using JsTimeline.Blazor.Model;\nusing Microsoft.AspNetCore.Builder;\nvar app = WebApplication.CreateBuilder(args).Build();\napp.MapGet("/", () => typeof(TimelineDocument).FullName);\napp.Run();\n');
  run('dotnet', ['restore', 'Consumer.csproj', '--configfile', 'NuGet.Config', '--packages', join(temp, 'nuget-cache'), '--no-cache'], temp);
  run('dotnet', ['build', 'Consumer.csproj', '--no-restore'], temp);
  const manifest = JSON.parse(readFileSync(join(temp, 'obj/Debug/net8.0/staticwebassets.build.json'), 'utf8'));
  for (const path of ['js/timeline-runtime.mjs', 'js/timeline-editor.mjs', 'css/timeline-editor.css', 'Player/TimelinePlayer.razor.js', 'Editor/TimelineEditor.razor.js']) {
    assert.ok(manifest.Assets.some(asset => asset.SourceId === 'JsTimeline.Blazor' && asset.RelativePath === path && asset.ContentRoot.startsWith(join(temp, 'nuget-cache'))), `NuGet asset missing: ${path}`);
  }
  console.log('NuGet: local package, C# consumer and static assets OK');
} finally {
  rmSync(temp, { recursive: true, force: true });
}
