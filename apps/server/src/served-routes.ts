import { type DatabaseHandle } from '@odudu/db';
import { loadConfig } from '@odudu/kernel';
import { type FastifyInstance } from 'fastify';
import { buildApp } from '#/app';
import { createLogger } from '#/logger';

export interface ServedEndpoint {
  readonly method: string;
  readonly url: string;
}

// Nothing here reaches the database: the app is built only so Fastify's own
// router can be asked what it serves.
const database: DatabaseHandle = {
  db: {} as DatabaseHandle['db'],
  sql: (() => Promise.resolve([])) as unknown as DatabaseHandle['sql'],
  close: () => Promise.resolve(),
};

export async function servingApp(): Promise<FastifyInstance> {
  const config = loadConfig({
    ODUDU_DATABASE_URL: 'postgres://u:p@localhost:5432/odudu',
    ODUDU_KEK: Buffer.alloc(32, 9).toString('base64'),
    ODUDU_LOG_LEVEL: 'silent',
  });
  const app = buildApp({
    database,
    ownerDatabase: database,
    kek: config.ODUDU_KEK,
    logger: createLogger(config),
  });
  await app.ready();
  return app;
}

// Fastify derives HEAD from every GET route, so a listing of what a client
// calls leaves it out.
const IMPLIED_BY_GET = 'HEAD';

// One tree line, e.g. "│   └── /introspect (POST)": `indent` is every
// 4-character column ahead of the branch marker (`│   ` for an ancestor
// with siblings still to print, `    ` for one that has finished), `url`
// is this node's own path segment, and `methods` the comma-joined list.
const TREE_LINE =
  /^(?<indent>(?:│ {3}| {4})*)(?:├── |└── )(?<url>\/\S*|-\S+|\*) \((?<methods>[A-Z, ]+)\)$/u;

// `printRoutes` renders a tree for people: a route nested under a sibling's
// own path (`/token/introspect` under `/token`) prints as a child line
// carrying only its own suffix, `/introspect`, not the full URL. Walking the
// tree by indent depth and concatenating each node's segment onto its
// nearest shallower ancestor's reconstructs the real URL regardless of
// nesting.
export function servedEndpoints(app: FastifyInstance): ServedEndpoint[] {
  const printed = app.printRoutes({ commonPrefix: false });
  const stack: { depth: number; path: string }[] = [];
  const endpoints: ServedEndpoint[] = [];

  for (const line of printed.split('\n')) {
    const match = TREE_LINE.exec(line);
    if (match === null) continue;
    const depth = (match.groups?.indent ?? '').length / 4;
    while ((stack[stack.length - 1]?.depth ?? -1) >= depth) stack.pop();
    const parentPath = stack[stack.length - 1]?.path ?? '';
    const url = match.groups?.url ?? '';
    const path = url === '*' ? url : parentPath + url;
    stack.push({ depth, path });

    for (const method of (match.groups?.methods ?? '').split(', ')) {
      if (method === IMPLIED_BY_GET) continue;
      endpoints.push({ method, url: path });
    }
  }

  // printRoutes renders a tree for people, so its shape is not a contract. A
  // rendering change that stopped matching would otherwise empty this list.
  if (endpoints.length === 0) {
    throw new Error(`no routes parsed out of Fastify's route listing:\n${printed}`);
  }
  return endpoints;
}
