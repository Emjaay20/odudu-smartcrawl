import type { MailBrandingView, ThemePreviewInfo } from '@odudu/contracts/admin';
import { json, type Answer } from '#/testing/fakeTransport';
import { ACME_ADMIN } from '#/testing/tenantPaths';
import { graceRoutes } from '#/testing/renderConsole';
import { EVERY_TENANT_CAPABILITY } from '#/testing/roleAnswers';
import { settingsAnswer, ST } from '#/testing/settingsFixtures';

export const TH = `${ACME_ADMIN}/theme`;

export const EMPTY = { tokens: {}, stylesheet: null, templates: {}, assets: {} };

const LIGHT = {
  surfacePage: '#ffffff',
  surfacePanel: '#ffffff',
  surfaceSunken: '#f3f5f4',
  inkPrimary: '#161b1a',
  inkMuted: '#56605d',
  signalActive: '#dcf0e6',
  signalActiveInk: '#0a6344',
  signalDanger: '#fae3d7',
  signalDangerInk: '#9c3a0e',
  borderStrong: '#6b7370',
  focusRing: '#0a7c55',
};

export const OWN_LIGHT = LIGHT;

export const LOGO_ID = 'a1b2c3d4-0000-4000-8000-000000000001';

// A tenant with nothing set: Instrument's own pages, and no draft.
export function themeView(changes: Record<string, unknown> = {}) {
  return {
    scope: 'tenant',
    draft: null,
    published: null,
    sources: {},
    draft_sources: null,
    ...changes,
  };
}

// A tenant whose draft sets the light colours and a logo, published once with
// the colours only.
export function draftedView() {
  const draft = {
    ...EMPTY,
    tokens: { light: LIGHT },
    assets: { logo: { assetId: LOGO_ID, alt: 'Acme' } },
  };
  return themeView({
    draft,
    published: {
      id: 'v1',
      version: 1,
      published_at: '2026-10-20T09:00:00.000Z',
      body: { ...EMPTY, tokens: { light: LIGHT } },
    },
    sources: { 'tokens.light': 'tenant', 'assets.logo': 'default' },
    draft_sources: { 'tokens.light': 'tenant', 'assets.logo': 'tenant' },
  });
}

export function themeAnswer(view: Record<string, unknown> = themeView(), etag?: string): Answer {
  return json(view, 200, etag === undefined ? {} : { etag });
}

export function versionsAnswer(items: readonly Record<string, unknown>[] = []): Answer {
  return json({ items });
}

export const VERSION_2 = {
  id: 'v2',
  version: 2,
  state: 'published',
  created_at: '2026-10-22T09:00:00.000Z',
  published_at: '2026-10-22T09:00:00.000Z',
};

export const VERSION_1 = {
  id: 'v1',
  version: 1,
  state: 'archived',
  created_at: '2026-10-20T09:00:00.000Z',
  published_at: '2026-10-20T09:00:00.000Z',
};

// grace of acme holding the capabilities given, with a theme read as `theme`.
export function brandingRoutes(
  theme: Answer = themeAnswer(),
  extra: Record<string, Answer> = {},
  capabilities: readonly string[] = EVERY_TENANT_CAPABILITY,
): Record<string, Answer> {
  return graceRoutes(
    capabilities,
    {
      [`GET ${TH}`]: theme,
      [`GET ${TH}/versions`]: versionsAnswer([VERSION_2, VERSION_1]),
      [`GET ${MC}`]: json(CATALOGUE),
      [`GET ${PI}`]: json(previewInfo()),
    },
    extra,
  );
}

export const ML = `${ACME_ADMIN}/mail/branding`;
export const MO = `${ACME_ADMIN}/message-overrides`;
export const MC = `${ACME_ADMIN}/message-catalogue`;
export const PI = `${TH}/preview/info`;

const MAIL_COLOURS = {
  page: '#e7eae9',
  panel: '#ffffff',
  sunken: '#f3f5f4',
  border: '#d4d9d7',
  ink: '#161b1a',
  muted: '#56605d',
  link: '#0a6344',
  button: '#161b1a',
  button_ink: '#ffffff',
};

// A tenant whose published theme sets the light colours and a logo, and
// leaves the dark colours to the default.
export function mailBranding(changes: Partial<MailBrandingView> = {}): MailBrandingView {
  return {
    light: { source: 'tenant', colours: { ...MAIL_COLOURS, panel: '#fafafa' } },
    dark: {
      source: 'default',
      colours: { ...MAIL_COLOURS, page: '#151a19', panel: '#1c2221', ink: '#e4e9e7' },
    },
    logo: { src: 'https://id.example/brand/a.png', alt: 'Acme logo', width: 160, height: 32 },
    dark_logo: null,
    ...changes,
  };
}

// The messages a sign-in page and a registration page are filled from.
export const CATALOGUE = {
  sections: [
    {
      kinds: ['sign-in', 'consent', 'select-account', 'logout-confirm'],
      messages: [
        { key: 'login.help', en: 'Ask your administrator' },
        { key: 'login.submit', en: 'Sign in' },
        { key: 'login.title', en: 'Sign in to your account' },
      ],
    },
    {
      kinds: ['registration', 'reset'],
      messages: [
        { key: 'register.title', en: 'Create an account' },
        { key: 'register.submit', en: 'Register' },
      ],
    },
  ],
};

// What the preview says of a draft that is shown as it is.
export function previewInfo(changes: Partial<ThemePreviewInfo> = {}): ThemePreviewInfo {
  return {
    kind: 'sign-in',
    from: 'draft',
    shown: 'tenant',
    faults: [],
    refused: [],
    unfilled: false,
    ...changes,
  };
}

export function override(key: string, message: string, locale = 'en') {
  return { locale, key, message, updated_at: '2026-10-20T09:00:00.000Z' };
}

export const TITLE_OVERRIDE = override('login.title', 'Welcome back');
export const HELP_OVERRIDE = override('login.help', 'Ask your administrator');

// grace of acme on the Mail and Languages tabs: settings, mail branding and
// two overrides in English.
export function languagesRoutes(
  extra: Record<string, Answer> = {},
  settings: Record<string, unknown> = { supported_locales: ['en', 'ar'] },
): Record<string, Answer> {
  return brandingRoutes(themeAnswer(draftedView(), '"d1"'), {
    [`GET ${ST}`]: settingsAnswer(settings),
    [`GET ${MO}`]: json({ items: [TITLE_OVERRIDE, HELP_OVERRIDE] }),
    [`GET ${ML}`]: json(mailBranding()),
    ...extra,
  });
}
