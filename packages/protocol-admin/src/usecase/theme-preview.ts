import { type PreviewThemeQuery } from '@odudu/contracts/admin';
import { type TenantScopedDatabase } from '@odudu/db';
import { assetRepository, buildBranding, themeRepository } from '@odudu/domain-theme';
import {
  inlinePreview,
  MAX_PREVIEW_BYTES,
  withBranding,
  type InlinedPreview,
  type PageKind,
  type PreviewRender,
} from '@odudu/kernel';
import { imageIdsOf, dataUri, layerOf, usedImages } from '#/service/theme-preview';
import { clientExists, type ThemeTarget } from '#/usecase/theme';

// The page shown when none is asked for.
const DEFAULT_KIND: PageKind = 'sign-in';

export interface ThemePreviewDeps {
  // Every page kind rendered by its own package's renderer with sample values.
  readonly pages: Readonly<Record<PageKind, PreviewRender>>;
}

export type PreviewOutcome =
  | { kind: 'not_found' }
  | { kind: 'too_large'; bytes: number }
  | { kind: 'rendered'; inlined: InlinedPreview; fallbacks: PageKind[] };

// The scope rendered as its next publish would be, over what sits below it: a
// client's draft over its tenant's published theme, a tenant's over the
// default. A scope with no draft shows its own published theme. At most six
// statements whatever the theme names: the client, the draft, the published
// theme, the tenant's, the images' sizes and, once they fit, their bytes.
export async function previewTheme(
  tx: TenantScopedDatabase,
  deps: ThemePreviewDeps,
  target: ThemeTarget,
  input: { query: PreviewThemeQuery; origin: string },
): Promise<PreviewOutcome> {
  if (!(await clientExists(tx, target))) return { kind: 'not_found' };
  const themes = themeRepository(tx);
  const isClient = target.clientRowId !== null;
  const scope = { tenantId: target.tenantId, clientId: target.clientRowId };
  // What the scope shows once published: its draft, or with none its own
  // published version.
  const own = (await themes.draft(scope)) ?? (await themes.published(scope));
  const tenantPublished = isClient
    ? await themes.published({ tenantId: target.tenantId, clientId: null })
    : null;
  const records = [own, tenantPublished].filter((record) => record !== null);

  const images = await assetRepository(tx).sizes(target.tenantId, imageIdsOf(records));
  const layers: { name: 'client' | 'tenant'; layer: ReturnType<typeof layerOf> }[] = [];
  if (own !== null) {
    layers.push({ name: isClient ? 'client' : 'tenant', layer: layerOf(own, images) });
  }
  if (tenantPublished !== null && isClient) {
    layers.push({ name: 'tenant', layer: layerOf(tenantPublished, images) });
  }
  const built = buildBranding({ tenantName: target.tenantName, origin: input.origin, layers });

  const fallbacks = new Set<PageKind>(built.refused.map((entry) => entry.kind));
  const locale = withBranding(
    {
      tag: 'en',
      dir: 'ltr',
      ...(input.query.scheme === undefined ? {} : { theme: input.query.scheme }),
    },
    built.branding,
    (kind) => {
      fallbacks.add(kind);
    },
  );
  const render = deps.pages[input.query.kind ?? DEFAULT_KIND];
  const page = render(target.tenantName, locale);

  const { used, weight } = usedImages(target.tenantName, images, [page.html, built.css]);
  const bytes = weight + built.css.length;
  if (bytes > MAX_PREVIEW_BYTES) return { kind: 'too_large', bytes };

  const held = await assetRepository(tx).bytesOf(
    target.tenantId,
    used.map((image) => image.id),
  );
  const byId = new Map(held.map((image) => [image.id, image]));
  const uris = new Map<string, string>();
  for (const image of used) {
    const stored = byId.get(image.id);
    if (stored !== undefined) uris.set(image.path, dataUri(stored.mime, stored.bytes));
  }
  return {
    kind: 'rendered',
    fallbacks: [...fallbacks],
    inlined: inlinePreview(page, {
      stylesheetUrl: built.branding?.stylesheetUrl ?? null,
      css: built.css,
      images: uris,
    }),
  };
}
