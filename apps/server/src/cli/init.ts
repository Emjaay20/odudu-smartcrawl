import { createHash, createHmac, pbkdf2Sync, randomBytes } from 'node:crypto';
import { link, mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { generateClientKey } from '@odudu/crypto';
import { createDatabase, MIGRATIONS_DIR, runMigrations, withTenant } from '@odudu/db';
import { SYSTEM_TENANT_ID } from '@odudu/domain-tenant';
import { isEmailAddress, userRepository } from '@odudu/domain-identity';
import { OduduError } from '@odudu/kernel';
import { sql } from 'drizzle-orm';
import { flag, text } from '#/cli/command-types';
import {
  assertLoopbackBase,
  DEFAULT_PUBLIC_BASE_URL,
  planInit,
  type InitInput,
} from '#/cli/init-plan';
import { seedAdmin } from '#/cli/seed';

export type { InitInput } from '#/cli/init-plan';

export interface InitIo {
  /** The owner connection: it creates roles, runs migrations and sees every tenant. */
  readonly databaseUrl: string;
  readonly out: (line: string) => void;
  readonly promptPassword?: () => Promise<string>;
  /** How long to wait for another init on the same database. Default 60 seconds. */
  readonly lockWaitMs?: number;
}

export interface InitReport {
  readonly consoleUrl: string;
  readonly adminEmail: string;
  readonly generatedPassword?: string;
  readonly created: boolean;
}

type Handle = ReturnType<typeof createDatabase>;

const SECRETS_FILE = 'quickstart.env';
export const SECRETS_FILE_MODE = 0o600;
export const STATE_DIR_MODE = 0o700;
export const DEFAULT_STATE_DIR = '/var/lib/odudu';
const LOCK_WAIT_MS = 60_000;
const LOCK_POLL_MS = 200;

export function rolesWithoutSecretsMessage(path: string): string {
  return (
    `the ${SERVICE_ROLE} role exists but ${path} does not, so its password is unknown; ` +
    'restore the file, or drop the role if this database is disposable'
  );
}

export function secondAdministratorMessage(email: string): string {
  return (
    `the system tenant already has an administrator and ${email} is not it; ` +
    'pass --add-admin to add another'
  );
}

export function existingAdministratorMessage(email: string, consoleUrl: string): string {
  return (
    `The administrator ${email} already exists. Console: ${consoleUrl}\n` +
    'If you cannot sign in, `odudu seed admin --username <name>` creates another.'
  );
}

const LOCK_HELD_MESSAGE =
  'another odudu init is running against this database; wait for it to finish and run this again';
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

function sameDatabase(a: string, b: string): boolean {
  const left = new URL(a);
  const right = new URL(b);
  return left.host === right.host && left.pathname === right.pathname;
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

async function roleExists(owner: Handle, name: string): Promise<boolean> {
  const rows = await owner.sql<
    { present: boolean }[]
  >`select exists(select 1 from pg_roles where rolname = ${name}) as present`;
  return rows[0]?.present === true;
}

// Postgres stores a SCRAM verifier as given when the PASSWORD literal has this
// shape, so the plaintext never appears in a statement log.
export function scramVerifier(password: string, salt: Buffer, iterations: number): string {
  const salted = pbkdf2Sync(password, salt, iterations, 32, 'sha256');
  const hmac = (key: Buffer, message: string): Buffer =>
    createHmac('sha256', key).update(message).digest();
  const storedKey = createHash('sha256').update(hmac(salted, 'Client Key')).digest('base64');
  const serverKey = hmac(salted, 'Server Key').toString('base64');
  return `SCRAM-SHA-256$${String(iterations)}:${salt.toString('base64')}$${storedKey}:${serverKey}`;
}

const DUPLICATE_OBJECT = '42710';

function sqlState(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code)
    : undefined;
}

// A utility statement takes no bind parameters, so the server composes the
// statement itself: the verifier travels as a bound parameter to format(),
// whose %L does the quoting. The error is rethrown without its cause, which
// carries the statement text.
async function createRole(owner: Handle, statement: string, what: string): Promise<void> {
  try {
    await owner.sql.unsafe(statement);
  } catch (error) {
    if (sqlState(error) === DUPLICATE_OBJECT) return;
    throw new OduduError(
      'init_invalid_options',
      `could not create ${what}: SQLSTATE ${sqlState(error) ?? 'unknown'}`,
    );
  }
}

async function ensureRoles(owner: Handle, servicePassword: string): Promise<void> {
  await createRole(owner, `CREATE ROLE ${APP_ROLE} NOLOGIN`, `the ${APP_ROLE} role`);
  const verifier = scramVerifier(servicePassword, randomBytes(16), 4096);
  const rows = await owner.sql<
    { statement: string }[]
  >`select format('CREATE ROLE odudu_svc LOGIN PASSWORD %L', ${verifier}::text) as statement`;
  await createRole(owner, rows[0]?.statement ?? '', `the ${SERVICE_ROLE} role`);
  await owner.sql.unsafe(`GRANT ${APP_ROLE} TO ${SERVICE_ROLE}`);
}

interface AdministratorState {
  readonly emailExists: boolean;
  readonly anyUser: boolean;
}

async function administratorState(appUrl: string, email: string): Promise<AdministratorState> {
  const runtime = createDatabase(appUrl, { max: 1 });
  try {
    return await withTenant(runtime.db, SYSTEM_TENANT_ID, async (tx) => {
      const emailExists = (await userRepository(tx).byUsername(email)) !== null;
      const rows = await tx.execute(sql`select 1 as present from users limit 1`);
      return { emailExists, anyUser: rows.length > 0 };
    });
  } finally {
    await runtime.close();
  }
}

// Created complete or not at all: a reader never sees a partial file, and an
// existing file is never replaced.
async function publishSecrets(path: string, content: string): Promise<void> {
  const staging = `${path}.${randomBytes(6).toString('hex')}.tmp`;
  try {
    await writeFile(staging, content, { mode: SECRETS_FILE_MODE, flag: 'wx' });
    await link(staging, path);
  } catch (error) {
    if (sqlState(error) === 'EEXIST') {
      throw new OduduError('init_invalid_options', `${path} appeared while init was running`);
    }
    throw error;
  } finally {
    await unlink(staging).catch(() => undefined);
  }
}

// Anyone who can write here can swap the file the server starts from.
async function assertStateDirNotWritableByOthers(dir: string): Promise<void> {
  const mode = (await stat(dir)).mode;
  if ((mode & 0o022) !== 0) {
    throw new OduduError(
      'init_invalid_options',
      `${dir} is writable by group or others; chmod it to ${STATE_DIR_MODE.toString(8)} or pick another --state-dir`,
    );
  }
}

async function takeLock(owner: Handle, waitMs: number): Promise<void> {
  const deadline = Date.now() + waitMs;
  for (;;) {
    const rows = await owner.sql<
      { locked: boolean }[]
    >`select pg_try_advisory_lock(hashtext('odudu_init'), 0) as locked`;
    if (rows[0]?.locked === true) return;
    if (Date.now() >= deadline) throw new OduduError('init_invalid_options', LOCK_HELD_MESSAGE);
    await new Promise((resolve) => setTimeout(resolve, LOCK_POLL_MS));
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

// Idempotent: every step looks before it writes. Runs are serialised by an
// advisory lock held on the owner connection until it closes, so two
// replicas starting together cannot both create the roles, the secrets file
// or the administrator.
export async function init(input: InitInput, io: InitIo): Promise<InitReport> {
  assertLoopbackBase(input.publicBaseUrl);
  const email = input.adminEmail;
  if (email === undefined || !isEmailAddress(email)) {
    throw new OduduError('init_invalid_options', 'init needs --admin-email, an email address');
  }

  const owner = createDatabase(io.databaseUrl, { max: 1 });
  try {
    await takeLock(owner, io.lockWaitMs ?? LOCK_WAIT_MS);
    return await initLocked(input, io, owner, email);
  } finally {
    await owner.close();
  }
}

async function initLocked(
  input: InitInput,
  io: InitIo,
  owner: Handle,
  email: string,
): Promise<InitReport> {
  const path = join(input.stateDir, SECRETS_FILE);
  const existing = await readSecrets(path);
  let secrets: Map<string, string>;
  if (existing === null) {
    await mkdir(input.stateDir, { recursive: true, mode: STATE_DIR_MODE });
    await assertStateDirNotWritableByOthers(input.stateDir);
    if (await roleExists(owner, SERVICE_ROLE)) {
      throw new OduduError('init_roles_without_secrets', rolesWithoutSecretsMessage(path));
    }
    secrets = await newSecrets(
      io.databaseUrl,
      input.publicBaseUrl,
      randomBytes(24).toString('hex'),
    );

    await publishSecrets(path, serialise(secrets));
  } else {
    if (!sameDatabase(existing.get('ODUDU_DATABASE_URL') ?? '', io.databaseUrl)) {
      throw new OduduError(
        'init_invalid_options',
        `${path} was written for a different database than ODUDU_DATABASE_URL names; ` +
          'point at the original, or remove the file to start over',
      );
    }
    secrets = existing;
  }
  const appUrl = secrets.get('ODUDU_APP_DATABASE_URL') ?? '';
  await ensureRoles(owner, decodeURIComponent(new URL(appUrl).password));
  await runMigrations(owner.db, process.env.ODUDU_MIGRATIONS_DIR ?? MIGRATIONS_DIR);

  for (const [key, value] of secrets) process.env[key] = value;
  const baseUrl = secrets.get('ODUDU_PUBLIC_BASE_URL') ?? input.publicBaseUrl;
  const consoleUrl = `${baseUrl}/console/`;
  if (baseUrl !== input.publicBaseUrl) {
    io.out(`Using ${baseUrl} from ${path}; ${input.publicBaseUrl} was ignored.`);
  }

  const state = await administratorState(appUrl, email);
  const plan = planInit(input, {
    hasSecretsFile: existing !== null,
    adminExists: state.emailExists,
  });
  if (plan.admin === 'exists') {
    io.out(existingAdministratorMessage(email, consoleUrl));
    return { consoleUrl, adminEmail: email, created: false };
  }
  if (state.anyUser && input.additionalAdmin !== true) {
    throw new OduduError('init_invalid_options', secondAdministratorMessage(email));
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
  'state-dir': text('Directory that holds quickstart.env. Defaults to ' + DEFAULT_STATE_DIR + '.'),
  'add-admin': flag(
    'Add an administrator when the system tenant already has one; without it a ' +
      'different --admin-email is refused.',
  ),
  'public-base-url': text(
    'Address the server is reached at, loopback only. Defaults to ODUDU_PUBLIC_BASE_URL, ' +
      'then ' +
      DEFAULT_PUBLIC_BASE_URL +
      '.',
  ),
} as const;

// A blank ${ODUDU_ADMIN_PASSWORD:-} in a compose file is unset, not a password.
export function adminPasswordFromEnv(env: NodeJS.ProcessEnv): string | undefined {
  const value = env.ODUDU_ADMIN_PASSWORD;
  return value === undefined || value === '' ? undefined : value;
}

// The administrator's own password comes from ODUDU_ADMIN_PASSWORD, never an
// option, so it does not sit in the process list.
export async function initCommand(argv: readonly string[]): Promise<void> {
  const { values } = parseArgs({ args: [...argv], options: INIT_OPTIONS });
  const databaseUrl = process.env.ODUDU_DATABASE_URL;
  if (databaseUrl === undefined || databaseUrl === '') {
    throw new OduduError('init_invalid_options', 'init needs ODUDU_DATABASE_URL, the owner URL');
  }
  const adminPassword = adminPasswordFromEnv(process.env);
  await init(
    {
      ...(values['admin-email'] !== undefined ? { adminEmail: values['admin-email'] } : {}),
      ...(adminPassword !== undefined ? { adminPassword } : {}),
      additionalAdmin: values['add-admin'] === true,
      interactive: false,
      publicBaseUrl:
        values['public-base-url'] ?? process.env.ODUDU_PUBLIC_BASE_URL ?? DEFAULT_PUBLIC_BASE_URL,
      stateDir: values['state-dir'] ?? DEFAULT_STATE_DIR,
    },
    {
      databaseUrl,
      out: (line) => {
        console.log(line);
      },
    },
  );
}
