// The server pages the landing page photographs, and what each one renders
// to. pnpm page-shots takes the pictures; a unit test compares a hash of the
// markup and the stylesheet with the one stored beside the pictures.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DEFAULT_PAGE_LOCALE, type PageLocale, type RenderedPage } from '@odudu/kernel';
import { renderRegistrationForm } from '../../../../packages/account/src/view/registration-html.ts';
import { renderResetRequestForm } from '../../../../packages/account/src/view/reset-html.ts';
import { renderLoginForm } from '../../../../packages/protocol-oidc/src/view/authorize-html.ts';
import { brandStyle } from './brand.ts';

export const THEMES = ['light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

const REPOSITORY = path.resolve(import.meta.dirname, '../../../..');
const STYLESHEET_SOURCES = [
  'apps/admin-console/src/shared/view/tokens.css',
  'apps/admin-console/src/shared/view/fonts.css',
  'packages/instrument/src/pages.css',
];

const SIGN_IN_PATH = '/tenants/acme/protocol/openid-connect/auth?client_id=notes';
const RULES = {
  minLength: 15,
  requireDigit: false,
  requireUppercase: false,
  requireLowercase: false,
  requireSpecial: false,
};

interface Shot {
  name: string;
  render: (locale: PageLocale) => RenderedPage;
}

export interface Job extends Shot {
  file: string;
  brand: boolean;
}

function login(form: string, locale: PageLocale): RenderedPage {
  return renderLoginForm(
    'acme',
    'a-session',
    form,
    false,
    true,
    undefined,
    false,
    'Notes',
    { createAccount: '/create', resetPassword: '/reset' },
    locale,
  );
}

const SHOTS: Shot[] = [
  { name: 'sign-in', render: (locale) => login('password', locale) },
  {
    name: 'create-account',
    render: (locale) =>
      renderRegistrationForm('acme', { rules: RULES, signInPath: SIGN_IN_PATH }, locale),
  },
  {
    name: 'reset-password',
    render: (locale) => renderResetRequestForm('acme', { signInPath: SIGN_IN_PATH }, locale),
  },
  { name: 'second-factor', render: (locale) => login('otp', locale) },
];

export const JOBS: Job[] = [
  ...SHOTS.map((shot) => ({ ...shot, file: shot.name, brand: false })),
  ...SHOTS.filter((shot) => shot.name === 'sign-in').map((shot) => ({
    ...shot,
    file: 'sign-in-branded',
    brand: true,
  })),
];

export function markupFor(job: Job, theme: Theme): string {
  const locale: PageLocale = { ...DEFAULT_PAGE_LOCALE, theme };
  const html = job.render(locale).html;
  return job.brand ? html.replace('</head>', `${brandStyle()}\n</head>`) : html;
}

// The stylesheet is built from these three sources, so hashing them stands in
// for the built file, which a fresh checkout does not have.
function stylesheetSources(): string {
  return STYLESHEET_SOURCES.map((file) => readFileSync(path.join(REPOSITORY, file), 'utf8')).join(
    '\n',
  );
}

// A page that carries a script draws a new nonce on every render.
const NONCE = /nonce="[^"]*"/gu;

export function renderedHash(job: Job): string {
  const hash = createHash('sha256');
  for (const theme of THEMES) hash.update(markupFor(job, theme).replace(NONCE, 'nonce=""'));
  hash.update(stylesheetSources());
  return hash.digest('hex').slice(0, 16);
}
