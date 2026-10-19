import { createHash } from 'node:crypto';
import { type FastifyPluginAsync } from 'fastify';
import { readStaticTree, type StaticFile } from '@odudu/kernel';

const TYPES: Readonly<Record<string, string>> = {
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
};

// A stylesheet and twelve fonts; the bound refuses a directory that is not
// the build.
const LIMITS = {
  maxFileBytes: 1024 * 1024,
  maxFiles: 100,
  maxTotalBytes: 8 * 1024 * 1024,
} as const;

// `buildInstrument` names a font `<name>.<8 hex of its content>.woff2`.
const CONTENT_HASHED_FONT = /^fonts\/[a-z0-9-]+\.[0-9a-f]{8}\.woff2$/u;

function etagOf(file: StaticFile): string {
  return `"${createHash('sha256').update(file.content).digest('base64url').slice(0, 27)}"`;
}

// The stylesheet's name is fixed (the pages link it), so it revalidates
// by etag; a font's name carries its content, so it never does.
export function instrumentRoutes(dir: string): FastifyPluginAsync {
  return async (fastify) => {
    let tree: ReadonlyMap<string, StaticFile>;
    try {
      tree = await readStaticTree(dir, TYPES, LIMITS, (message) => {
        fastify.log.warn(message);
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'unknown error';
      fastify.log.warn(
        `ODUDU_INSTRUMENT_DIR (${dir}) has no built stylesheet (${reason}); /instrument/* answers 404`,
      );
      return;
    }
    const etags = new Map([...tree].map(([path, file]) => [path, etagOf(file)]));

    fastify.get<{ Params: { '*': string } }>('/instrument/*', (request, reply) => {
      const path = request.params['*'];
      const file = tree.get(path);
      const etag = etags.get(path);
      if (file === undefined || etag === undefined) return reply.code(404).send();
      const immutable = CONTENT_HASHED_FONT.test(path);
      reply
        .header('etag', etag)
        .header('cache-control', immutable ? 'public, max-age=31536000, immutable' : 'no-cache');
      if (request.headers['if-none-match'] === etag) return reply.code(304).send();
      return reply.code(200).header('content-type', file.contentType).send(file.content);
    });
  };
}
