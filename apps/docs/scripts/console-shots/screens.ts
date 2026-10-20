import type { Page } from '@playwright/test';
import type { Context, Screen } from './screen.ts';

const DEMO = 'demo';
const CLIENT = 'my-app';
const REDIRECT = 'http://localhost:8080/callback';
const PERSON = 'ada';

async function exists(page: Page, cell: string): Promise<boolean> {
  await page.getByRole('heading', { level: 1 }).waitFor();
  await page.getByText(/^\d+ (client|clients|subject|subjects|tenant|tenants)$/u).waitFor();
  return (await page.getByRole('row', { name: new RegExp(cell, 'u') }).count()) > 0;
}

async function openList(page: Page, context: Context, area: string): Promise<void> {
  await page.goto(`${context.base}/console/${DEMO}/${area}`);
}

export const SCREENS: readonly Screen[] = [
  {
    name: 'sign-in-tenant',
    alt: 'The console asks which tenant you administer, with one field and a Continue to sign-in button.',
    caption: 'The console first asks which tenant you administer.',
    signedIn: false,
    expect: [{ heading: 'Sign in' }, { role: 'button', name: 'Continue to sign-in' }],
    open: async (page, context) => {
      await page.goto(`${context.base}/console/`);
      await page.getByLabel(/tenant/iu).fill('system');
    },
  },
  {
    name: 'sign-in',
    alt: "Odudu's sign-in page for the system tenant, with Username and Password fields.",
    caption: "Odudu's own sign-in page, with the administrator's email as the username.",
    signedIn: false,
    expect: [{ heading: 'Sign in' }, { label: 'Username' }, { label: 'Password' }],
    open: async (page, context) => {
      await page.goto(`${context.base}/console/`);
      await page.getByLabel(/tenant/iu).fill('system');
      await page.getByRole('button', { name: 'Continue to sign-in' }).click();
      await page.getByLabel('Username').waitFor();
    },
  },
  {
    name: 'new-tenant',
    alt: 'The Create a tenant form with the name demo typed in and its issuer, http://localhost:3000/tenants/demo, shown beneath.',
    caption: 'A tenant needs only a name. The issuer follows from it.',
    signedIn: true,
    expect: [
      { heading: 'Create a tenant' },
      { label: 'Name' },
      { role: 'button', name: 'Create tenant' },
    ],
    open: async (page, context) => {
      await page.goto(`${context.base}/console/system/new-tenant`);
      await page.getByLabel('Name', { exact: true }).fill(DEMO);
      await page.getByText(`/tenants/${DEMO}`).waitFor();
    },
    leave: async (page, context) => {
      await page.goto(`${context.base}/console/system/tenants`);
      if (await exists(page, `^${DEMO}`)) return;
      await page.goto(`${context.base}/console/system/new-tenant`);
      await page.getByLabel('Name', { exact: true }).fill(DEMO);
      await page.getByRole('button', { name: 'Create tenant' }).click();
      await page.getByText(`${DEMO} was created`).waitFor();
    },
  },
  {
    name: 'new-client',
    alt: 'The Create a client form with client ID my-app, the kind Public application and one redirect URI.',
    caption: 'A public client, with the address Odudu sends the browser back to.',
    signedIn: true,
    expect: [
      { heading: 'Create a client' },
      { label: 'Client ID' },
      { role: 'button', name: 'Create client' },
    ],
    open: async (page, context) => {
      await page.goto(`${context.base}/console/${DEMO}/clients/new`);
      await page.getByLabel('Client ID').fill(CLIENT);
      await page.getByLabel('Kind').click();
      await page.getByRole('option', { name: 'Public application' }).click();
      await page.getByRole('textbox', { name: 'Redirect URI' }).first().fill(REDIRECT);
    },
    leave: async (page, context) => {
      await openList(page, context, 'clients');
      if (await exists(page, CLIENT)) return;
      await page.goto(`${context.base}/console/${DEMO}/clients/new`);
      await page.getByLabel('Client ID').fill(CLIENT);
      await page.getByLabel('Kind').click();
      await page.getByRole('option', { name: 'Public application' }).click();
      await page.getByRole('textbox', { name: 'Redirect URI' }).first().fill(REDIRECT);
      await page.getByRole('button', { name: 'Create client' }).click();
      await page.getByRole('heading', { level: 1, name: CLIENT }).waitFor();
    },
  },
  {
    name: 'clients',
    alt: "The demo tenant's Clients list: the built-in odudu-admin client and my-app, with a Create a client button.",
    caption: 'The demo tenant lists my-app beside its built-in administration client.',
    signedIn: true,
    expect: [
      { heading: 'Clients' },
      { role: 'link', name: 'Create a client' },
      { rows: ['odudu-admin', CLIENT] },
    ],
    open: (page, context) => openList(page, context, 'clients'),
  },
  {
    name: 'new-subject',
    alt: 'The Create a subject form with the username ada typed in.',
    caption: 'A person needs only a username. There is no password field.',
    signedIn: true,
    expect: [
      { heading: 'Create a subject' },
      { label: 'Username' },
      { role: 'button', name: 'Create subject' },
    ],
    open: async (page, context) => {
      await page.goto(`${context.base}/console/${DEMO}/subjects/new`);
      await page.getByLabel('Username').fill(PERSON);
    },
    leave: async (page, context) => {
      await openList(page, context, 'subjects');
      if (await exists(page, PERSON)) return;
      await page.goto(`${context.base}/console/${DEMO}/subjects/new`);
      await page.getByLabel('Username').fill(PERSON);
      await page.getByRole('button', { name: 'Create subject' }).click();
      await page.getByRole('heading', { level: 1, name: PERSON }).waitFor();
    },
  },
  {
    name: 'subjects',
    alt: "The demo tenant's Subjects list, with the person ada and a Create a subject button.",
    caption: 'The demo tenant now lists the person.',
    signedIn: true,
    expect: [
      { heading: 'Subjects' },
      { role: 'link', name: 'Create a subject' },
      { rows: [PERSON] },
    ],
    open: (page, context) => openList(page, context, 'subjects'),
  },
  {
    name: 'issue-password',
    alt: 'The Credentials tab of ada, with a dialog asking whether to issue a one-time password.',
    caption:
      'The console issues a one-time password. It is shown once, and the person changes it at first sign-in.',
    signedIn: true,
    expect: [{ heading: PERSON }, { role: 'button', name: 'Issue password' }],
    open: async (page, context) => {
      await openList(page, context, 'subjects');
      await page.getByRole('row', { name: new RegExp(PERSON, 'u') }).click();
      await page.getByRole('tab', { name: 'Credentials' }).click();
      await page.getByRole('button', { name: 'Issue a one-time password' }).click();
    },
    leave: async (page) => {
      await page.getByRole('button', { name: 'Cancel' }).click();
    },
  },
];
