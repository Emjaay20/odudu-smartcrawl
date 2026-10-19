import { OduduError } from '@odudu/kernel';

export interface InitInput {
  readonly adminEmail?: string;
  readonly adminPassword?: string;
  readonly additionalAdmin?: boolean;
  readonly interactive: boolean;
  readonly publicBaseUrl: string;
  readonly stateDir: string;
}

export interface InitReport {
  readonly consoleUrl: string;
  readonly adminEmail: string;
  readonly generatedPassword?: string;
  readonly created: boolean;
  /** The password came from ODUDU_ADMIN_PASSWORD, so it sits in the container's environment. */
  readonly passwordFromEnv?: boolean;
}

// Used when nobody names an administrator and nobody can be asked, so that a
// bare `docker compose up -d` needs no input.
export const DEFAULT_ADMIN_EMAIL = 'admin@odudu.local';

export interface InitPlan {
  readonly secrets: 'generate' | 'reuse';
  readonly admin: 'create' | 'exists';
  readonly passwordSource: 'prompt' | 'env' | 'generated';
}

export function planInit(
  input: InitInput,
  state: { readonly hasSecretsFile: boolean; readonly adminExists: boolean },
): InitPlan {
  const passwordSource =
    input.adminPassword !== undefined ? 'env' : input.interactive ? 'prompt' : 'generated';
  return {
    secrets: state.hasSecretsFile ? 'reuse' : 'generate',
    admin: state.adminExists ? 'exists' : 'create',
    passwordSource,
  };
}

const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '[::1]']);

export const DEFAULT_PUBLIC_BASE_URL = 'http://localhost:3000';

export function loopbackRefusal(publicBaseUrl: string): string {
  return (
    `ODUDU_PUBLIC_BASE_URL is ${JSON.stringify(publicBaseUrl)}, which is not a loopback ` +
    'address: odudu init is for a machine you are sitting at and serves over plain http ' +
    "on localhost. To run on a public address, configure the server yourself: see the README's " +
    'Deploying section'
  );
}

// `init` writes a quickstart environment: plain http, the console on, the
// administrator's first password on a terminal. That is for a machine you
// are sitting at, and a public address would put it on the internet.
export function assertLoopbackBase(publicBaseUrl: string): void {
  let url: URL;
  try {
    url = new URL(publicBaseUrl);
  } catch (cause) {
    throw new OduduError('init_invalid_options', 'ODUDU_PUBLIC_BASE_URL is not a URL', { cause });
  }
  if (!LOOPBACK_HOSTS.has(url.hostname)) {
    throw new OduduError('init_invalid_options', loopbackRefusal(publicBaseUrl));
  }
}
