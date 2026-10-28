import { type TenantScopedDatabase } from '@odudu/db';
import { and, eq, isNull, or, sql, type SQL } from 'drizzle-orm';
import { themeVersions } from '#/schema/theme-versions';
import {
  type PublishedAsset,
  type PublishedLayer,
  type PublishedLayers,
} from '#/service/theme-body';

export function publishedThemeRepository(tx: TenantScopedDatabase) {
  return {
    // The tenant's and the client's published rows and the images they
    // name, in one statement served by the scope index and the asset keys.
    // `oauthClientId` is the OAuth client_id a page knows; an id that names
    // no client of the tenant selects no client row, exactly as a client
    // with no theme does.
    async forRender(tenantId: string, oauthClientId: string | null): Promise<PublishedLayers> {
      const ownClient: SQL | undefined =
        oauthClientId === null
          ? undefined
          : eq(
              themeVersions.clientId,
              sql`(select c.id from clients c where c.tenant_id = ${tenantId} and c.client_id = ${oauthClientId})`,
            );
      // The outer table is named in the text: drizzle drops the qualifier from a
      // column of a single-table select, which would bind to the inner tables.
      const assets = sql<PublishedAsset[]>`(
        select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'sha256', a.sha256, 'mime', a.mime)), '[]'::jsonb)
          from theme_version_assets va
          join theme_assets a on a.id = va.asset_id and a.tenant_id = va.tenant_id
         where va.version_id = theme_versions.id and va.tenant_id = ${tenantId})`;
      const rows = await tx
        .select({
          id: themeVersions.id,
          clientId: themeVersions.clientId,
          version: themeVersions.version,
          body: themeVersions.body,
          assets,
        })
        .from(themeVersions)
        .where(
          and(
            eq(themeVersions.tenantId, tenantId),
            eq(themeVersions.state, 'published'),
            ownClient === undefined
              ? isNull(themeVersions.clientId)
              : or(isNull(themeVersions.clientId), ownClient),
          ),
        );
      const layer = (row: (typeof rows)[number] | undefined): PublishedLayer | null =>
        row === undefined
          ? null
          : { versionId: row.id, version: row.version, body: row.body, assets: row.assets };
      return {
        tenant: layer(rows.find((row) => row.clientId === null)),
        client: layer(rows.find((row) => row.clientId !== null)),
      };
    },
  };
}
