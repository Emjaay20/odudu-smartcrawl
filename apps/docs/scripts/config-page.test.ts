import { configReference, CONFIG_DOCS, type ConfigReference } from '@odudu/kernel/docs';
import { describe, expect, it } from 'vitest';
import { renderConfigPage } from './config-page.ts';

const rows = configReference();
const text = renderConfigPage();

function rowOf(name: string): string {
  const line = text.split('\n').find((candidate) => candidate.startsWith(`| \`${name}\` |`));
  if (line === undefined) throw new Error(`${name} has no row`);
  return line;
}

describe('the configuration reference', () => {
  it('lists every variable the loader accepts, once, with its default', () => {
    for (const name of Object.keys(CONFIG_DOCS)) {
      expect(
        text.split('\n').filter((line) => line.startsWith(`| \`${name}\` |`)),
        name,
      ).toHaveLength(1);
    }
    for (const row of rows) {
      if (row.default !== undefined)
        expect(rowOf(row.name), row.name).toContain(`\`${row.default}\``);
    }
  });

  it('prints no default for a secret, and says it is one', () => {
    for (const name of ['ODUDU_KEK', 'ODUDU_SMTP_PASSWORD', 'ODUDU_CONSOLE_CLIENT_KEY']) {
      expect(rowOf(name), name).toContain(', secret |');
      expect(rowOf(name), name).not.toMatch(/\| `[^`]+` \|(?= [^|]+ \|$)/u);
    }
    expect(rowOf('ODUDU_SMTP_PASSWORD')).toMatch(/\| string, secret \| none \|/u);
  });

  it('marks the variables the server cannot start without as required', () => {
    expect(rowOf('ODUDU_DATABASE_URL')).toContain('| required |');
    expect(rowOf('ODUDU_KEK')).toContain('| required |');
    expect(rowOf('ODUDU_SMTP_HOST')).toContain('| none |');
  });

  it('shows bounds and allowed values', () => {
    expect(rowOf('ODUDU_HTTP_PORT')).toContain('integer, 1 to 65,535');
    expect(rowOf('ODUDU_LOG_LEVEL')).toContain('one of `fatal`, `error`');
    expect(rowOf('ODUDU_TRUST_PROXY')).toContain('`true` or `false`');
  });

  it('renders the rows it is given, so the page cannot hold a variable the loader lost', () => {
    const only: ConfigReference[] = rows.filter((row) => row.name === 'ODUDU_HTTP_PORT');
    const page = renderConfigPage(only);
    expect(page).toContain('`ODUDU_HTTP_PORT`');
    expect(page).not.toContain('`ODUDU_KEK`');
  });
});
