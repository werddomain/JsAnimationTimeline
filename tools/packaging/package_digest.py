# tools/packaging/package_digest.py: Calculate or verify the SHA-256 of one package.
import hashlib
import hmac
from pathlib import Path
import re
import sys

def digest(path):
    with Path(path).open('rb') as package:
        return hashlib.file_digest(package, 'sha256').hexdigest()

if __name__ == '__main__':
    try:
        if len(sys.argv) not in (2, 3):
            raise ValueError('Usage: package_digest.py PACKAGE [EXPECTED_SHA256]')
        actual = digest(sys.argv[1])
        if len(sys.argv) == 3:
            expected = sys.argv[2]
            if not re.fullmatch(r'[0-9a-f]{64}', expected) or not hmac.compare_digest(actual, expected):
                raise ValueError('Package digest mismatch')
        else:
            print(actual)
    except (ValueError, OSError) as error:
        print(f'Package digest failed: {error}', file=sys.stderr)
        sys.exit(1)
