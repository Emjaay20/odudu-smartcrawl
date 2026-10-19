import { describe, expect, it } from 'vitest';
import {
  servedEndpoints,
  servingApp,
  type ServedEndpoint,
} from '../../apps/server/src/served-routes.js';
import { backticked, loadDocument, tableWithHeadings } from './markdown.js';

// Two documents, one endpoint table shape: `docs/request-paths.md` is the
// protocol surface, `docs/admin-paths.md` the admin API. An endpoint
// documented in either satisfies this check — see `docs/admin-paths.md`'s
// header for why they are separate documents.
const DOCUMENTS = ['docs/request-paths.md', 'docs/admin-paths.md'] as const;

// `@fastify/cors` registers this catch-all preflight responder itself
// (`packages/protocol-oidc/src/view/routes/cors.ts`) — plumbing for every
// route CORS applies to, not a protocol endpoint a client is told to call.
const CORS_PREFLIGHT_CATCHALL = 'OPTIONS *';

function format(endpoint: ServedEndpoint): string {
  return `${endpoint.method} ${endpoint.url}`;
}

// `{tenant}` reads as a placeholder to a person; Fastify spells it `:tenant`.
function documentedIn(path: string): ServedEndpoint[] {
  const table = tableWithHeadings(loadDocument(path), ['Method', 'Path', 'What it is']);
  return table.rows.flatMap((row) => {
    const [methodCell = '', pathCell = ''] = row;
    const method = backticked(methodCell)[0];
    if (method === undefined) return [];
    return backticked(pathCell).map((url) => ({ method, url: url.replace('{tenant}', ':tenant') }));
  });
}

describe('the endpoints docs/request-paths.md and docs/admin-paths.md list are the endpoints the server serves', () => {
  it('serves every endpoint each document tells a reader to call', async () => {
    const app = await servingApp();

    for (const document of DOCUMENTS) {
      const missing = documentedIn(document).filter(
        (endpoint) => !app.hasRoute({ method: endpoint.method, url: endpoint.url }),
      );

      expect(
        missing.map(format),
        `${document} documents endpoints this server does not serve`,
      ).toEqual([]);
    }
  });

  it('documents every endpoint the server serves, in one of the two', async () => {
    const app = await servingApp();
    const claimed = new Set(DOCUMENTS.flatMap((document) => documentedIn(document).map(format)));
    const undocumented = servedEndpoints(app)
      .map(format)
      .filter((endpoint) => endpoint !== CORS_PREFLIGHT_CATCHALL && !claimed.has(endpoint));

    expect(
      undocumented,
      `these endpoints are served but absent from both ${DOCUMENTS.join(' and ')}`,
    ).toEqual([]);
  });
});
