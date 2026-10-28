import { createHash } from 'node:crypto';

const EXTENSION: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

// Where a tenant's image is served: its content hash, so the URL changes
// when the bytes do. Null for a type no upload produces.
export function assetPath(tenantName: string, sha256: string, mime: string): string | null {
  const extension = EXTENSION[mime];
  return extension === undefined
    ? null
    : `/tenants/${encodeURIComponent(tenantName)}/brand/${sha256}.${extension}`;
}

// The hashed stylesheet of a resolved theme.
export function stylesheetPath(tenantName: string, css: string): string {
  const hash = createHash('sha256').update(css).digest('hex');
  return `/tenants/${encodeURIComponent(tenantName)}/brand/${hash}.css`;
}
