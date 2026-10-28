import { describe, expect, it } from 'vitest';
import { type PublishedLayer, type PublishedLayers } from '#/service/theme-body';
import { type ThemeBody } from '#/service/body';
import { assetPath, parseBrandFile, sha256Hex, stylesheetPath } from '#/service/branding-urls';
import { brandingCss, tokensCss } from '#/service/branding-css';
import { buildBranding } from '#/service/build-branding';
import { serveBrand, type ServeBrandDeps } from '#/usecase/serve-brand';

const ORIGIN = 'https://id.example.test';
const TENANT = { id: 't1', name: 'acme' };
const CLIENT_ROW = '00000000-0000-4000-8000-0000000000c1';
const PNG = Buffer.from('png-bytes');
const PNG_SHA = sha256Hex(PNG);

function body(stylesheet: string | null): ThemeBody {
  return { tokens: { font: 'IBM Plex Mono' }, stylesheet, templates: {}, assets: {} };
}

function layer(themeBody: ThemeBody, clientId: string | null, version = 1): PublishedLayer {
  return { versionId: `v${String(version)}`, clientId, version, body: themeBody, assets: [] };
}

function deps(state: {
  layers?: PublishedLayers;
  assets?: Record<string, { mime: string; bytes: Buffer }>;
  origin?: string | undefined;
}): ServeBrandDeps & { reads: string[] } {
  const reads: string[] = [];
  return {
    reads,
    origin: 'origin' in state ? state.origin : ORIGIN,
    findTenant: (name) => {
      reads.push(`tenant:${name}`);
      return Promise.resolve(name === TENANT.name ? TENANT : null);
    },
    readAsset: (tenantId, sha) => {
      reads.push(`asset:${tenantId}:${sha}`);
      return Promise.resolve(state.assets?.[sha] ?? null);
    },
    readPublished: (tenantId, client) => {
      reads.push(`layers:${tenantId}:${client ?? ''}`);
      return Promise.resolve(state.layers ?? { tenant: null, client: null });
    },
  };
}

function pageStylesheet(layers: PublishedLayers): string {
  const built = buildBranding({
    tenantName: TENANT.name,
    origin: ORIGIN,
    layers: [
      ...(layers.client === null ? [] : [{ name: 'client' as const, layer: layers.client }]),
      ...(layers.tenant === null ? [] : [{ name: 'tenant' as const, layer: layers.tenant }]),
    ],
  });
  return built.branding?.stylesheetUrl ?? '';
}

function requestFor(url: string): { tenant: string; client: string | null; file: string } {
  const segments = url.split('/');
  const file = segments[segments.length - 1] ?? '';
  const at = segments.indexOf('c');
  return { tenant: 'acme', client: at === -1 ? null : (segments[at + 1] ?? null), file };
}

describe('serveBrand images', () => {
  const assets = { [PNG_SHA]: { mime: 'image/png', bytes: PNG } };

  it('serves bytes under the stored mime with the hash as its etag', async () => {
    const answer = await serveBrand(deps({ assets }), {
      tenant: 'acme',
      client: null,
      file: `${PNG_SHA}.png`,
    });
    expect(answer).toEqual({ contentType: 'image/png', bytes: PNG, etag: `"${PNG_SHA}"` });
  });

  it('refuses an extension that is not the stored type', async () => {
    for (const extension of ['jpg', 'webp', 'css']) {
      const answer = await serveBrand(deps({ assets }), {
        tenant: 'acme',
        client: null,
        file: `${PNG_SHA}.${extension}`,
      });
      expect(answer).toBeNull();
    }
  });

  it('refuses a name that is not a lowercase sha256 and an extension without a read', async () => {
    const w = deps({ assets });
    const files = [
      `${PNG_SHA.toUpperCase()}.png`,
      `${PNG_SHA.slice(1)}.png`,
      `${PNG_SHA}a.png`,
      `${PNG_SHA}.svg`,
      `${PNG_SHA}.png.css`,
      PNG_SHA,
      `..%2f${PNG_SHA}.png`,
      '',
    ];
    for (const file of files)
      expect(await serveBrand(w, { tenant: 'acme', client: null, file })).toBeNull();
    expect(w.reads).toEqual([]);
  });

  it('answers nothing for an unknown tenant and nothing for a hash it does not hold', async () => {
    expect(
      await serveBrand(deps({ assets }), { tenant: 'nope', client: null, file: `${PNG_SHA}.png` }),
    ).toBeNull();
    expect(
      await serveBrand(deps({}), { tenant: 'acme', client: null, file: `${PNG_SHA}.png` }),
    ).toBeNull();
  });

  it('refuses a client segment on an image', async () => {
    const answer = await serveBrand(deps({ assets }), {
      tenant: 'acme',
      client: CLIENT_ROW,
      file: `${PNG_SHA}.png`,
    });
    expect(answer).toBeNull();
  });
});

describe('serveBrand stylesheets', () => {
  const tenantLayer = layer(body('.logo{display:none}'), null);
  const clientLayer = layer(body('.brand{color:inherit}'), CLIENT_ROW, 2);

  it('serves the stylesheet the page links, bytes hashing to the URL', async () => {
    const layers = { tenant: tenantLayer, client: null };
    const url = pageStylesheet(layers);
    const request = requestFor(url);
    const answer = await serveBrand(deps({ layers }), request);
    expect(answer?.contentType).toBe('text/css; charset=utf-8');
    expect(sha256Hex(answer?.bytes ?? '')).toBe(parseBrandFile(request.file)?.sha256);
    expect(answer?.bytes.toString()).toContain('.logo{display:none}');
  });

  it('serves a client-over-tenant stylesheet only under the client that makes it', async () => {
    const layers = { tenant: tenantLayer, client: clientLayer };
    const url = pageStylesheet(layers);
    expect(url).toContain(`/brand/c/${CLIENT_ROW}/`);
    const request = requestFor(url);
    const answer = await serveBrand(deps({ layers }), request);
    expect(answer?.bytes.toString()).toContain('.brand{color:inherit}');
    const withoutClient = await serveBrand(
      deps({ layers: { tenant: tenantLayer, client: null } }),
      {
        ...request,
        client: null,
      },
    );
    expect(withoutClient).toBeNull();
  });

  it('is another replica answering for a page the first one rendered: only the layers decide', async () => {
    const layers = { tenant: tenantLayer, client: clientLayer };
    const url = pageStylesheet(layers);
    const second = deps({ layers });
    expect((await serveBrand(second, requestFor(url)))?.bytes).toBeInstanceOf(Buffer);
  });

  it('answers nothing for the previous hash once a new version is published', async () => {
    const before = pageStylesheet({ tenant: tenantLayer, client: null });
    const after = { tenant: layer(body('.logo{display:block}'), null, 2), client: null };
    expect(await serveBrand(deps({ layers: after }), requestFor(before))).toBeNull();
    expect(
      await serveBrand(deps({ layers: after }), requestFor(pageStylesheet(after))),
    ).not.toBeNull();
  });

  it('answers nothing for an unknown hash, a client of no theme, or without an origin', async () => {
    const layers = { tenant: tenantLayer, client: null };
    const url = pageStylesheet(layers);
    const wrong = { ...requestFor(url), file: `${'0'.repeat(64)}.css` };
    expect(await serveBrand(deps({ layers }), wrong)).toBeNull();
    expect(await serveBrand(deps({ layers, origin: undefined }), requestFor(url))).toBeNull();
    expect(await serveBrand(deps({}), requestFor(url))).toBeNull();
  });

  it('refuses a client segment that is not a row id without a read', async () => {
    const w = deps({ layers: { tenant: tenantLayer, client: null } });
    const file = requestFor(pageStylesheet({ tenant: tenantLayer, client: null })).file;
    for (const client of ['app-1', '../x', CLIENT_ROW.toUpperCase(), '']) {
      expect(await serveBrand(w, { tenant: 'acme', client, file })).toBeNull();
    }
    expect(w.reads).toEqual([]);
  });

  it('never serves a stylesheet the check refuses, even from a stored row', async () => {
    const hostile = '@import url(https://evil.example/x.css);.logo{display:none}';
    const layers = { tenant: layer(body(hostile), null), client: null };
    const hash = sha256Hex(brandingCss(tokensCss(body(hostile).tokens), hostile));
    const served = await serveBrand(deps({ layers }), {
      tenant: 'acme',
      client: null,
      file: `${hash}.css`,
    });
    expect(served).toBeNull();
    const own = await serveBrand(deps({ layers }), requestFor(pageStylesheet(layers)));
    expect(own?.bytes.toString()).not.toContain('evil.example');
  });
});

describe('the url shapes', () => {
  it('give a stylesheet and an image paths the parser reads back', () => {
    expect(parseBrandFile(`${PNG_SHA}.webp`)).toEqual({
      kind: 'image',
      sha256: PNG_SHA,
      extension: 'webp',
    });
    expect(parseBrandFile(`${PNG_SHA}.css`)).toEqual({ kind: 'css', sha256: PNG_SHA });
    expect(assetPath('acme', PNG_SHA, 'image/png')).toMatch(/\.png$/u);
    expect(stylesheetPath('acme', 'a{}', CLIENT_ROW)).toBe(
      `/tenants/acme/brand/c/${CLIENT_ROW}/${sha256Hex('a{}')}.css`,
    );
  });
});
