export interface Section {
  readonly label: string;
  readonly id: string;
  readonly route: string;
  readonly summary: string;
}

export const REPOSITORY_URL = 'https://github.com/wizzywit/odudu';

export const SECTIONS: readonly Section[] = [
  {
    label: 'Introduction',
    id: 'introduction/index',
    route: 'introduction/',
    summary: 'What Odudu is, who it is for and how the documentation is laid out.',
  },
  {
    label: 'Quick start',
    id: 'quick-start/index',
    route: 'quick-start/',
    summary: 'Run Odudu with one command and sign in to the console in ten minutes.',
  },
  {
    label: 'Guides',
    id: 'guides/index',
    route: 'guides/',
    summary: 'Sign users in from a web app, a single-page app, an API or a machine.',
  },
  {
    label: 'Concepts',
    id: 'concepts/index',
    route: 'concepts/',
    summary: 'Tenants, clients, tokens, sessions and the other ideas the product is built on.',
  },
  {
    label: 'Admin console',
    id: 'admin-console/index',
    route: 'admin-console/',
    summary: 'A tour of the console and one page for each area it manages.',
  },
  {
    label: 'Operating Odudu',
    id: 'operating/index',
    route: 'operating/',
    summary: 'Deploy, configure, upgrade, back up and scale a running installation.',
  },
  {
    label: 'Reference',
    id: 'reference/index',
    route: 'reference/',
    summary: 'Endpoints, configuration, commands, error codes and events, looked up by name.',
  },
  {
    label: 'Security',
    id: 'security/index',
    route: 'security/',
    summary: 'How Odudu protects credentials, sessions and tenants, and how to report a problem.',
  },
  {
    label: 'Contributing',
    id: 'contributing/index',
    route: 'contributing/',
    summary: 'Build Odudu from source, run its tests and send a change.',
  },
];

export const NAVBAR_ROUTES: readonly string[] = [
  'quick-start/',
  'guides/',
  'concepts/',
  'reference/',
];

export interface MachineReadableReference {
  readonly title: string;
  readonly description: string;
  // Where the build writes it, relative to the site root.
  readonly file: string;
}

// Files the build writes for tools rather than readers, such as an OpenAPI
// document; `llms.txt` lists each one and the build fails if its file is absent.
export const MACHINE_READABLE_REFERENCES: readonly MachineReadableReference[] = [
  {
    title: 'Admin API OpenAPI document',
    description: 'The OpenAPI 3.1 description of the admin API, as JSON.',
    file: 'openapi/admin.json',
  },
];
