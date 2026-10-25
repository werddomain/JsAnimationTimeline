// tools/validationPreviewServer.ts
/** Creates an inactive server for an explicitly allowlisted local validation preview. */

import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { Server } from 'node:http';

/** One trusted file the caller deliberately exposes through the preview. */
export interface IValidationPreviewFile {
  readonly file: string;
  readonly type: string;
}

/** The caller chooses its loopback host and port by calling `listen`. */
export function createValidationPreviewServer(files: ReadonlyMap<string, IValidationPreviewFile>): Server {
  return createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' });
      response.end();
      return;
    }
    let pathname: string;
    try {
      pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
    } catch {
      response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end(request.method === 'HEAD' ? undefined : 'Requête invalide.');
      return;
    }
    const entry = files.get(pathname);
    if (entry === undefined) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end(request.method === 'HEAD' ? undefined : 'Ressource absente de la liste de revue.');
      return;
    }
    try {
      const body = await readFile(entry.file);
      response.writeHead(200, { 'Content-Type': entry.type, 'Content-Length': body.length });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch {
      response.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end(request.method === 'HEAD' ? undefined : 'Les fichiers de la revue doivent être disponibles.');
    }
  });
}
