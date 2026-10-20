import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DOCS_ROOT } from '#docs/tests/support/dist.ts';

const page = (name: string): string =>
  readFileSync(path.join(DOCS_ROOT, 'content/en/introduction', name), 'utf8');

describe('the introduction', () => {
  it('states the meaning of the name once, in the page about the name', () => {
    expect(page('odudu.md').match(/Ibibio/gu)).toHaveLength(1);
    expect(page('odudu.md')).toContain('Akwa Ibom, Nigeria');
    expect(page('index.md')).not.toContain('Ibibio');
    expect(page('compare.md')).not.toContain('Ibibio');
  });

  it('compares with Keycloak, Ory, Zitadel and Authentik without asserting facts about them', () => {
    const text = page('compare.md');
    for (const name of ['Keycloak', 'Ory', 'Zitadel', 'Authentik']) {
      expect(text, name).toMatch(new RegExp(`^\\| ${name}\\s*\\|.*see their documentation`, 'imu'));
    }
  });

  it('says what Odudu is not', () => {
    const text = page('compare.md');
    expect(text).toMatch(/not (yet )?ready for production/iu);
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
