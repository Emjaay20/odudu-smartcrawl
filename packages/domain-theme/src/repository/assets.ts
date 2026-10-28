import { type TenantScopedDatabase } from '@odudu/db';
import { newId } from '@odudu/kernel';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { themeAssets } from '#/schema/theme-assets';
import { themeVersionAssets } from '#/schema/theme-version-assets';
import { themeVersions } from '#/schema/theme-versions';
import { type AssetRecord, type AssetRef } from '#/service/theme-body';

export interface NewAsset {
  tenantId: string;
  sha256: string;
  mime: string;
  width: number;
  height: number;
  bytes: Buffer;
  // What the tenant's stored images, this one included, may total.
  tenantCapBytes: number;
}

const REF = {
  id: themeAssets.id,
  sha256: themeAssets.sha256,
  mime: themeAssets.mime,
  width: themeAssets.width,
  height: themeAssets.height,
};

export function assetRepository(tx: TenantScopedDatabase) {
  async function bytesUsed(tenantId: string): Promise<number> {
    const [row] = await tx
      .select({ used: sql<number>`coalesce(sum(octet_length(${themeAssets.bytes})), 0)::float8` })
      .from(themeAssets)
      .where(eq(themeAssets.tenantId, tenantId));
    return row?.used ?? 0;
  }

  return {
    // Storing an image the tenant already holds returns the stored one and
    // counts nothing against the cap.
    async put(asset: NewAsset): Promise<AssetRef | 'over_cap'> {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${asset.tenantId}, 0))`);
      const [held] = await tx
        .select(REF)
        .from(themeAssets)
        .where(and(eq(themeAssets.tenantId, asset.tenantId), eq(themeAssets.sha256, asset.sha256)));
      if (held !== undefined) return held;
      if ((await bytesUsed(asset.tenantId)) + asset.bytes.length > asset.tenantCapBytes) {
        return 'over_cap';
      }
      const [stored] = await tx
        .insert(themeAssets)
        .values({
          id: newId(),
          tenantId: asset.tenantId,
          sha256: asset.sha256,
          mime: asset.mime,
          width: asset.width,
          height: asset.height,
          bytes: asset.bytes,
        })
        .returning(REF);
      if (stored === undefined) throw new Error('asset insert returned no row');
      return stored;
    },

    // The only read of an image's bytes.
    async get(tenantId: string, sha256: string): Promise<AssetRecord | null> {
      const [row] = await tx
        .select()
        .from(themeAssets)
        .where(and(eq(themeAssets.tenantId, tenantId), eq(themeAssets.sha256, sha256)));
      if (row === undefined) return null;
      return {
        id: row.id,
        tenantId: row.tenantId,
        sha256: row.sha256,
        mime: row.mime,
        width: row.width,
        height: row.height,
        bytes: row.bytes,
      };
    },

    // The image a published version of the tenant names, by its hash: what a
    // public URL may serve. A draft's or archived version's image, another
    // tenant's and a deleted one select nothing. One indexed lookup through
    // the content key and the asset key, however many versions name it.
    async getPublished(
      tenantId: string,
      sha256: string,
    ): Promise<{ mime: string; bytes: Buffer } | null> {
      const [row] = await tx
        .select({ mime: themeAssets.mime, bytes: themeAssets.bytes })
        .from(themeAssets)
        .innerJoin(
          themeVersionAssets,
          and(
            eq(themeVersionAssets.assetId, themeAssets.id),
            eq(themeVersionAssets.tenantId, themeAssets.tenantId),
          ),
        )
        .innerJoin(themeVersions, eq(themeVersions.id, themeVersionAssets.versionId))
        .where(
          and(
            eq(themeAssets.tenantId, tenantId),
            eq(themeAssets.sha256, sha256),
            eq(themeVersions.tenantId, tenantId),
            eq(themeVersions.state, 'published'),
          ),
        )
        .limit(1);
      return row ?? null;
    },

    // Drafts and published versions that name the asset in a slot; archived
    // versions are not counted.
    async referencedBy(tenantId: string, assetId: string): Promise<number> {
      const [row] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(themeVersionAssets)
        .innerJoin(themeVersions, eq(themeVersions.id, themeVersionAssets.versionId))
        .where(
          and(
            eq(themeVersionAssets.tenantId, tenantId),
            eq(themeVersionAssets.assetId, assetId),
            inArray(themeVersions.state, ['draft', 'published']),
          ),
        );
      return row?.count ?? 0;
    },

    async delete(tenantId: string, assetId: string): Promise<void> {
      await tx
        .delete(themeAssets)
        .where(and(eq(themeAssets.tenantId, tenantId), eq(themeAssets.id, assetId)));
    },

    bytesUsed,
  };
}
