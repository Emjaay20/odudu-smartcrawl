import {
  ENDPOINT_DOCS,
  endpointKey,
  NOT_LISTED,
  type ServedEndpoint,
} from '@odudu/server/src/endpoint-docs.ts';
import { cell, codeCell, page, table } from './markdown.ts';

function inPlaceholders(url: string): string {
  return url.replace(/:(\w+)/gu, '{$1}');
}

export interface EndpointsInput {
  readonly served: readonly ServedEndpoint[];
  // `METHOD /pattern` of each admin API operation, which its OpenAPI document describes.
  readonly adminOperations: ReadonlySet<string>;
}

export function renderEndpointsPage({ served, adminOperations }: EndpointsInput): string {
  const listed = served.filter(
    (endpoint) =>
      !NOT_LISTED.has(endpointKey(endpoint)) && !adminOperations.has(endpointKey(endpoint)),
  );
  const rows = listed
    .map((endpoint) => {
      const docs = ENDPOINT_DOCS[endpointKey(endpoint)];
      if (docs === undefined) {
        throw new Error(
          `${endpointKey(endpoint)} is served but ENDPOINT_DOCS does not describe it`,
        );
      }
      return { endpoint, docs };
    })
    .sort((a, b) =>
      a.endpoint.url === b.endpoint.url
        ? a.endpoint.method.localeCompare(b.endpoint.method)
        : a.endpoint.url < b.endpoint.url
          ? -1
          : 1,
    )
    .map(({ endpoint, docs }) => [
      codeCell(endpoint.method),
      codeCell(inPlaceholders(endpoint.url)),
      cell(docs.auth),
      cell(docs.purpose),
    ]);
  const body = [
    'Everything the server serves, apart from the admin API’s operations. `{tenant}` is the name ' +
      'of the tenant; every tenant has its own issuer, keys and clients under `/tenants/{tenant}`.',
    '## Endpoints',
    table(['Method', 'Path', 'Authentication', 'Purpose'], rows),
    '## The admin API',
    `The admin API has ${String(adminOperations.size)} operations, all under \`/admin\`. Each ` +
      'needs an access token for the admin audience and names the capability it requires; they ' +
      'are listed, with their parameters and bodies, in the [admin API reference](./admin-api/index.md). ' +
      'A path under `/console/auth` or `/console/api` that is not listed answers `404`.',
  ].join('\n\n');
  return page(
    'Endpoints',
    'Every HTTP endpoint the Odudu server serves, with its method, path, how it authenticates and what it is for.',
    body,
  );
}
