import {
  listThemeVersionsResponseSchema,
  publishThemeResponseSchema,
  themeAssetSchema,
  themeViewSchema,
  type ListThemeVersionsResponse,
  type PublishThemeResponse,
  type PutThemeRequest,
  type ThemeAsset,
  type ThemeView,
} from '@odudu/contracts/admin';
import { adminCall, nothing, segment } from '#/shared/adapter/route';
import { GATEWAY_BASE, type Gateway, type GatewayResult } from '#/shared/transport/gateway';
import {
  ASSET_PARTS,
  ifMatchOf,
  tagOf,
  themeParts,
  type PageKind,
  type Scheme,
  type ThemeScope,
} from '#/features/branding/service';

// A theme with no draft has no ETag; every answer that carries a view says so
// the same way, so a section can always save against what it was read with.
function tagged<T>(result: GatewayResult<T>): GatewayResult<T> {
  return result.ok ? { ...result, etag: tagOf(result.etag) } : result;
}

export async function readTheme(
  gateway: Gateway,
  tenant: string,
  scope: ThemeScope,
): Promise<GatewayResult<ThemeView>> {
  return tagged(
    await adminCall(gateway, 'GET', tenant, themeParts(scope), { schema: themeViewSchema }),
  );
}

// The whole draft, replaced; with no draft yet the request carries no If-Match.
export async function putTheme(
  gateway: Gateway,
  tenant: string,
  scope: ThemeScope,
  body: PutThemeRequest,
  tag: string,
): Promise<GatewayResult<ThemeView>> {
  const ifMatch = ifMatchOf(tag);
  return tagged(
    await adminCall(gateway, 'PUT', tenant, themeParts(scope), {
      body,
      ...(ifMatch === undefined ? {} : { ifMatch }),
      schema: themeViewSchema,
    }),
  );
}

export async function publishTheme(
  gateway: Gateway,
  tenant: string,
  scope: ThemeScope,
  tag: string,
): Promise<GatewayResult<PublishThemeResponse>> {
  const ifMatch = ifMatchOf(tag);
  return tagged(
    await adminCall(gateway, 'POST', tenant, [...themeParts(scope), 'publish'], {
      ...(ifMatch === undefined ? {} : { ifMatch }),
      schema: publishThemeResponseSchema,
    }),
  );
}

export async function resetTheme(
  gateway: Gateway,
  tenant: string,
  scope: ThemeScope,
): Promise<GatewayResult<ThemeView>> {
  return tagged(
    await adminCall(gateway, 'DELETE', tenant, themeParts(scope), { schema: themeViewSchema }),
  );
}

export function readVersions(
  gateway: Gateway,
  tenant: string,
  scope: ThemeScope,
): Promise<GatewayResult<ListThemeVersionsResponse>> {
  return adminCall(gateway, 'GET', tenant, [...themeParts(scope), 'versions'], {
    schema: listThemeVersionsResponseSchema,
  });
}

export async function restoreVersion(
  gateway: Gateway,
  tenant: string,
  scope: ThemeScope,
  versionId: string,
): Promise<GatewayResult<ThemeView>> {
  return tagged(
    await adminCall(
      gateway,
      'POST',
      tenant,
      [...themeParts(scope), 'versions', versionId, 'restore'],
      { schema: themeViewSchema },
    ),
  );
}

// The image is the request body, and `kind` says which slot it is for.
export function uploadAsset(
  gateway: Gateway,
  tenant: string,
  kind: string,
  file: Blob,
): Promise<GatewayResult<ThemeAsset>> {
  return adminCall(gateway, 'POST', tenant, ASSET_PARTS, {
    query: new URLSearchParams({ kind }),
    file,
    schema: themeAssetSchema,
  });
}

export function deleteAsset(
  gateway: Gateway,
  tenant: string,
  assetId: string,
): Promise<GatewayResult<undefined>> {
  return adminCall(gateway, 'DELETE', tenant, [...ASSET_PARTS, assetId], { schema: nothing });
}

// The page the frame shows: the real renderer's answer for the saved draft,
// fetched by the frame itself under the session cookie.
export function previewSource(
  tenant: string,
  scope: ThemeScope,
  choice: { kind: PageKind; scheme: Scheme },
): string {
  const path = ['admin', 'tenants', tenant, ...themeParts(scope), 'preview'].map(segment).join('/');
  return `${GATEWAY_BASE}${path}?${new URLSearchParams(choice).toString()}`;
}
