import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../docs/markdown.js';

// Read as text: the file is small and every assertion is about a line of it.
// It cannot see what Compose computes from the file, which `docker compose
// config` does in CI.

const text = readFileSync(path.join(REPO_ROOT, 'quickstart/compose.yaml'), 'utf8');

function service(name: string): string {
  const start = text.search(new RegExp(`^  ${name}:`, 'm'));
  expect(start, `service ${name}`).toBeGreaterThanOrEqual(0);
  const rest = text.slice(start + 1);
  const next = rest.search(/^ {2}\S/m);
  return next < 0 ? rest : rest.slice(0, next);
}

const code = (block: string): string =>
  block
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');

describe('quickstart/compose.yaml', () => {
  it('parametrises the port and the public base URL from one variable', () => {
    expect(text).toContain('ODUDU_PUBLIC_BASE_URL: http://localhost:${ODUDU_PORT:-3000}');
    expect(text).toContain("'127.0.0.1:${ODUDU_PORT:-3000}:3000'");
    expect(text.match(/\$\{ODUDU_PORT:-3000\}/g)).toHaveLength(2);
  });

  it('publishes nothing for Postgres', () => {
    expect(code(service('postgres'))).not.toMatch(/^\s*ports:/m);
    expect(code(service('postgres'))).not.toMatch(/\bexpose:/);
  });

  it('binds the Odudu port to loopback', () => {
    const published = code(service('odudu')).match(/^\s*- ['"]?[^'"\n]*:\d+['"]?$/gm) ?? [];
    expect(published.length).toBeGreaterThan(0);
    for (const line of published) expect(line).toContain('127.0.0.1:');
  });

  it('depends the server on setup completing', () => {
    expect(service('odudu')).toMatch(
      /depends_on:\s*\n\s+setup:\s*\n\s+condition: service_completed_successfully/,
    );
  });

  it('pins postgres and mailpit by digest and tag', () => {
    for (const name of ['postgres', 'mailpit']) {
      expect(service(name)).toMatch(/image: [^\s@:]+(?:\/[^\s@:]+)*:[^\s@:]+@sha256:[0-9a-f]{64}/);
    }
  });

  it('has no build: key', () => {
    expect(code(text)).not.toMatch(/^\s*build:/m);
  });

  it('mounts one named volume for state and one for data', () => {
    expect(code(text)).toMatch(/^volumes:\s*\n\s+odudu-state:\s*\n\s+odudu-data:/m);
    expect(service('setup')).toContain('odudu-state:/var/lib/odudu');
    expect(service('odudu')).toContain('odudu-state:/var/lib/odudu');
    expect(service('postgres')).toContain('odudu-data:/var/lib/postgresql/data');
  });

  it('keeps mailpit behind a profile', () => {
    expect(service('mailpit')).toMatch(/profiles: \[['"]?mail['"]?\]/);
  });

  it('gives setup no terminal under up, and no restart', () => {
    const setup = service('setup');
    expect(code(setup)).not.toMatch(/^\s*(?:tty|stdin_open):/m);
    expect(setup).toMatch(/restart: ['"]?no['"]?/);
  });

  it('starts the server from the file setup wrote', () => {
    expect(service('odudu')).toContain('--env-file=/var/lib/odudu/quickstart.env');
  });
});
