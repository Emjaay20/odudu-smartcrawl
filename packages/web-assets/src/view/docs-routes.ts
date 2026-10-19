import { type FastifyInstance, type FastifyPluginAsync, type FastifyReply } from 'fastify';
import {
  etagMatches,
  OduduError,
  readStaticTree,
  staticEtag,
  type StaticFile,
} from '@odudu/kernel';
import { cacheControlFor, DOCS_LIMITS, DOCS_TYPES } from '#/service/docs-files';
import { docsPolicy, parseDocsCsp, UNAVAILABLE_POLICY } from '#/service/docs-policy';

const ROBOTS = 'noindex, nofollow';
const LANGUAGE = 'en';

interface Site {
  readonly files: ReadonlyMap<string, StaticFile>;
  readonly etags: ReadonlyMap<string, string>;
  readonly policy: string;
}

// A directory that is not the build is a reason, not a crash: the rest of the
// server starts and `/docs/*` says why it cannot answer.
class NotTheBuild extends Error {}

async function readSite(dir: string, warn: (message: string) => void): Promise<Site> {
  const tree = await readStaticTree(dir, DOCS_TYPES, DOCS_LIMITS, warn);
  const cspFile = tree.get('csp.json');
  if (cspFile === undefined) throw new NotTheBuild('it has no csp.json');
  if (!tree.has('index.html')) throw new NotTheBuild('it has no index.html');
  let policy: string;
  try {
    policy = docsPolicy(parseDocsCsp(JSON.parse(cspFile.content.toString('utf8'))));
  } catch (err) {
    throw new NotTheBuild(
      `csp.json is not the build's policy (${err instanceof Error ? err.message : 'unreadable'})`,
    );
  }
  // The policy file configures this route and is not documentation.
  const files = new Map([...tree].filter(([path]) => path !== 'csp.json'));
  const etags = new Map([...files].map(([path, file]) => [path, staticEtag(file.content)]));
  return { files, etags, policy };
}

function why(err: unknown): string {
  if (err instanceof NotTheBuild) return err.message;
  if (err instanceof OduduError && err.code === 'static_tree_too_large') {
    return `${err.message}, which is not the build`;
  }
  return err instanceof Error ? err.message : 'unknown error';
}

function toDocsReply(reply: FastifyReply, policy: string): FastifyReply {
  return reply
    .header('content-security-policy', policy)
    .header('x-frame-options', 'DENY')
    .header('referrer-policy', 'no-referrer')
    .header('x-content-type-options', 'nosniff')
    .header('x-robots-tag', ROBOTS)
    .header('content-language', LANGUAGE);
}

function redirect(reply: FastifyReply, location: string): FastifyReply {
  return toDocsReply(reply, UNAVAILABLE_POLICY).code(308).redirect(location);
}

function registerUnavailable(fastify: FastifyInstance, dir: string, reason: string): void {
  fastify.log.warn(
    `ODUDU_DOCS_DIR (${dir}) cannot be served, ${reason}; /docs/* answers 503; ` +
      'set ODUDU_DOCS=false to turn the documentation off',
  );
  fastify.get('/docs/*', (_request, reply) =>
    toDocsReply(reply, UNAVAILABLE_POLICY)
      .code(503)
      .header('cache-control', 'no-store')
      .type('text/plain; charset=utf-8')
      .send('documentation unavailable'),
  );
}

// The built documentation is read once, at registration, into a manifest, so
// no request touches the filesystem and a path that is not an exact key is a
// 404: traversal, encoded separators, NUL and links all end at the same lookup.
// The policy is not derived here: the build computed it from the hashes of the
// inline script and style attributes it emitted, and wrote it as csp.json.
export function docsRoutes(dir: string): FastifyPluginAsync {
  return async (fastify) => {
    fastify.get('/docs', (_request, reply) => redirect(reply, '/docs/'));

    let site: Site;
    try {
      site = await readSite(dir, (message) => {
        fastify.log.warn(`ODUDU_DOCS_DIR: ${message}`);
      });
    } catch (err) {
      registerUnavailable(fastify, dir, why(err));
      return;
    }
    const { files, etags, policy } = site;
    const notFound = files.get('404.html');

    fastify.get<{ Params: { '*': string } }>('/docs/*', (request, reply) => {
      const path = request.params['*'];
      const key = path === '' || path.endsWith('/') ? `${path}index.html` : path;
      const file = files.get(key);
      const etag = etags.get(key);
      if (file === undefined || etag === undefined) {
        if (!path.endsWith('/') && files.has(`${path}/index.html`)) {
          const query = request.url.indexOf('?');
          const search = query === -1 ? '' : request.url.slice(query);
          const encoded = path.split('/').map(encodeURIComponent).join('/');
          return redirect(reply, `/docs/${encoded}/${search}`);
        }
        const page = toDocsReply(reply, policy).code(404).header('cache-control', 'no-cache');
        return notFound === undefined
          ? page.type('text/plain; charset=utf-8').send('not found')
          : page.type(notFound.contentType).send(notFound.content);
      }
      toDocsReply(reply, policy).header('etag', etag).header('cache-control', cacheControlFor(key));
      if (etagMatches(request.headers['if-none-match'], etag)) return reply.code(304).send();
      return reply.code(200).type(file.contentType).send(file.content);
    });
  };
}
