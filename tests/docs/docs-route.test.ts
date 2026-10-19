import { describe, expect, it } from 'vitest';
import { configReference } from '../../packages/kernel/src/docs.js';
import { loadDocument } from './markdown.js';

// The documentation the image serves under /docs is documented where an
// operator looks for it: the switch and the directory are loader keys, and the
// README says where the site must sit and what a path prefix does to it.
const README = loadDocument('README.md').lines.join('\n');

describe('the documentation route as documented', () => {
  it('has its switch and its directory in the loader, on by default', () => {
    const rows = new Map(configReference().map((row) => [row.name, row]));
    expect(rows.get('ODUDU_DOCS')?.default).toBe('true');
    expect(rows.get('ODUDU_DOCS_DIR')?.default).toBe('/app/docs');
  });

  it('is explained in the README under both variables', () => {
    expect(README).toContain('`ODUDU_DOCS=false`');
    expect(README).toContain('`ODUDU_DOCS_DIR`');
    expect(README).toContain('noindex');
  });

  it('says a reverse proxy mounting the server under a path prefix is unsupported', () => {
    expect(README).toMatch(/under a path prefix is not\s+supported/u);
    expect(README).toContain('root of the address `ODUDU_PUBLIC_BASE_URL` names');
  });
});
