import { mkdtemp, readFile, rm, stat, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDatabase, type DatabaseHandle } from '@odudu/db';
import { ADMIN_CLIENT_ID, SYSTEM_TENANT_NAME } from '@odudu/domain-tenant';
import { loadConfig } from '@odudu/kernel';
import { startTestDatabase, type TestDatabase } from '@odudu/testkit';
import { sql } from 'drizzle-orm';
import { type FastifyInstance, type LightMyRequestResponse } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '#/app';
import { init, type InitInput, type InitIo } from '#/cli/init';
import { createLogger } from '#/logger';

const ENV_KEYS = [
  'ODUDU_DATABASE_URL',
  'ODUDU_APP_DATABASE_URL',
  'ODUDU_KEK',
  'ODUDU_CONSOLE',
  'ODUDU_CONSOLE_CLIENT_KEY',
  'ODUDU_PUBLIC_BASE_URL',
];
const REDIRECT_URI = 'http://127.0.0.1:8080/callback';
const CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
const EMAIL = 'ada@example.com';
const BASE = 'http://localhost:3000';

let database: TestDatabase;
let stateDir: string;
let saved: Record<string, string | undefined>;

// One cluster per test: roles are cluster-wide, and "empty database" has to
// mean no odudu_svc either.
beforeEach(async () => {
  saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  database = await startTestDatabase();
  stateDir = await mkdtemp(join(tmpdir(), 'odudu-init-'));
}, 120_000);

afterEach(async () => {
  for (const key of ENV_KEYS) {
    const value = saved[key];
    Reflect.deleteProperty(process.env, key);
    if (value !== undefined) process.env[key] = value;
  }
  await database.stop();
  await rm(stateDir, { recursive: true, force: true });
});

function inputWith(extra: Partial<InitInput> = {}): InitInput {
  return {
    adminEmail: EMAIL,
    interactive: false,
    publicBaseUrl: BASE,
    stateDir,
    ...extra,
  };
}

function capture(): { io: InitIo; out: string[] } {
  const out: string[] = [];
  return {
    out,
    io: {
      databaseUrl: database.adminUrl,
      out: (line) => {
        out.push(line);
      },
    },
  };
}

async function envFile(): Promise<Map<string, string>> {
  const text = await readFile(join(stateDir, 'quickstart.env'), 'utf8');
  return new Map(
    text
      .split('\n')
      .filter((line) => line.includes('='))
      .map((line): [string, string] => [
        line.slice(0, line.indexOf('=')),
        line.slice(line.indexOf('=') + 1),
      ]),
  );
}

function formPost(
  app: FastifyInstance,
  url: string,
  fields: Record<string, string>,
): Promise<LightMyRequestResponse> {
  return app.inject({
    method: 'POST',
    url,
    payload: new URLSearchParams(fields).toString(),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
  });
}

// What the first sign-in shows: the page asking for a new password, or the
// redirect that carries a code.
async function signIn(email: string, password: string): Promise<'change-password' | 'signed-in'> {
  const env = await envFile();
  const owner = createDatabase(database.adminUrl);
  const runtime = createDatabase(env.get('ODUDU_APP_DATABASE_URL') ?? '');
  const config = loadConfig({ ...process.env, ODUDU_LOG_LEVEL: 'silent' });
  const app = buildApp({
    database: runtime,
    ownerDatabase: owner,
    kek: Buffer.from(env.get('ODUDU_KEK') ?? '', 'base64'),
    logger: createLogger(config),
  });
  try {
    await app.ready();
    const query = new URLSearchParams({
      response_type: 'code',
      client_id: ADMIN_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      scope: 'openid',
      state: 'xyz',
      code_challenge: CHALLENGE,
      code_challenge_method: 'S256',
    });
    const form = await app.inject({
      url: `/tenants/${SYSTEM_TENANT_NAME}/protocol/openid-connect/auth?${query.toString()}`,
    });
    const session = /name="auth_session_id" value="([^"]*)"/u.exec(form.body)?.[1] ?? '';
    const login = await formPost(app, `/tenants/${SYSTEM_TENANT_NAME}/login-actions/authenticate`, {
      auth_session_id: session,
      username: email,
      password,
    });
    return login.statusCode === 302 ? 'signed-in' : 'change-password';
  } finally {
    await app.close();
    await runtime.close();
    await owner.close();
  }
}

async function countRows(url: string, table: string): Promise<number> {
  const handle: DatabaseHandle = createDatabase(url);
  try {
    const rows = await handle.db.execute(sql.raw(`select count(*)::int as n from ${table}`));
    return (rows as unknown as { n: number }[])[0]?.n ?? -1;
  } finally {
    await handle.close();
  }
}

describe('odudu init', () => {
  it('creates the roles, migrates, creates the system tenant and one administrator from an empty database', async () => {
    const { io, out } = capture();

    const report = await init(inputWith(), io);

    expect(report.created).toBe(true);
    expect(report.adminEmail).toBe(EMAIL);
    expect(report.consoleUrl).toBe(`${BASE}/console/`);
    expect(await countRows(database.adminUrl, 'tenants')).toBe(1);
    const env = await envFile();
    expect(await countRows(env.get('ODUDU_APP_DATABASE_URL') ?? '', 'tenants')).toBe(0);
    expect(await signIn(EMAIL, report.generatedPassword ?? '')).toBe('change-password');
    expect(out.join('\n')).toContain(report.generatedPassword ?? 'no password');
  }, 120_000);

  it('is idempotent: a second run changes nothing and reports created: false', async () => {
    await init(inputWith(), capture().io);
    const before = await countRows(database.adminUrl, 'subjects');
    const { io, out } = capture();

    const second = await init(inputWith(), io);

    expect(second.created).toBe(false);
    expect(second.generatedPassword).toBeUndefined();
    expect(await countRows(database.adminUrl, 'subjects')).toBe(before);
    expect(await countRows(database.adminUrl, 'tenants')).toBe(1);
    expect(out.join('\n')).not.toMatch(/password/iu);
  }, 120_000);

  it('stores the chosen password so the first sign-in is not forced to change it, and a generated one is', async () => {
    const chosen = 'Chosen-Passw0rd!42';

    const report = await init(inputWith({ adminPassword: chosen }), capture().io);

    expect(report.generatedPassword).toBeUndefined();
    expect(await signIn(EMAIL, chosen)).toBe('signed-in');
  }, 120_000);

  it('writes quickstart.env with mode 0600 and the same KEK on a second run', async () => {
    await init(inputWith(), capture().io);
    const first = await envFile();
    expect((await stat(join(stateDir, 'quickstart.env'))).mode & 0o777).toBe(0o600);

    await init(inputWith(), capture().io);

    const second = await envFile();
    expect(second.get('ODUDU_KEK')).toBe(first.get('ODUDU_KEK'));
    expect(second.get('ODUDU_APP_DATABASE_URL')).toBe(first.get('ODUDU_APP_DATABASE_URL'));
    expect(Buffer.from(first.get('ODUDU_KEK') ?? '', 'base64')).toHaveLength(32);
    expect(first.get('ODUDU_CONSOLE')).toBe('true');
    expect(first.get('ODUDU_PUBLIC_BASE_URL')).toBe(BASE);
    expect(first.get('ODUDU_CONSOLE_CLIENT_KEY')).toBeTruthy();
  }, 120_000);

  it('refuses to run against a non-loopback public base URL', async () => {
    await expect(
      init(inputWith({ publicBaseUrl: 'https://id.example.com' }), capture().io),
    ).rejects.toThrow(/ODUDU_PUBLIC_BASE_URL/u);
    await expect(stat(join(stateDir, 'quickstart.env'))).rejects.toThrow();
  }, 120_000);

  it('never prints a chosen password', async () => {
    const odd = `p'"$(id)\\n and ${'x7!Q'.repeat(50)}`;
    const { io, out } = capture();

    await init(inputWith({ adminPassword: odd }), io);

    const printed = out.join('\n');
    expect(printed).not.toContain(odd);
    for (let start = 0; start + 6 <= odd.length; start += 6) {
      expect(printed).not.toContain(odd.slice(start, start + 6));
    }
  }, 120_000);

  it('refuses a chosen password the system tenant policy rejects, naming the rule', async () => {
    await expect(init(inputWith({ adminPassword: 'short' }), capture().io)).rejects.toThrow(
      /at least/u,
    );
  }, 120_000);

  it('refuses roles that exist while the secrets file is gone, rather than resetting their password', async () => {
    await init(inputWith(), capture().io);
    await unlink(join(stateDir, 'quickstart.env'));

    await expect(init(inputWith(), capture().io)).rejects.toMatchObject({
      code: 'init_roles_without_secrets',
    });
  }, 120_000);
});
