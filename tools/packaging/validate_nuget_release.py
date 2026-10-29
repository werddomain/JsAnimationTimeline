# tools/packaging/validate_nuget_release.py: Validate a tagged commit and its NuGet package offline.
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

TAG = re.compile(r'v\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)', re.ASCII)
PACKAGE_ID = 'JsTimeline.Blazor'
WORKFLOW = '.github/workflows/publish-nuget.yml'

def git(*args):
    return subprocess.run(['git', *args], check=True, capture_output=True, text=True).stdout.strip()

def validate(tag, commit, project, package=None):
    match = TAG.fullmatch(tag)
    if not match:
        raise ValueError('Invalid release tag; expected v.MAJOR.MINOR.PATCH')
    version = '.'.join(match.groups())
    commit_sha = git('rev-parse', '--verify', f'{commit}^{{commit}}')
    if git('rev-parse', '--verify', f'refs/tags/{tag}^{{commit}}') != commit_sha:
        raise ValueError('Tag does not resolve to the checked out commit')
    subprocess.run(['git', 'merge-base', '--is-ancestor', commit_sha, 'refs/remotes/origin/main'], check=True)
    git('cat-file', '-e', f'{commit_sha}:{WORKFLOW}')
    tree = ET.parse(project)
    if tree.findall('.//PackageId') == [] or [e.text for e in tree.findall('.//PackageId')] != [PACKAGE_ID]:
        raise ValueError('Unexpected project package ID')
    if [e.text for e in tree.findall('.//Version')] != [version]:
        raise ValueError('Tag and project versions differ')
    if package is None:
        return
    path = Path(package)
    if path.name != f'{PACKAGE_ID}.{version}.nupkg':
        raise ValueError('Unexpected package filename')
    with zipfile.ZipFile(path) as archive:
        specs = [name for name in archive.namelist() if name.endswith('.nuspec')]
        if specs != [f'{PACKAGE_ID}.nuspec']:
            raise ValueError('Unexpected package manifest')
        manifest = ET.fromstring(archive.read(specs[0]))
        metadata = next((e for e in manifest if e.tag.split('}')[-1] == 'metadata'), None)
        fields = {} if metadata is None else {e.tag.split('}')[-1]: e.text for e in metadata}
        if fields.get('id') != PACKAGE_ID or fields.get('version') != version:
            raise ValueError('Unexpected package metadata')

if __name__ == '__main__':
    try:
        if len(sys.argv) not in (4, 5):
            raise ValueError('Usage: validate_nuget_release.py TAG COMMIT PROJECT [PACKAGE]')
        validate(*sys.argv[1:])
    except (ValueError, OSError, ET.ParseError, zipfile.BadZipFile, subprocess.CalledProcessError) as error:
        print(f'Release validation failed: {error}', file=sys.stderr)
        sys.exit(1)
