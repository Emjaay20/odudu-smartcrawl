import { parseArgs } from 'node:util';
import { cliOptions, flag, text, texts } from '#/cli/command-types';
import { SEED_COMMANDS, type SeedOptions } from '#/cli/seed';

// The options of `seed` without a subcommand, which creates a client in one
// call. Read by parseArgs below and rendered by `odudu help seed`.
export const SEED_BOOTSTRAP_OPTIONS = {
  tenant: text('Name of the tenant to create the client in.', true),
  client: text('The client_id to create.', true),
  'client-secret': text('Register a confidential client with this secret.'),
  'token-endpoint-auth-method': text(
    'client_secret_basic or client_secret_post, for a confidential client.',
  ),
  'redirect-uri': texts('A redirect URI the client may use.'),
  user: text('Username of a user to create with the client.'),
  password: text('The password of that user.'),
  email: text('The email address of that user.'),
  'send-verification-email': flag('Queue a verification email for that user.'),
  'issuer-base': text('Base URL to print the issuer under, in place of the default.'),
} as const;

export const SEED_BOOTSTRAP_HELP = cliOptions(SEED_BOOTSTRAP_OPTIONS);

// --client-secret and --password land in process listings (ps) and shell
// history, since both are plain command-line flags. Acceptable for a local
// bootstrap tool run by an operator who already controls the machine, but
// not something to carry over if this ever grows a networked or CI-invoked
// mode.
export function parseSeedOptions(argv: string[]): SeedOptions {
  const { values } = parseArgs({
    args: argv,
    options: SEED_BOOTSTRAP_OPTIONS,
  });

  if (values.tenant === undefined || values.client === undefined) {
    throw new Error('seed requires --tenant and --client');
  }

  const authMethod = values['token-endpoint-auth-method'];
  if (
    authMethod !== undefined &&
    authMethod !== 'client_secret_basic' &&
    authMethod !== 'client_secret_post'
  ) {
    throw new Error(
      '--token-endpoint-auth-method must be client_secret_basic or client_secret_post',
    );
  }

  return {
    tenant: values.tenant,
    clientId: values.client,
    redirectUris: values['redirect-uri'] ?? [],
    ...(values['client-secret'] !== undefined ? { clientSecret: values['client-secret'] } : {}),
    ...(authMethod !== undefined ? { tokenEndpointAuthMethod: authMethod } : {}),
    ...(values.user !== undefined ? { username: values.user } : {}),
    ...(values.password !== undefined ? { password: values.password } : {}),
    ...(values.email !== undefined ? { email: values.email } : {}),
    ...(values['send-verification-email'] !== undefined
      ? { sendVerificationEmail: values['send-verification-email'] }
      : {}),
    ...(values['issuer-base'] !== undefined ? { issuerBase: values['issuer-base'] } : {}),
  };
}

export type SeedInvocation =
  | { readonly kind: 'command'; readonly argv: readonly string[] }
  | { readonly kind: 'bootstrap'; readonly options: SeedOptions };

// `seed role ...`, `seed grant-role ...` and the rest of the identity
// model's subcommands are told apart from the older `seed --tenant ...
// --client ...` bootstrap form by their first token: a subcommand name
// never starts with `--`, and the bootstrap form's first flag always does.
// Pulled out of main.ts, which runs its own boot sequence at module scope
// the moment it is imported, so this routing decision can be tested
// without triggering that.
export function resolveSeedInvocation(argv: readonly string[]): SeedInvocation {
  const first = argv[0];
  if (first !== undefined && (SEED_COMMANDS as readonly string[]).includes(first)) {
    return { kind: 'command', argv };
  }
  return { kind: 'bootstrap', options: parseSeedOptions([...argv]) };
}
