import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { createGzip, gzipSync } from 'node:zlib';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
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

function decode(text) {
  try {
    return decodeURIComponent(text);
  } catch {
    return null;
  }
}

async function fileAt(candidate) {
  if (candidate !== root && !candidate.startsWith(root + path.sep)) return null;
  const info = await stat(candidate).catch(() => null);
  return info?.isFile() === true ? candidate : null;
}

// What a path under the base is: a file, a directory whose address lacks its
// slash (Pages answers those with a redirect), or nothing.
async function resolveFile(pathname) {
  if (pathname === base.slice(0, -1)) return { redirect: base };
  if (!pathname.startsWith(base)) return null;
  const relative = decode(pathname.slice(base.length));
  if (relative === null) return { missing: true };
  const isDirectory = relative === '' || relative.endsWith('/');
  const file = await fileAt(path.resolve(root, isDirectory ? `${relative}index.html` : relative));
  if (file !== null) return { file };
  if (!isDirectory && (await fileAt(path.resolve(root, relative, 'index.html'))) !== null) {
    return { redirect: `${pathname}/` };
  }
  return { missing: true };
}

function send(request, response, status, headers, source) {
  const compress =
    COMPRESSIBLE.test(headers['content-type']) &&
    /\bgzip\b/u.test(request.headers['accept-encoding'] ?? '');
  response.writeHead(status, {
    ...headers,
    ...(COMPRESSIBLE.test(headers['content-type']) ? { vary: 'accept-encoding' } : {}),
    ...(compress ? { 'content-encoding': 'gzip' } : {}),
  });
  if (request.method === 'HEAD') {
    response.end();
    return;
  }
  if (source.body !== undefined) {
    response.end(compress ? gzipSync(source.body) : source.body);
    return;
  }
  const stream = createReadStream(source.file);
  (compress ? stream.pipe(createGzip()) : stream).pipe(response);
}

// A static server that behaves as GitHub Pages does: text is compressed, a
// directory without its slash is redirected to it, a miss under the base is
// the build's own 404.html with status 404, and anything outside the base is
// not this site's at all.
const server = createServer((request, response) => {
  const { pathname, search } = new URL(request.url ?? '/', 'http://localhost');
  resolveFile(pathname).then(
    async (found) => {
      if (found?.redirect !== undefined) {
        response.writeHead(308, { location: `${found.redirect}${search}` });
        response.end();
        return;
      }
      if (found?.file !== undefined) {
        const type = TYPES[path.extname(found.file)] ?? 'application/octet-stream';
        send(request, response, 200, { 'content-type': type }, { file: found.file });
        return;
      }
      const page = found === null ? null : await fileAt(path.join(root, '404.html'));
      if (page === null) {
        send(request, response, 404, { 'content-type': TYPES['.txt'] }, { body: 'Not found' });
        return;
      }
      send(request, response, 404, { 'content-type': TYPES['.html'] }, { file: page });
    },
    (error) => {
      console.error(error);
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
