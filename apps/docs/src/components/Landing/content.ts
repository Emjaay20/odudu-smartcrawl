// What the landing page says, apart from how it is laid out. Every `to` is a
// route the build checks, and a test ties the command to the quick start's.

export const RELEASE_URL =
  'https://github.com/wizzywit/odudu/releases/latest/download/compose.yaml';

export type Shell = 'unix' | 'windows';

export interface ShellCommand {
  readonly shell: Shell;
  readonly label: string;
  readonly command: string;
}

export const COMMANDS: readonly ShellCommand[] = [
  {
    shell: 'unix',
    label: 'bash or zsh',
    command: `curl -fsSLO ${RELEASE_URL} && docker compose up -d`,
  },
  {
    shell: 'windows',
    label: 'PowerShell',
    command: `curl.exe -fsSLO ${RELEASE_URL}; docker compose up -d`,
  },
];

export interface Card {
  readonly title: string;
  readonly body: string;
  readonly to: string;
}

export const CAPABILITIES: readonly Card[] = [
  {
    title: 'Standard sign-in',
    body: 'The authorization code flow with PKCE always on, and discovery, signing keys, user info, introspection and revocation for every tenant.',
    to: '/guides/sign-a-user-in/',
  },
  {
    title: 'Many tenants',
    body: 'Any number of tenants on one server, each with its own people, apps, keys and settings, kept apart by the database itself.',
    to: '/concepts/tenants/',
  },
  {
    title: 'Passwords and second factors',
    body: 'Passwords with a policy and lockouts, passkeys, authenticator apps and recovery codes, chosen per tenant.',
    to: '/admin-console/sign-in-flow/',
  },
  {
    title: 'Sessions that end properly',
    body: 'Refresh tokens that rotate and are caught when stolen, and logout that reaches the apps that registered for it.',
    to: '/guides/refresh-and-end-a-session/',
  },
  {
    title: 'Services and delegation',
    body: "Client credentials for a service that signs in as itself, and token exchange for acting on someone else's behalf.",
    to: '/guides/machine-to-machine/',
  },
  {
    title: 'An admin API and console',
    body: 'More than a hundred operations, each checked against the capability it needs, and a console with a page for every area.',
    to: '/admin-console/',
  },
  {
    title: 'An audit trail',
    body: 'Every administrative change, sign-in, refusal and token is recorded, filterable and exportable.',
    to: '/admin-console/audit-trail/',
  },
  {
    title: 'One container and Postgres',
    body: 'Migrations run at boot, health endpoints are built in, and TLS is ended in front of the server.',
    to: '/operating/deploying/',
  },
];

export interface Step {
  readonly title: string;
  readonly body: string;
}

export const STEPS: readonly Step[] = [
  {
    title: 'Start it',
    body: 'One command downloads the Compose file and starts Postgres, a one-time setup step and the server.',
  },
  {
    title: 'Sign in to the console',
    body: "The setup step prints the console address and the first administrator's sign-in, once.",
  },
  {
    title: 'Sign a person in to an app',
    body: 'Make a tenant, register an app and sign someone in, from the console or the command line.',
  },
];

export const READERS: readonly Card[] = [
  {
    title: 'I am building an app',
    body: 'Pick the guide for a web app, a single-page app, an API or a service. Each ends with a working sign-in.',
    to: '/guides/',
  },
  {
    title: 'I administer people and apps',
    body: 'A tour of the console: tenants, people, apps, keys and the audit trail.',
    to: '/admin-console/tour/',
  },
  {
    title: 'I run the server',
    body: 'Deploy, configure, upgrade, back up and scale an installation.',
    to: '/operating/',
  },
  {
    title: 'I am choosing a provider',
    body: 'What Odudu does today, what it does not, and where each capability is shown working.',
    to: '/introduction/compare/',
  },
];

export const EXAMPLES: readonly Card[] = [
  {
    title: 'Web app',
    body: 'A server-side app that signs a person in with the authorization code grant and PKCE, and keeps them in a session.',
    to: '/guides/web-app/',
  },
  {
    title: 'Single-page app',
    body: 'A browser app with no secret that signs in with PKCE, keeps its tokens in memory and signs out.',
    to: '/guides/single-page-app/',
  },
  {
    title: 'API',
    body: 'An API that decides for itself whether to trust an access token: signature, issuer, audience, type and expiry.',
    to: '/guides/api/',
  },
  {
    title: 'Service to service',
    body: 'A service that signs in as itself with a secret and calls the API.',
    to: '/guides/machine-to-machine/',
  },
];

export const EXAMPLES_URL_PATH = '/tree/main/examples';
export const LICENSING_URL_PATH = '/blob/main/LICENSING.md';

// What the quick start's second step shows, which the hero's terminal plays
// after the command. A test holds each line to the quick start's own text.
export const FOLLOW_UP = {
  command: 'docker compose logs setup',
  output: ['Odudu is ready.', ' console:  http://localhost:3000/console/'],
} as const;
