import { ADMIN_ROUTES } from '@odudu/protocol-admin';
import { ENDPOINT_DOCS } from '@odudu/server/src/endpoint-docs.ts';
import { servingApp } from '@odudu/server/src/testing/served-routes.ts';
import { describe, expect, it } from 'vitest';
import { renderEndpointsPage } from './endpoints-page.ts';

const adminOperations = new Set(ADMIN_ROUTES.map((route) => `${route.method} ${route.pattern}`));
const { app, endpoints: served } = await servingApp();
await app.close();
const text = renderEndpointsPage({ served, adminOperations });

describe('the endpoint reference', () => {
  it('lists every endpoint the server serves apart from the admin operations, with its authentication', () => {
    for (const [key, docs] of Object.entries(ENDPOINT_DOCS)) {
      const [method = '', url = ''] = key.split(' ');
      const row = text
        .split('\n')
        .find((line) =>
          line.startsWith(`| \`${method}\` | \`${url.replace(/:(\w+)/gu, '{$1}')}\` |`),
        );
      expect(row, key).toBeDefined();
      expect(row, key).toContain(`| ${docs.auth} |`);
    }
  });

  it('lists the console gateway and the stylesheet routes, and says what it covers', () => {
    expect(text).toContain('| `GET` | `/console/auth/login` |');
    expect(text).toContain('| `GET` | `/instrument/*` |');
    expect(text).toContain('| `POST` | `/console/api/admin/*` | Console session |');
    expect(text).toContain('all under `/admin`');
    expect(ADMIN_ROUTES.every((route) => route.pattern.startsWith('/admin/'))).toBe(true);
  });

  it('counts the admin operations it points to the reference for', () => {
    expect(text).toContain(`has ${String(ADMIN_ROUTES.length)} operations`);
  });

  it('refuses to describe a served endpoint nobody documented', () => {
    expect(() =>
      renderEndpointsPage({
        served: [...served, { method: 'GET', url: '/tenants/:tenant/undocumented' }],
        adminOperations,
      }),
    ).toThrow('/tenants/:tenant/undocumented is served but ENDPOINT_DOCS does not describe it');
  });
});
