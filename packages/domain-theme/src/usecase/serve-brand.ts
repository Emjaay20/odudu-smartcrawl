import { type PublishedLayers } from '#/service/theme-body';
import { buildBranding } from '#/service/build-branding';
import { assetExtension, isClientRowId, parseBrandFile, sha256Hex } from '#/service/branding-urls';

export interface ServeBrandDeps {
  // The origin pages are served from; a theme is only applied under one, so
  // without it no stylesheet is served.
  origin: string | undefined;
  findTenant(name: string): Promise<{ id: string; name: string } | null>;
  readAsset(tenantId: string, sha256: string): Promise<{ mime: string; bytes: Buffer } | null>;
  readPublished(tenantId: string, clientRowId: string | null): Promise<PublishedLayers>;
}

export interface BrandRequest {
  tenant: string;
  // The client row id segment of a hashed stylesheet's URL, if the URL had one.
  client: string | null;
  // The last path segment: a hash and an extension.
  file: string;
}

export interface BrandContent {
  contentType: string;
  bytes: Buffer;
  // Strong and quoted; the hash the URL names.
  etag: string;
}

// What a brand URL answers, or null for every reason it answers nothing, so
// a missing hash, another tenant's and an unpublished one look alike. A
// stylesheet is rebuilt from the published layers its URL names and served
// only when its hash is the requested one: state comes from the database,
// so any replica answers for any page, and a hash replaced by a publish
// answers null (ADR 0046). The build also checks the stylesheet again.
export async function serveBrand(
  deps: ServeBrandDeps,
  request: BrandRequest,
): Promise<BrandContent | null> {
  const file = parseBrandFile(request.file);
  if (file === null) return null;
  if (request.client !== null && (file.kind !== 'css' || !isClientRowId(request.client))) {
    return null;
  }
  const tenant = await deps.findTenant(request.tenant);
  if (tenant === null) return null;
  const etag = `"${file.sha256}"`;

  if (file.kind === 'image') {
    const asset = await deps.readAsset(tenant.id, file.sha256);
    if (asset === null || assetExtension(asset.mime) !== file.extension) return null;
    return { contentType: asset.mime, bytes: asset.bytes, etag };
  }

  if (deps.origin === undefined) return null;
  const layers = await deps.readPublished(tenant.id, request.client);
  const built = buildBranding({
    tenantName: tenant.name,
    origin: deps.origin,
    layers: [
      ...(layers.client === null ? [] : [{ name: 'client' as const, layer: layers.client }]),
      ...(layers.tenant === null ? [] : [{ name: 'tenant' as const, layer: layers.tenant }]),
    ],
  });
  if (built.css === '' || sha256Hex(built.css) !== file.sha256) return null;
  return { contentType: 'text/css; charset=utf-8', bytes: Buffer.from(built.css), etag };
}
