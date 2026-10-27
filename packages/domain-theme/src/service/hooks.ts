import { PAGE_KINDS } from '@odudu/kernel';

// Bumped whenever a hook is renamed or removed; adding one is not a break.
export const CSS_HOOKS_VERSION = 1;

// The classes the server pages render, which a tenant stylesheet may target.
// Each page also carries `page-<kind>`, one per page kind.
const RENDERED_HOOKS = [
  'alert',
  'brand',
  'choice',
  'context',
  'intro',
  'mark',
  'page',
  'quiet',
  'secondary',
  'tenant',
  'wordmark',
] as const;

export const CSS_HOOKS: readonly string[] = [
  ...RENDERED_HOOKS,
  ...Object.keys(PAGE_KINDS).map((kind) => `page-${kind}`),
];

export const CSS_ELEMENTS: readonly string[] = [
  'main',
  'h1',
  'h2',
  'h3',
  'p',
  'a',
  'ul',
  'ol',
  'li',
  'label',
  'input',
  'button',
  'small',
  'code',
  'img',
  'span',
  'div',
  'section',
  'header',
  'footer',
  'form',
];

// The Instrument design tokens a tenant stylesheet may read with var().
export const CSS_TOKENS: readonly string[] = [
  '--border-strong',
  '--control-height',
  '--ease',
  '--focus-ring',
  '--font-mono',
  '--font-sans',
  '--hairline',
  '--ink-muted',
  '--ink-primary',
  '--label-line',
  '--motion-fast',
  '--radius-m',
  '--radius-s',
  '--shadow-overlay',
  '--signal-active',
  '--signal-active-ink',
  '--signal-danger',
  '--signal-danger-ink',
  '--space-1',
  '--space-2',
  '--space-3',
  '--space-4',
  '--space-6',
  '--space-8',
  '--surface-grid',
  '--surface-page',
  '--surface-panel',
  '--surface-sunken',
  '--target-min',
  '--type-12',
  '--type-13',
  '--type-15',
  '--type-20',
];
