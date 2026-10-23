import { describe, expect, it } from 'vitest';
import { configReference } from '../../packages/kernel/src/docs.js';
import { loadDocument } from './markdown.js';

// The documentation the image serves under /docs is documented where an
// operator looks for it: the switch and the directory are loader keys, and the
// transcript and the deploying page say where the site must sit and what a
// path prefix does to it.
const PAGES = [
  'apps/docs/content/en/reference/transcripts/request-paths/the-documentation-under-docs.md',
  'apps/docs/content/en/operating/deploying.md',
]
  .map((page) => loadDocument(page).lines.join('\n'))
  .join('\n');

describe('the documentation route as documented', () => {
  it('has its switch and its directory in the loader, on by default', () => {
    const rows = new Map(configReference().map((row) => [row.name, row]));
    expect(rows.get('ODUDU_DOCS')?.default).toBe('true');
    expect(rows.get('ODUDU_DOCS_DIR')?.default).toBe('/app/docs');
  });

  it('is explained on the pages under both variables', () => {
    expect(PAGES).toContain('`ODUDU_DOCS=false`');
    expect(PAGES).toContain('`ODUDU_DOCS_DIR`');
    expect(PAGES).toContain('noindex');
  });

  it('says a reverse proxy mounting the server under a path prefix is unsupported', () => {
    expect(PAGES).toMatch(/under a path prefix is not\s+supported/u);
    expect(PAGES).toContain('root of the address `ODUDU_PUBLIC_BASE_URL` names');
  });
});
