import { type FastifyInstance, type LightMyRequestResponse } from 'fastify';
import { expect } from 'vitest';

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

function unescapeHtml(value: string): string {
  return value.replace(/&(?:amp|lt|gt|quot|#39);/g, (entity) => ENTITIES[entity] ?? entity);
}

// A logout request with a live session is only ever answered with the
// confirmation page. This reads that page's hidden fields the way a browser
// submits them and posts the form back, returning the answer that ends the
// session.
export async function confirmLogoutPage(
  http: FastifyInstance,
  tenantName: string,
  cookie: string,
  page: LightMyRequestResponse,
  extraHeaders: Record<string, string> = {},
): Promise<LightMyRequestResponse> {
  expect(page.statusCode).toBe(200);
  expect(page.body).toContain('<title>Sign out?</title>');
  const fields = new URLSearchParams();
  for (const match of page.body.matchAll(/<input type="hidden" name="([^"]*)" value="([^"]*)">/g)) {
    fields.set(unescapeHtml(match[1] ?? ''), unescapeHtml(match[2] ?? ''));
  }
  return http.inject({
    method: 'POST',
    url: `/tenants/${tenantName}/protocol/openid-connect/logout`,
    payload: fields.toString(),
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie, ...extraHeaders },
  });
}
