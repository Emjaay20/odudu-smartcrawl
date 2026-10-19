import { ADMIN_ROUTES } from '@odudu/protocol-admin';
import { describe, expect, it } from 'vitest';
import { ENDPOINT_AUTH, ENDPOINT_DOCS, endpointKey, NOT_LISTED } from '#/endpoint-docs';
import { servingApp } from '#/testing/served-routes';

// The admin API is described operation by operation by its OpenAPI document.
const ADMIN_OPERATIONS = new Set(ADMIN_ROUTES.map((route) => `${route.method} ${route.pattern}`));

describe('the endpoint reference', () => {
  it('describes every endpoint the server serves apart from the admin API operations, and no other', async () => {
    const { app, endpoints } = await servingApp();
    const served = endpoints
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
