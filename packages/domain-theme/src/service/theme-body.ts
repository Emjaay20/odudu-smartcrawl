export interface ThemeScope {
  tenantId: string;
  clientId: string | null;
}

export type ThemeState = 'draft' | 'published' | 'archived';

// A slot's image is named by the id `assetRepository.put` returned; the
// repository finds the versions that use an asset by this key.
export interface ThemeAssetSlot {
  assetId: string;
  [key: string]: unknown;
}

export interface ThemeBody {
  tokens: unknown;
  stylesheet: string | null;
  templates: Record<string, string>;
  assets: Record<string, ThemeAssetSlot>;
}

export interface ThemeRecord {
  id: string;
  scope: ThemeScope;
  state: ThemeState;
  // Zero for a draft, which has not been published.
  version: number;
  // Derived from the stored body, so it changes exactly when the body does.
  etag: string;
  body: ThemeBody;
  publishedAt: Date | null;
}

export interface AssetRef {
  id: string;
  sha256: string;
  mime: string;
  width: number;
  height: number;
}

export interface AssetRecord extends AssetRef {
  tenantId: string;
  bytes: Buffer;
}

// The most versions (published and archived) a scope keeps.
export const THEME_VERSION_LIMIT = 20;
