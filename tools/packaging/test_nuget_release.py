# tools/packaging/test_nuget_release.py: Exercise release guards without network or publishing.
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[2]
GUARD = ROOT / 'tools/packaging/validate_nuget_release.py'

class ReleaseGuardTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.repo = Path(self.temp.name)
        self.git('init', '-q')
        self.git('config', 'user.email', 'test@example.invalid')
        self.git('config', 'user.name', 'Test')
        (self.repo / '.github/workflows').mkdir(parents=True)
        (self.repo / '.github/workflows/publish-nuget.yml').write_text('workflow')
        (self.repo / 'project.csproj').write_text('<Project><PropertyGroup><PackageId>JsTimeline.Blazor</PackageId><Version>1.3.0</Version></PropertyGroup></Project>')
        self.git('add', '.')
        self.git('commit', '-qm', 'main')
        self.git('update-ref', 'refs/remotes/origin/main', 'HEAD')
        self.git('tag', 'v.1.3.0')
        self.package = self.repo / 'JsTimeline.Blazor.1.3.0.nupkg'
        self.make_package('JsTimeline.Blazor', '1.3.0')

    def git(self, *args):
        return subprocess.run(['git', *args], cwd=self.repo, check=True, capture_output=True, text=True).stdout.strip()

    def make_package(self, package_id, version):
        with zipfile.ZipFile(self.package, 'w') as archive:
            archive.writestr('JsTimeline.Blazor.nuspec', f'<package><metadata><id>{package_id}</id><version>{version}</version></metadata></package>')

    def validate(self, tag='v.1.3.0', commit='HEAD'):
        return subprocess.run([sys.executable, str(GUARD), tag, commit, 'project.csproj', str(self.package)], cwd=self.repo, capture_output=True, text=True)

    def test_accepts_matching_package_on_main(self):
        self.assertEqual(self.validate().returncode, 0)

    def test_rejects_invalid_tags_and_mismatch(self):
        for tag in ['', 'v1.3.0', 'v.01.3.0', 'v.1.3', 'v.1.3.0-preview', 'v.1.3.1', 'v.1.3.0\n']:
            with self.subTest(tag=tag): self.assertNotEqual(self.validate(tag).returncode, 0)

    def test_accepts_annotated_tag(self):
        self.git('tag', '-d', 'v.1.3.0')
        self.git('tag', '-a', 'v.1.3.0', '-m', 'release')
        self.assertEqual(self.validate().returncode, 0)

    def test_digest_rejects_tampering(self):
        tool = ROOT / 'tools/packaging/package_digest.py'
        digest = subprocess.run([sys.executable, str(tool), str(self.package)], capture_output=True, text=True, check=True).stdout.strip()
        def verify():
            return subprocess.run([sys.executable, str(tool), str(self.package), digest], capture_output=True).returncode
        self.assertEqual(verify(), 0)
        with self.package.open('ab') as package: package.write(b'tampered')
        self.assertNotEqual(verify(), 0)

    def test_rejects_non_main_commit(self):
        (self.repo / 'other').write_text('other')
        self.git('add', 'other')
        self.git('commit', '-qm', 'other')
        self.git('tag', '-f', 'v.1.3.0')
        self.assertNotEqual(self.validate().returncode, 0)

    def test_rejects_wrong_package_metadata_and_name(self):
        for package_id, version in [('Other', '1.3.0'), ('JsTimeline.Blazor', '1.3.1')]:
            self.make_package(package_id, version)
            self.assertNotEqual(self.validate().returncode, 0)
        self.package.rename(self.repo / 'wrong.nupkg')
        self.package = self.repo / 'wrong.nupkg'
        self.assertNotEqual(self.validate().returncode, 0)

    def test_rejects_commit_without_workflow(self):
        self.git('rm', '-q', '.github/workflows/publish-nuget.yml')
        self.git('commit', '-qm', 'remove workflow')
        self.git('update-ref', 'refs/remotes/origin/main', 'HEAD')
        self.git('tag', '-f', 'v.1.3.0')
        self.assertNotEqual(self.validate().returncode, 0)



class WorkflowTests(unittest.TestCase):
    def test_publication_is_tag_only_and_gated_by_validation_job(self):
        workflow = (ROOT / '.github/workflows/publish-nuget.yml').read_text()
        self.assertIn("- 'v.*'", workflow)
        self.assertNotIn('workflow_dispatch:', workflow)
        self.assertIn('needs: prepare', workflow)
        self.assertIn('needs.prepare.outputs.package_sha256', workflow)
        self.assertLess(workflow.index('npm run test:packaging'), workflow.index('id: digest'))
        for line in workflow.splitlines():
            if 'uses:' in line:
                self.assertRegex(line, r'uses: [^@]+@[0-9a-f]{40}(?:\s|$)')
        self.assertLess(workflow.index('package_digest.py', workflow.index('  publish:')), workflow.index('NuGet/login@v1'))
        self.assertIn('environment: nuget-production', workflow)
        self.assertIn('fetch-depth: 0', workflow)
        self.assertIn('NuGet/login@v1', workflow)
        self.assertNotIn('npm publish', workflow)
        self.assertNotIn('--skip-duplicate', workflow)
        self.assertIn('dotnet nuget push "artifacts/nuget/JsTimeline.Blazor.${RELEASE_TAG#v.}.nupkg"', workflow)
        self.assertIn('dotnet/JsTimeline.Blazor/JsTimeline.Blazor.csproj "artifacts/nuget/JsTimeline.Blazor.${RELEASE_TAG#v.}.nupkg"', workflow)
        self.assertLess(workflow.index('validate_nuget_release.py'), workflow.index('NuGet/login@v1'))

    def test_required_checks_complete_before_authentication(self):
        workflow = (ROOT / '.github/workflows/publish-nuget.yml').read_text()
        prepare = workflow.split('  publish:', 1)[0]
        for command in ['npm run lint', 'npm run typecheck', 'npm test', 'npm run build\n',
                        'npm run build:demo', 'dotnet build dotnet/JsTimeline.sln -c Release',
                        'dotnet test dotnet/JsTimeline.sln -c Release', 'npm run test:e2e',
                        'e2e/blazor/playwright.config.ts', 'e2e/blazor-sample/playwright.config.ts',
                        'e2e/pages/playwright.config.ts', 'node tools/pages/build.mjs',
                        'npm run test:packaging', 'python3 -m unittest tools/packaging/test_nuget_release.py']:
            with self.subTest(command=command): self.assertIn(command, prepare)
        self.assertNotIn('id-token: write', prepare)
        self.assertNotIn('secrets.', prepare)
        for port in ['E2E_V2_EDITOR_PORT', 'E2E_RUNTIME_PORT', 'E2E_BLAZOR_PORT', 'E2E_BLAZOR_SAMPLE_PORT']:
            self.assertIn(port, prepare)

    def test_ci_runs_release_guard_tests(self):
        ci = (ROOT / '.github/workflows/ci.yml').read_text()
        self.assertIn('python3 -m unittest tools/packaging/test_nuget_release.py', ci)

if __name__ == '__main__': unittest.main()
