import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { generateClientKey } from '@odudu/crypto';
import { createDatabase, MIGRATIONS_DIR, runMigrations, withTenant } from '@odudu/db';
import { SYSTEM_TENANT_ID } from '@odudu/domain-tenant';
import { isEmailAddress, userRepository } from '@odudu/domain-identity';
import { OduduError } from '@odudu/kernel';
import { text } from '#/cli/command-types';
import { assertLoopbackBase, planInit, type InitInput } from '#/cli/init-plan';
import { seedAdmin } from '#/cli/seed';

export type { InitInput } from '#/cli/init-plan';

export interface InitIo {
  /** The owner connection: it creates roles, runs migrations and sees every tenant. */
  readonly databaseUrl: string;
  readonly out: (line: string) => void;
  readonly promptPassword?: () => Promise<string>;
}

export interface InitReport {
  readonly consoleUrl: string;
  readonly adminEmail: string;
  readonly generatedPassword?: string;
  readonly created: boolean;
}

const SECRETS_FILE = 'quickstart.env';
const APP_ROLE = 'odudu_app';
const SERVICE_ROLE = 'odudu_svc';
const REQUIRED_KEYS = [
  'ODUDU_KEK',
  'ODUDU_CONSOLE_CLIENT_KEY',
  'ODUDU_DATABASE_URL',
  'ODUDU_APP_DATABASE_URL',
  'ODUDU_PUBLIC_BASE_URL',
  'ODUDU_CONSOLE',
] as const;

function parseEnvFile(content: string): Map<string, string> {
  const entries = new Map<string, string>();
  for (const line of content.split('\n')) {
    const at = line.indexOf('=');
    if (at > 0 && !line.startsWith('#')) entries.set(line.slice(0, at), line.slice(at + 1));
  }
  return entries;
}

async function readSecrets(path: string): Promise<Map<string, string> | null> {
  let content: string;
  try {
    content = await readFile(path, 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }
  const entries = parseEnvFile(content);
  const missing = REQUIRED_KEYS.filter((key) => !entries.has(key));
  if (missing.length > 0) {
    throw new OduduError(
      'init_invalid_options',
      `${path} is missing ${missing.join(', ')}; restore it or remove it to generate a new one`,
    );
  }
  return entries;
}

function appDatabaseUrl(ownerUrl: string, password: string): string {
  const url = new URL(ownerUrl);
  url.username = SERVICE_ROLE;
  url.password = password;
  return url.toString();
}

async function newSecrets(
  ownerUrl: string,
  publicBaseUrl: string,
  servicePassword: string,
): Promise<Map<string, string>> {
  return new Map([
    ['ODUDU_KEK', randomBytes(32).toString('base64')],
    ['ODUDU_CONSOLE_CLIENT_KEY', await generateClientKey()],
    ['ODUDU_DATABASE_URL', ownerUrl],
    ['ODUDU_APP_DATABASE_URL', appDatabaseUrl(ownerUrl, servicePassword)],
    ['ODUDU_PUBLIC_BASE_URL', publicBaseUrl],
    ['ODUDU_CONSOLE', 'true'],
  ]);
}

function serialise(entries: ReadonlyMap<string, string>): string {
  return [...entries].map(([key, value]) => `${key}=${value}\n`).join('');
}

async function roleExists(
  owner: ReturnType<typeof createDatabase>,
  name: string,
): Promise<boolean> {
  const rows = await owner.sql<
    { present: boolean }[]
  >`select exists(select 1 from pg_roles where rolname = ${name}) as present`;
  return rows[0]?.present === true;
}

// A utility statement takes no bind parameters, so the server composes the
// statement itself: the password travels as a bound parameter to format(),
// whose %L does the quoting, and is never concatenated into SQL here.
async function ensureRoles(
  owner: ReturnType<typeof createDatabase>,
  servicePassword: string,
): Promise<void> {
  if (!(await roleExists(owner, APP_ROLE))) {
    await owner.sql.unsafe(`CREATE ROLE ${APP_ROLE} NOLOGIN`);
  }
  if (!(await roleExists(owner, SERVICE_ROLE))) {
    const rows = await owner.sql<
      { statement: string }[]
    >`select format('CREATE ROLE odudu_svc LOGIN PASSWORD %L', ${servicePassword}::text) as statement`;
    try {
      await owner.sql.unsafe(rows[0]?.statement ?? '');
    } catch {
      throw new OduduError('init_invalid_options', `could not create the ${SERVICE_ROLE} role`);
    }
  }
  await owner.sql.unsafe(`GRANT ${APP_ROLE} TO ${SERVICE_ROLE}`);
}

async function adminExists(appUrl: string, email: string): Promise<boolean> {
  const runtime = createDatabase(appUrl, { max: 1 });
  try {
    return await withTenant(
      runtime.db,
      SYSTEM_TENANT_ID,
      async (tx) => (await userRepository(tx).byUsername(email)) !== null,
    );
  } finally {
    await runtime.close();
  }
}

async function chosenPassword(
  source: 'prompt' | 'env',
  input: InitInput,
  io: InitIo,
): Promise<string> {
  if (source === 'env' && input.adminPassword !== undefined) return input.adminPassword;
  if (io.promptPassword === undefined) {
    throw new OduduError('init_invalid_options', 'there is no terminal to ask for a password on');
  }
  return io.promptPassword();
}

// Idempotent: every step looks before it writes, and the secrets file is
// created exclusively, so a second run neither rotates the KEK nor
// overwrites what the running server was started with.
export async function init(input: InitInput, io: InitIo): Promise<InitReport> {
  assertLoopbackBase(input.publicBaseUrl);
  const email = input.adminEmail;
  if (email === undefined || !isEmailAddress(email)) {
    throw new OduduError('init_invalid_options', 'init needs --admin-email, an email address');
  }

  const path = join(input.stateDir, SECRETS_FILE);
  const existing = await readSecrets(path);
  const owner = createDatabase(io.databaseUrl, { max: 1 });
  let secrets: Map<string, string>;
  try {
    if (existing === null) {
      if (await roleExists(owner, SERVICE_ROLE)) {
        throw new OduduError(
          'init_roles_without_secrets',
          `the ${SERVICE_ROLE} role exists but ${path} does not, so its password is unknown; ` +
            'restore the file, or drop the role if this database is disposable',
        );
      }
      secrets = await newSecrets(
        io.databaseUrl,
        input.publicBaseUrl,
        randomBytes(24).toString('hex'),
      );
      await mkdir(input.stateDir, { recursive: true });
      await writeFile(path, serialise(secrets), { mode: 0o600, flag: 'wx' });
    } else {
      secrets = existing;
    }
    const appUrl = secrets.get('ODUDU_APP_DATABASE_URL') ?? '';
    await ensureRoles(owner, decodeURIComponent(new URL(appUrl).password));
    await runMigrations(owner.db, process.env.ODUDU_MIGRATIONS_DIR ?? MIGRATIONS_DIR);
  } finally {
    await owner.close();
  }

  for (const [key, value] of secrets) process.env[key] = value;
  const appUrl = secrets.get('ODUDU_APP_DATABASE_URL') ?? '';
  const baseUrl = secrets.get('ODUDU_PUBLIC_BASE_URL') ?? input.publicBaseUrl;
  const consoleUrl = `${baseUrl}/console/`;

  const plan = planInit(input, {
    hasSecretsFile: existing !== null,
    adminExists: await adminExists(appUrl, email),
  });
  if (plan.admin === 'exists') {
    io.out(`The administrator ${email} already exists. Console: ${consoleUrl}`);
    return { consoleUrl, adminEmail: email, created: false };
  }

  if (plan.passwordSource === 'generated') {
    const admin = await seedAdmin({ username: email, email });
    io.out(`Console: ${consoleUrl}`);
    io.out(`Administrator: ${email}`);
    io.out(`One-time password: ${admin.password}`);
    io.out('It is shown once and must be changed at first sign-in.');
    return { consoleUrl, adminEmail: email, generatedPassword: admin.password, created: true };
  }

  const password = await chosenPassword(plan.passwordSource, input, io);
  await seedAdmin({ username: email, email, password });
  io.out(`Console: ${consoleUrl}`);
  io.out(`Administrator: ${email}`);
  return { consoleUrl, adminEmail: email, created: true };
}

export const INIT_OPTIONS = {
  'admin-email': text('Email address of the first administrator, who signs in with it.'),
  'state-dir': text('Directory that holds quickstart.env. Defaults to /var/lib/odudu.'),
  'public-base-url': text(
    'Address the server is reached at, loopback only. Defaults to ODUDU_PUBLIC_BASE_URL, ' +
      'then http://localhost:3000.',
  ),
} as const;

// The administrator's own password comes from ODUDU_ADMIN_PASSWORD, never an
// option, so it does not sit in the process list.
export async function initCommand(argv: readonly string[]): Promise<void> {
  const { values } = parseArgs({ args: [...argv], options: INIT_OPTIONS });
  const databaseUrl = process.env.ODUDU_DATABASE_URL;
  if (databaseUrl === undefined || databaseUrl === '') {
    throw new OduduError('init_invalid_options', 'init needs ODUDU_DATABASE_URL, the owner URL');
  }
  await init(
    {
      ...(values['admin-email'] !== undefined ? { adminEmail: values['admin-email'] } : {}),
      ...(process.env.ODUDU_ADMIN_PASSWORD !== undefined
        ? { adminPassword: process.env.ODUDU_ADMIN_PASSWORD }
        : {}),
      interactive: false,
      publicBaseUrl:
        values['public-base-url'] ?? process.env.ODUDU_PUBLIC_BASE_URL ?? 'http://localhost:3000',
      stateDir: values['state-dir'] ?? '/var/lib/odudu',
    },
    {
      databaseUrl,
      out: (line) => {
        console.log(line);
      },
    },
  );
}
