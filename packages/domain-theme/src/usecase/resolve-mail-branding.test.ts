import { type PageBranding } from '@odudu/kernel';
import { describe, expect, it } from 'vitest';
import { type Palette } from '#/service/body';
import { createBrandingCache } from '#/service/branding-cache';
import { type PublishedLayer, type PublishedLayers } from '#/service/theme-body';
import { resolveBranding, resolveMailBranding } from '#/usecase/resolve-branding';

const ORIGIN = 'https://idp.example';
const SCOPE = { tenantId: 't1', tenantName: 'acme' };
const ASSET = '00000000-0000-4000-8000-0000000000a1';
const DARK_ASSET = '00000000-0000-4000-8000-0000000000a2';
const SHA = 'ab'.repeat(32);
const DARK_SHA = 'cd'.repeat(32);

const LIGHT: Palette = {
  surfacePage: '#ffffff',
  surfacePanel: '#fafafa',
  surfaceSunken: '#f0f0f0',
  inkPrimary: '#111111',
  inkMuted: '#555555',
  signalActive: '#ddeedd',
  signalActiveInk: '#004400',
  signalDanger: '#fde0d0',
  signalDangerInk: '#802000',
  borderStrong: '#777777',
  focusRing: '#0044aa',
};
const DARK: Palette = {
  surfacePage: '#101010',
  surfacePanel: '#181818',
  surfaceSunken: '#0a0a0a',
  inkPrimary: '#f0f0f0',
  inkMuted: '#bbbbbb',
  signalActive: '#224422',
  signalActiveInk: '#cceecc',
  signalDanger: '#502010',
  signalDangerInk: '#ffd0c0',
  borderStrong: '#999999',
  focusRing: '#88aaff',
};

function layer(body: unknown, assets: PublishedLayer['assets'] = []): PublishedLayer {
  return { versionId: 'v1', clientId: null, version: 1, body, assets };
}

const themed = layer(
  {
    tokens: { light: LIGHT, dark: DARK },
    stylesheet: null,
    templates: {},
    assets: {
      logo: { assetId: ASSET, alt: 'Acme' },
      darkLogo: { assetId: DARK_ASSET, alt: 'Acme on dark' },
    },
  },
  [
    { id: ASSET, sha256: SHA, mime: 'image/png', width: 480, height: 96 },
    { id: DARK_ASSET, sha256: DARK_SHA, mime: 'image/webp', width: 100, height: 100 },
  ],
);

function setup(layers: PublishedLayers, origin: string | null = ORIGIN) {
  const reads: string[] = [];
  const cache = createBrandingCache<PageBranding | null>({ now: () => 0 });
  const deps = {
    readPublished: () => Promise.resolve(layers),
    origin: origin ?? undefined,
    now: () => 0,
    cache,
    log: () => undefined,
    reportFallback: () => undefined,
  };
  const mail = resolveMailBranding(deps, (tx: string, tenantId) => {
    reads.push(`${tx}:${tenantId}`);
    return Promise.resolve(layers);
  });
  return { mail, reads, cache, page: resolveBranding(deps) };
}

describe('resolveMailBranding', () => {
  it('builds the palette, the logos and their absolute sizes from the tenant layer', async () => {
    const { mail } = setup({ tenant: themed, client: null });
    const found = await mail('tx', SCOPE);
    expect(found?.palette).toMatchObject({
      page: '#ffffff',
      panel: '#fafafa',
      ink: '#111111',
      link: '#004400',
      button: '#ddeedd',
      buttonInk: '#004400',
      border: '#777777',
    });
    expect(found?.darkPalette?.page).toBe('#101010');
    expect(found?.logo).toEqual({
      src: `${ORIGIN}/tenants/acme/brand/${SHA}.png`,
      alt: 'Acme',
      width: 160,
      height: 32,
    });
    expect(found?.darkLogo).toEqual({
      src: `${ORIGIN}/tenants/acme/brand/${DARK_SHA}.webp`,
      alt: 'Acme on dark',
      width: 48,
      height: 48,
    });
  });

  it('reads through the transaction it is given and caches for the next mail', async () => {
    const { mail, reads } = setup({ tenant: themed, client: null });
    await mail('tx1', SCOPE);
    await mail('tx2', SCOPE);
    expect(reads).toEqual(['tx1:t1']);
  });

  it('shares the cache with pages, so a page render makes the mail free', async () => {
    const { mail, reads, page } = setup({ tenant: themed, client: null });
    await page({ ...SCOPE, clientId: null });
    expect((await mail('tx', SCOPE))?.logo?.alt).toBe('Acme');
    expect(reads).toEqual([]);
  });

  it('is null for a tenant with no theme', async () => {
    const { mail } = setup({ tenant: null, client: null });
    expect(await mail('tx', SCOPE)).toBeNull();
  });

  it('is null without a public base URL, which a logo address needs', async () => {
    const { mail, reads } = setup({ tenant: themed, client: null }, null);
    expect(await mail('tx', SCOPE)).toBeNull();
    expect(reads).toEqual([]);
  });

  it('never uses the client layer, even when one was published', async () => {
    const client = layer({ tokens: { light: DARK }, stylesheet: null, templates: {}, assets: {} });
    const { mail } = setup({ tenant: themed, client: { ...client, clientId: 'c1' } });
    expect((await mail('tx', SCOPE))?.palette?.page).toBe('#ffffff');
  });

  it('keeps the mail default for a scheme that fails contrast', async () => {
    const weak = { ...LIGHT, inkMuted: '#eeeeee' };
    const { mail } = setup({
      tenant: layer({
        tokens: { light: weak, dark: DARK },
        stylesheet: null,
        templates: {},
        assets: {},
      }),
      client: null,
    });
    const found = await mail('tx', SCOPE);
    expect(found?.palette).toBeNull();
    expect(found?.darkPalette?.page).toBe('#101010');
  });

  it('draws no logo when the image is gone, and keeps the palette', async () => {
    const { mail } = setup({
      tenant: layer(
        {
          tokens: { light: LIGHT },
          stylesheet: null,
          templates: {},
          assets: { logo: { assetId: ASSET, alt: 'Acme' } },
        },
        [],
      ),
      client: null,
    });
    // An image that is gone drops the whole layer, as it does for a page.
    expect(await mail('tx', SCOPE)).toBeNull();
  });

  it('does not use a dark logo without a light one', async () => {
    const { mail } = setup({
      tenant: layer(
        {
          tokens: { light: LIGHT },
          stylesheet: null,
          templates: {},
          assets: { darkLogo: { assetId: DARK_ASSET, alt: 'x' } },
        },
        [{ id: DARK_ASSET, sha256: DARK_SHA, mime: 'image/png', width: 10, height: 10 }],
      ),
      client: null,
    });
    const found = await mail('tx', SCOPE);
    expect(found?.logo).toBeNull();
    expect(found?.darkLogo).toBeNull();
  });
});
