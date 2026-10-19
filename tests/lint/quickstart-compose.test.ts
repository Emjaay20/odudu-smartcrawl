import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../docs/markdown.js';

// Read as text: the file is small and every assertion is about a line of it.
// It cannot see what Compose computes from the file, which `docker compose
// config` does in CI.

const text = readFileSync(path.join(REPO_ROOT, 'quickstart/compose.yaml'), 'utf8');
const example = readFileSync(path.join(REPO_ROOT, 'quickstart/.env.example'), 'utf8');
const dependabot = readFileSync(path.join(REPO_ROOT, '.github/dependabot.yml'), 'utf8');

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

  it('restarts postgres and the server unless stopped, and setup never', () => {
    for (const name of ['postgres', 'odudu']) {
      expect(service(name), name).toMatch(/restart: unless-stopped/);
    }
    expect(service('setup')).toMatch(/restart: ['"]no['"]/);
  });

  it('defaults to one exact release of its own image, written the same everywhere', () => {
    const SEMVER = String.raw`\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?`;
    const own = new RegExp(String.raw`\$\{ODUDU_IMAGE:-ghcr\.io/wizzywit/odudu:(${SEMVER})\}`, 'g');
    const tags = [...text.matchAll(own)].map((match) => match[1]);
    expect(tags).toHaveLength(2);
    expect(new Set(tags).size).toBe(1);
    expect(text).not.toMatch(/odudu:latest/);
    expect(example).not.toMatch(/odudu:latest/);
    expect(example).toContain(`ghcr.io/wizzywit/odudu:${tags[0] ?? ''}`);
  });

  it('says only what holds about who can reach postgres', () => {
    expect(text).not.toMatch(/nowhere else/);
    expect(text).toMatch(/any process on this machine/i);
    expect(text).toMatch(/shared host/i);
  });

  it('keeps ODUDU_PORT in the example a valid port', () => {
    const port = /^ODUDU_PORT=(\d+)$/m.exec(example)?.[1];
    expect(Number(port)).toBeGreaterThanOrEqual(1);
    expect(Number(port)).toBeLessThanOrEqual(65535);
  });

  it('tells a person to single-quote a password that holds $ or #', () => {
    expect(example).toMatch(/single quotes/i);
    expect(example).toContain("ODUDU_ADMIN_PASSWORD='");
  });

  it('keeps postgres on its major version in Dependabot', () => {
    expect(dependabot).toMatch(
      /ignore:\s*\n\s+- dependency-name: postgres\s*\n\s+update-types: \['version-update:semver-major'\]/,
    );
  });

  it('relaxes the production guards on purpose, and says it is not a production deployment', () => {
    const server = service('odudu');
    expect(server).toContain('- NODE_ENV=development');
    expect(server).toMatch(/not a production deployment/);
    expect(server).toMatch(/config-guard\.ts/);
    expect(code(text)).not.toMatch(/ODUDU_TLS|ODUDU_ALLOW_PRIVATE_CLIENT_URLS|ODUDU_KEK/);
  });
});

const dockerAvailable = spawnSync('docker', ['compose', 'version']).status === 0;

describe.skipIf(!dockerAvailable)('a password in a Compose .env file', () => {
  it('reaches the container byte for byte when single-quoted, as the example advises', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'odudu-env-'));
    try {
      const envFile = path.join(directory, '.env');
      writeFileSync(envFile, "ODUDU_ADMIN_PASSWORD='pa$word#c'\n");
      const result = spawnSync(
        'docker',
        [
          'compose',
          '-f',
          path.join(REPO_ROOT, 'quickstart/compose.yaml'),
          '--env-file',
          envFile,
          'config',
          '--format',
          'json',
        ],
        { encoding: 'utf8', env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '' } },
      );
      expect(result.status, result.stderr).toBe(0);
      const parsed: unknown = JSON.parse(result.stdout);
      const password =
        typeof parsed === 'object' && parsed !== null && 'services' in parsed
          ? JSON.stringify(parsed.services)
          : '';
      // `config` writes a literal $ as $$.
      expect(password).toContain('pa$$word#c');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
