import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DOCS_ROOT } from '#docs/tests/support/dist.ts';

const page = (name: string): string =>
  readFileSync(path.join(DOCS_ROOT, 'content/en/introduction', name), 'utf8');

describe('the introduction', () => {
  it('says nothing of where the name comes from, on any introduction page', () => {
    for (const name of ['index.md', 'odudu.md', 'compare.md']) {
      expect(page(name), name).not.toMatch(/Ibibio|Akwa Ibom|coined/iu);
    }
  });

  it('leaves the origin out of the repository front door and the brand notes', () => {
    for (const file of ['README.md', 'brand/README.md']) {
      const text = readFileSync(path.join(DOCS_ROOT, '../..', file), 'utf8');
      expect(text, file).not.toMatch(/Ibibio|Akwa Ibom|coined/iu);
    }
  });

  it('keeps the page about the name, saying what an identity provider holds', () => {
    expect(page('odudu.md')).toContain('# The name Odudu');
    expect(page('odudu.md')).toContain('holds authority on behalf of the people who run it');
  });

  it('compares with Keycloak, Ory, Zitadel and Authentik without asserting facts about them', () => {
    const text = page('compare.md');
    for (const name of ['Keycloak', 'Ory', 'Zitadel', 'Authentik']) {
      expect(text, name).toMatch(new RegExp(`^\\| ${name}\\s*\\|.*see their documentation`, 'imu'));
    }
  });

  it('says what Odudu is not', () => {
    const text = page('compare.md');
    expect(text).toMatch(/release candidate/iu);
    expect(text).toMatch(/security review/iu);
    expect(text).toMatch(/one instance/iu);
  });

  it('points every capability it lists at a page that shows it', () => {
    const rows = page('compare.md')
      .split('\n')
      .filter((line) => /^\| (?!Keycloak|Ory|Zitadel|Authentik|-)/u.test(line))
      .filter((line) => !/^\| (Feature|Project)/u.test(line));
    expect(rows.length).toBeGreaterThan(5);
    for (const row of rows) expect(row, row).toMatch(/\]\(\.\.?\/[^)]*\.md/u);
  });
});
