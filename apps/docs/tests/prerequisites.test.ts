import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DOCS_ROOT } from '#docs/tests/support/dist.ts';

const REPO = path.resolve(DOCS_ROOT, '../..');
const read = (relative: string): string => readFileSync(path.join(REPO, relative), 'utf8');
const page = (name: string): string => {
  const directory = path.join(DOCS_ROOT, 'content/en', name);
  const file = existsSync(path.join(directory, 'index.md')) ? 'index.md' : 'index.mdx';
  return readFileSync(path.join(directory, file), 'utf8');
};

const manifest = JSON.parse(read('package.json')) as {
  packageManager: string;
  engines: { node: string };
  scripts: Record<string, string>;
};
const compose = read('quickstart/compose.yaml');

// Each published port is `127.0.0.1:${VARIABLE:-default}:container`.
const PORTS = [...compose.matchAll(/'127\.0\.0\.1:\$\{(\w+):-(\d+)\}:(\d+)'/gu)].map((match) => ({
  variable: match[1] ?? '',
  host: match[2] ?? '',
}));

describe('the prerequisites the pages state', () => {
  it('finds the ports the quickstart stack publishes', () => {
    expect(PORTS.map((port) => port.variable).sort()).toEqual(['ODUDU_MAIL_PORT', 'ODUDU_PORT']);
  });

  it('names every published port, its default and the variable that moves it, on the quick start', () => {
    const text = page('quick-start');
    for (const port of PORTS) {
      expect(text, port.variable).toContain(`\`${port.variable}\``);
      expect(text, port.variable).toContain(port.host);
    }
  });

  it('states Node and pnpm as package.json requires them', () => {
    const text = page('contributing');
    const node = /(\d+)/u.exec(manifest.engines.node)?.[1] ?? '';
    expect(text).toContain(`Node ${node} or later`);
    expect(text).toContain(`pnpm ${manifest.packageManager.replace(/^pnpm@|\+.*$/gu, '')}`);
  });

  it('names only root scripts that exist', () => {
    const named = [...page('contributing').matchAll(/`pnpm ([a-z:-]+)`/gu)].map((m) => m[1] ?? '');
    expect(named.length).toBeGreaterThan(4);
    const builtin = new Set(['install']);
    expect(named.filter((script) => !builtin.has(script) && !(script in manifest.scripts))).toEqual(
      [],
    );
  });

  it('states the PostgreSQL major version the compose files run', () => {
    const major = /image: postgres:(\d+)-/u.exec(compose)?.[1] ?? '';
    expect(major).not.toBe('');
    expect(page('operating')).toContain(`PostgreSQL ${major}`);
  });

  it('states what the owner role needs and the variables a deployment sets', () => {
    const text = page('operating');
    for (const term of [
      'CREATE ROLE',
      'SUPERUSER',
      'BYPASSRLS',
      'ODUDU_DATABASE_URL',
      'ODUDU_APP_DATABASE_URL',
      'ODUDU_KEK',
      'ODUDU_TLS',
    ]) {
      expect(text, term).toContain(term);
    }
  });
});
