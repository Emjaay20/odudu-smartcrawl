import { type TenantScopedDatabase } from '@odudu/db';
import { newId } from '@odudu/kernel';
import { and, desc, eq, inArray, isNull, sql, type SQL } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { themeVersionAssets } from '#/schema/theme-version-assets';
import { themeVersions } from '#/schema/theme-versions';
import { assetIdsOf, type ThemeBody } from '#/service/body';
import {
  THEME_VERSION_LIMIT,
  type ThemeRecord,
  type ThemeScope,
  type ThemeState,
} from '#/service/theme-body';

export class NoDraftError extends Error {
  constructor() {
    super('there is no draft to publish');
    this.name = 'NoDraftError';
  }
}

export class VersionNotFoundError extends Error {
  constructor() {
    super('no such version in this scope');
    this.name = 'VersionNotFoundError';
  }
}

type Row = typeof themeVersions.$inferSelect;

function etagOf(body: ThemeBody): string {
  return createHash('sha256').update(JSON.stringify(body)).digest('hex');
}

function toRecord(row: Row): ThemeRecord {
  return {
    id: row.id,
    scope: { tenantId: row.tenantId, clientId: row.clientId },
    state: row.state,
    version: row.version,
    etag: etagOf(row.body),
    body: row.body,
    publishedAt: row.publishedAt,
  };
}

function inScope(scope: ThemeScope): SQL | undefined {
  return and(
    eq(themeVersions.tenantId, scope.tenantId),
    scope.clientId === null
      ? isNull(themeVersions.clientId)
      : eq(themeVersions.clientId, scope.clientId),
  );
}

function inState(scope: ThemeScope, state: ThemeState): SQL | undefined {
  return and(inScope(scope), eq(themeVersions.state, state));
}

function first(rows: Row[]): ThemeRecord | null {
  const row = rows[0];
  return row === undefined ? null : toRecord(row);
}

function only(rows: Row[]): ThemeRecord {
  const record = first(rows);
  if (record === null) throw new Error('theme write returned no row');
  return record;
}

export function themeRepository(tx: TenantScopedDatabase) {
  // Held until the transaction ends, so a second writer of the scope waits
  // and then reads what the first left.
  async function lockScope(scope: ThemeScope): Promise<void> {
    const key = `theme:${scope.tenantId}:${scope.clientId ?? ''}`;
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`);
  }

  async function lockedDraft(scope: ThemeScope): Promise<Row | undefined> {
    const [row] = await tx
      .select()
      .from(themeVersions)
      .where(inState(scope, 'draft'))
      .for('update');
    return row;
  }

  async function nextVersion(scope: ThemeScope): Promise<number> {
    const [row] = await tx
      .select({ latest: sql<number>`coalesce(max(${themeVersions.version}), 0)::int` })
      .from(themeVersions)
      .where(inScope(scope));
    return (row?.latest ?? 0) + 1;
  }

  async function archivePublished(scope: ThemeScope): Promise<void> {
    await tx.update(themeVersions).set({ state: 'archived' }).where(inState(scope, 'published'));
  }

  // The published row counts toward the limit, so it keeps the newest
  // `limit - 1` archived rows.
  async function prune(scope: ThemeScope): Promise<void> {
    const stale = await tx
      .select({ id: themeVersions.id })
      .from(themeVersions)
      .where(inState(scope, 'archived'))
      .orderBy(desc(themeVersions.version))
      .offset(THEME_VERSION_LIMIT - 1);
    if (stale.length === 0) return;
    await tx.delete(themeVersions).where(
      inArray(
        themeVersions.id,
        stale.map((row) => row.id),
      ),
    );
  }

  async function recordAssets(row: Row): Promise<ThemeRecord> {
    await tx.delete(themeVersionAssets).where(eq(themeVersionAssets.versionId, row.id));
    const assetIds = assetIdsOf(row.body.assets);
    if (assetIds.length > 0) {
      await tx
        .insert(themeVersionAssets)
        .values(
          assetIds.map((assetId) => ({ versionId: row.id, tenantId: row.tenantId, assetId })),
        );
    }
    return toRecord(row);
  }

  return {
    async draft(scope: ThemeScope): Promise<ThemeRecord | null> {
      return first(await tx.select().from(themeVersions).where(inState(scope, 'draft')));
    },

    async published(scope: ThemeScope): Promise<ThemeRecord | null> {
      return first(await tx.select().from(themeVersions).where(inState(scope, 'published')));
    },

    // `ifMatch` is the etag of the draft being replaced; null states that
    // there is no draft yet, so a save that would replace one it never saw is
    // refused.
    async saveDraft(
      scope: ThemeScope,
      body: ThemeBody,
      ifMatch: string | null,
    ): Promise<ThemeRecord | 'precondition_failed'> {
      const current = await lockedDraft(scope);
      if (current === undefined) {
        if (ifMatch !== null) return 'precondition_failed';
        const inserted = await tx
          .insert(themeVersions)
          .values({
            id: newId(),
            tenantId: scope.tenantId,
            clientId: scope.clientId,
            state: 'draft',
            version: 0,
            body,
          })
          .onConflictDoNothing()
          .returning();
        const created = inserted[0];
        return created === undefined ? 'precondition_failed' : recordAssets(created);
      }
      if (ifMatch !== etagOf(current.body)) return 'precondition_failed';
      const [updated] = await tx
        .update(themeVersions)
        .set({ body })
        .where(eq(themeVersions.id, current.id))
        .returning();
      if (updated === undefined) throw new Error('theme write returned no row');
      return recordAssets(updated);
    },

    async publish(scope: ThemeScope): Promise<ThemeRecord> {
      await lockScope(scope);
      const draft = await lockedDraft(scope);
      if (draft === undefined) throw new NoDraftError();
      const version = await nextVersion(scope);
      await archivePublished(scope);
      const published = only(
        await tx
          .update(themeVersions)
          .set({ state: 'published', version, publishedAt: sql`now()` })
          .where(eq(themeVersions.id, draft.id))
          .returning(),
      );
      await prune(scope);
      return published;
    },

    async versions(scope: ThemeScope, limit: number): Promise<ThemeRecord[]> {
      const rows = await tx
        .select()
        .from(themeVersions)
        .where(and(inScope(scope), inArray(themeVersions.state, ['published', 'archived'])))
        .orderBy(desc(themeVersions.version))
        .limit(limit);
      return rows.map(toRecord);
    },

    // Publishes a copy of an earlier version as the next one, leaving the
    // draft and the version it was copied from where they are.
    async restore(scope: ThemeScope, versionId: string): Promise<ThemeRecord> {
      await lockScope(scope);
      const [source] = await tx
        .select()
        .from(themeVersions)
        .where(
          and(
            inScope(scope),
            eq(themeVersions.id, versionId),
            inArray(themeVersions.state, ['published', 'archived']),
          ),
        );
      if (source === undefined) throw new VersionNotFoundError();
      const version = await nextVersion(scope);
      await archivePublished(scope);
      const [inserted] = await tx
        .insert(themeVersions)
        .values({
          id: newId(),
          tenantId: scope.tenantId,
          clientId: scope.clientId,
          state: 'published',
          version,
          body: source.body,
          publishedAt: sql`now()`,
        })
        .returning();
      if (inserted === undefined) throw new Error('theme write returned no row');
      const restored = await recordAssets(inserted);
      await prune(scope);
      return restored;
    },

    async reset(scope: ThemeScope): Promise<void> {
      await lockScope(scope);
      await archivePublished(scope);
      await tx.delete(themeVersions).where(inState(scope, 'draft'));
    },
  };
}
