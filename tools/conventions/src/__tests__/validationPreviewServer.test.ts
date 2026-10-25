// tools/conventions/src/__tests__/validationPreviewServer.test.ts
/** HTTP contract of the local validation server: explicit files, read-only methods, and safe failures. */

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { request } from 'node:http';
import type { IncomingHttpHeaders, Server } from 'node:http';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import { createValidationPreviewServer } from '../../../validationPreviewServer';

interface IHttpResult {
  readonly status: number;
  readonly headers: IncomingHttpHeaders;
  readonly body: string;
}

const FIXTURE_PREFIX = 'js-timeline-validation-preview-';
const HTML = '<!doctype html><html lang="fr"><title>Revue locale · été</title></html>';

async function removeFixtureDirectory(directory: string): Promise<void> {
  const target = resolve(directory);
  const tempRoot = resolve(tmpdir());
  if (!target.startsWith(`${tempRoot}${sep}`) || !basename(target).startsWith(FIXTURE_PREFIX)) {
    throw new Error('Refusing to remove an unexpected fixture directory.');
  }
  await rm(target, { recursive: true, force: true });
}

describe('createValidationPreviewServer', () => {
  let directory: string | undefined;
  let server: Server | undefined;
  let port: number;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), FIXTURE_PREFIX));
    const html = join(directory, 'index.html');
    const css = join(directory, 'demo.css');
    await writeFile(html, HTML, 'utf8');
    await writeFile(css, 'body { color: #123456; }', 'utf8');
    await writeFile(join(directory, 'private.txt'), 'Not allowlisted', 'utf8');
    server = createValidationPreviewServer(new Map([
      ['/', { file: html, type: 'text/html; charset=utf-8' }],
      ['/assets/demo.css', { file: css, type: 'text/css; charset=utf-8' }],
      ['/missing.css', { file: join(directory, 'absent.css'), type: 'text/css; charset=utf-8' }]
    ]));
    const activeServer = server;
    await new Promise<void>((accept, reject) => {
      activeServer.once('error', reject);
      activeServer.listen(0, '127.0.0.1', () => {
        activeServer.removeListener('error', reject);
        accept();
      });
    });
    const address = activeServer.address();
    if (address === null || typeof address === 'string') throw new Error('Expected a loopback TCP address.');
    port = address.port;
  });

  afterEach(async () => {
    try {
      const activeServer = server;
      if (activeServer?.listening) {
        await new Promise<void>((accept, reject) => activeServer.close((error) => error === undefined ? accept() : reject(error)));
      }
    } finally {
      server = undefined;
      if (directory !== undefined) {
        await removeFixtureDirectory(directory);
        directory = undefined;
      }
    }
  });

  function read(path: string, method = 'GET'): Promise<IHttpResult> {
    return new Promise((accept, reject) => {
      const outgoing = request({ hostname: '127.0.0.1', port, path, method }, (incoming) => {
        const chunks: Buffer[] = [];
        incoming.on('data', (chunk: Buffer) => chunks.push(chunk));
        incoming.on('error', reject);
        incoming.on('end', () => accept({
          status: incoming.statusCode ?? 0,
          headers: incoming.headers,
          body: Buffer.concat(chunks).toString('utf8')
        }));
      });
      outgoing.on('error', reject);
      outgoing.end();
    });
  }

  it('lets the caller choose whether and where the server listens', () => {
    const idle = createValidationPreviewServer(new Map());
    expect(idle.listening).toBe(false);
    expect(idle.address()).toBeNull();
    expect(server?.address()).toMatchObject({ address: '127.0.0.1', port });
  });

  it('serves only an allowlisted file with its MIME type and safe cache headers', async () => {
    const response = await read('/');
    expect(response.status).toBe(200);
    expect(response.body).toBe(HTML);
    expect(response.headers).toMatchObject({
      'content-type': 'text/html; charset=utf-8',
      'content-length': String(Buffer.byteLength(HTML)),
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer'
    });
  });

  it('answers HEAD with the same file headers and no response body', async () => {
    const response = await read('/', 'HEAD');
    expect(response.status).toBe(200);
    expect(response.body).toBe('');
    expect(response.headers['content-length']).toBe(String(Buffer.byteLength(HTML)));
    expect(response.headers['content-type']).toBe('text/html; charset=utf-8');
  });

  it('uses the pathname for a known asset without treating query parameters as filesystem paths', async () => {
    const response = await read('/assets/demo.css?file=private.txt');
    expect(response.status).toBe(200);
    expect(response.body).toBe('body { color: #123456; }');
    expect(response.headers['content-type']).toBe('text/css; charset=utf-8');
  });

  it.each(['/unlisted-file.txt', '/private.txt', '/../private.txt', '/assets/%2e%2e/private.txt', '/assets%2Fdemo.css'])('preserves 404 for the unlisted path %s', async (path) => {
    const response = await read(path);
    expect(response.status).toBe(404);
    expect(response.body).toBe('Ressource absente de la liste de revue.');
    expect(response.body).not.toContain('Not allowlisted');
    expect(response.body).not.toContain(directory);
  });

  it.each(['POST', 'PUT', 'DELETE', 'OPTIONS'])('preserves 405 for %s without reading a file', async (method) => {
    const response = await read('/', method);
    expect(response.status).toBe(405);
    expect(response.headers.allow).toBe('GET, HEAD');
    expect(response.body).toBe('');
  });

  it('returns a safe 503 when an allowlisted file is not available', async () => {
    const response = await read('/missing.css');
    expect(response.status).toBe(503);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toBe('Les fichiers de la revue doivent être disponibles.');
    expect(response.body).not.toContain(directory);
    expect(response.body).not.toContain('ENOENT');
  });

  it('does not send an error body for HEAD when the file is unavailable', async () => {
    const response = await read('/missing.css', 'HEAD');
    expect(response.status).toBe(503);
    expect(response.body).toBe('');
  });

  it('rejects a malformed request URL without exposing a path', async () => {
    const response = await read('http://[');
    expect(response.status).toBe(400);
    expect(response.body).toBe('Requête invalide.');
  });
});
