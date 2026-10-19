import { ADMIN_ROUTES } from '@odudu/protocol-admin';
import { describe, expect, it } from 'vitest';
import { ENDPOINT_AUTH, ENDPOINT_DOCS, endpointKey } from '#/endpoint-docs';
import { servedEndpoints, servingApp } from '#/served-routes';

const NOT_LISTED = new Set(['OPTIONS *']);

// The admin API is described operation by operation by its OpenAPI document.
const ADMIN_OPERATIONS = new Set(ADMIN_ROUTES.map((route) => `${route.method} ${route.pattern}`));

describe('the endpoint reference', () => {
  it('describes every endpoint the server serves apart from the admin API operations, and no other', async () => {
    const app = await servingApp();
    const served = servedEndpoints(app)
      .map(endpointKey)
      .filter((key) => !NOT_LISTED.has(key) && !ADMIN_OPERATIONS.has(key))
      .sort();
    await app.close();
    expect(Object.keys(ENDPOINT_DOCS).sort()).toEqual(served);
  });

  it('gives each endpoint a way to authenticate and a one-sentence purpose', () => {
    for (const [key, docs] of Object.entries(ENDPOINT_DOCS)) {
      expect(ENDPOINT_AUTH, key).toContain(docs.auth);
      expect(docs.purpose, key).toMatch(/^\S.*\.$/u);
      expect(docs.purpose, key).not.toContain('\n');
    }
  });
});
