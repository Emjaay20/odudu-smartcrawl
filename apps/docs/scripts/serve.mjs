import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { createGzip } from 'node:zlib';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.md': 'text/markdown; charset=utf-8',
};
const COMPRESSIBLE = /^(?:text\/|application\/(?:json|xml)|image\/svg)/u;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    base: { type: 'string', default: '/' },
    port: { type: 'string', default: '4173' },
  },
});
const root = path.resolve(positionals[0] ?? 'dist/pages');
const base = values.base.endsWith('/') ? values.base : `${values.base}/`;

async function resolveFile(pathname) {
  if (!pathname.startsWith(base)) return null;
  const relative = decodeURIComponent(pathname.slice(base.length));
  const isDirectory = relative === '' || relative.endsWith('/');
  const candidate = path.resolve(root, isDirectory ? `${relative}index.html` : relative);
  if (candidate !== root && !candidate.startsWith(root + path.sep)) return null;
  const info = await stat(candidate).catch(() => null);
  return info?.isFile() === true ? candidate : null;
}

// A static server that compresses text the way a real host does, answers only
// under the base, and 404s everything else, so a build is measured as served.
const server = createServer((request, response) => {
  const { pathname } = new URL(request.url ?? '/', 'http://localhost');
  resolveFile(pathname).then(
    (file) => {
      if (file === null) {
        response.writeHead(404, { 'content-type': TYPES['.html'] });
        response.end('Not found');
        return;
      }
      const type = TYPES[path.extname(file)] ?? 'application/octet-stream';
      const gzip =
        COMPRESSIBLE.test(type) && /\bgzip\b/u.test(request.headers['accept-encoding'] ?? '');
      response.writeHead(200, {
        'content-type': type,
        ...(COMPRESSIBLE.test(type) ? { vary: 'accept-encoding' } : {}),
        ...(gzip ? { 'content-encoding': 'gzip' } : {}),
      });
      const stream = createReadStream(file);
      (gzip ? stream.pipe(createGzip()) : stream).pipe(response);
    },
    () => {
      response.writeHead(500);
      response.end();
    },
  );
});

server.listen(Number(values.port), '127.0.0.1', () => {
  const address = server.address();
  const port = typeof address === 'object' && address !== null ? address.port : values.port;
  console.log(`Serving http://127.0.0.1:${String(port)}${base}`);
});
