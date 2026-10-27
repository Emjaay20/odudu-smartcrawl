import { withTenant } from '@odudu/db';
import { assetRepository, themeRepository, type ThemeBody } from '@odudu/domain-theme';
import { type FastifyInstance } from 'fastify';
import { type PlanWorld, TARGET_CLIENT, TARGET_TENANT } from '#/testing/plan-world';
import { type Capture } from '#/testing/plan-paths';

const CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

export const BRANDING_PATHS = {
  cachedHit: 'sign-in page of a client with an empty theme, theme cached',
  themedMiss: 'sign-in page of a themed client, theme not cached',
  themedHit: 'sign-in page of a themed client, theme cached',
} as const;

const SIGN_IN =
  '<div class="plan-themed">{{intro}}{{form.open}}{{fields}}{{submit}}{{error}}{{form.close}}</div>';

function signInUrl(clientId: string, redirectUri: string): string {
  const query = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'openid',
    state: 'plan-state',
    code_challenge: CHALLENGE,
    code_challenge_method: 'S256',
  });
  return `/tenants/${TARGET_TENANT}/protocol/openid-connect/auth?${query.toString()}`;
}

async function render(http: FastifyInstance, url: string, themed: boolean): Promise<void> {
  const page = await http.inject({ url });
  if (page.statusCode !== 200) throw new Error(`sign-in answered ${String(page.statusCode)}`);
  if (page.body.includes('plan-themed') !== themed) {
    throw new Error(`the sign-in page was ${themed ? 'not themed' : 'themed'}`);
  }
}

// The same sign-in page three ways, each under its own name so the check can
// compare the statements: a client whose theme is cached as none, a themed
// client whose theme is not cached yet, and the same client once it is. The
// tenant and client themes carry an image, so the read joins what it names.
export async function driveBranding(world: PlanWorld, capture: Capture): Promise<void> {
  const http = world.http;
  const tenantId = world.tenantId;
  const [themed] = await world.owner.sql<{ id: string; uri: string }[]>`
    select k.id, c.redirect_uris[1] as uri
      from client_oidc_config c join clients k on k.id = c.client_id
     where k.tenant_id = ${tenantId} and k.client_id = 'app-2'`;
  const [plain] = await world.owner.sql<{ uri: string }[]>`
    select c.redirect_uris[1] as uri
      from client_oidc_config c join clients k on k.id = c.client_id
     where k.tenant_id = ${tenantId} and k.client_id = ${TARGET_CLIENT}`;
  if (themed === undefined || plain === undefined) throw new Error('a plan client is missing');

  // A render the cache has not seen, to fill it for the baseline.
  await render(http, signInUrl(TARGET_CLIENT, plain.uri), false);
  await capture(BRANDING_PATHS.cachedHit, 'oidc', () =>
    http.inject({ url: signInUrl(TARGET_CLIENT, plain.uri) }),
  );

  const logo = await withTenant(world.app.db, tenantId, (tx) =>
    assetRepository(tx).put({
      tenantId,
      sha256: 'ab'.repeat(32),
      mime: 'image/png',
      width: 4,
      height: 3,
      bytes: Buffer.from('plan-logo'),
      tenantCapBytes: 1024 * 1024,
    }),
  );
  if (logo === 'over_cap') throw new Error('the plan logo was refused');
  const body: ThemeBody = {
    tokens: { font: 'IBM Plex Mono' },
    stylesheet: null,
    templates: { 'sign-in': SIGN_IN },
    assets: { logo: { assetId: logo.id, alt: 'Plans' } },
  };
  for (const clientId of [null, themed.id]) {
    await withTenant(world.app.db, tenantId, async (tx) => {
      const themes = themeRepository(tx);
      await themes.saveDraft({ tenantId, clientId }, body, null);
      await themes.publish({ tenantId, clientId });
    });
  }

  const url = signInUrl('app-2', themed.uri);
  const miss = await capture(BRANDING_PATHS.themedMiss, 'oidc', () => http.inject({ url }));
  if (!miss.body.includes('plan-themed')) {
    throw new Error(
      `the themed sign-in was not themed: ${String(miss.statusCode)} ${miss.body.slice(0, 400)}`,
    );
  }
  const hit = await capture(BRANDING_PATHS.themedHit, 'oidc', () => http.inject({ url }));
  if (!hit.body.includes('plan-themed')) throw new Error('the cached sign-in was not themed');
}
