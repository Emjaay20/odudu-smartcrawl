import { type ThemeBody } from '#/service/body';

export interface ThemeScope {
  tenantId: string;
  clientId: string | null;
}

export type ThemeState = 'draft' | 'published' | 'archived';

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
