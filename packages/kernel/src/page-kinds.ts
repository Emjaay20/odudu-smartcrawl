// What the server emits for each page kind, by slot name. `required` parts
// each appear in a template exactly once; `optional` ones at most once. A
// template can hold no <form>, so the form's open and close tags are parts.
export type PageKind =
  | 'sign-in'
  | 'consent'
  | 'select-account'
  | 'logout-confirm'
  | 'totp-enrolment'
  | 'passkey-enrolment'
  | 'recovery-codes'
  | 'update-password'
  | 'required-action'
  | 'registration'
  | 'reset'
  | 'verification'
  | 'required-actions'
  | 'authorize-error'
  | 'email-unverified'
  | 'logged-out';

export interface PageManifest {
  readonly required: readonly string[];
  readonly optional: readonly string[];
  // Parts that must sit between form.open and form.close when they appear.
  readonly inForm: readonly string[];
}

const FORM_OPEN = 'form.open';
const FORM_CLOSE = 'form.close';

// `form.open` carries every hidden field the form posts, the proof
// included, so a template cannot drop or forge one. `fields` is one slot
// where the inputs depend on the step. `intro` is the heading with the tenant
// and client it is for, which only the server knows. `logged-out` stands for the four
// pages that end a session or refuse a logout, none with a form. Pages
// outside any tenant's scope (not-found, server-error, throttled, the
// console's refusal) have no kind.
export const PAGE_KINDS: Record<PageKind, PageManifest> = {
  'sign-in': {
    required: [FORM_OPEN, 'fields', 'submit', FORM_CLOSE],
    optional: ['intro', 'error', 'links', 'passkey'],
    inForm: ['fields', 'submit'],
  },
  consent: {
    required: [FORM_OPEN, 'scopes', 'submit.allow', 'submit.deny', FORM_CLOSE],
    optional: ['intro', 'error', 'links'],
    inForm: ['scopes', 'submit.allow', 'submit.deny'],
  },
  'select-account': {
    required: [FORM_OPEN, 'accounts', 'submit.other', FORM_CLOSE],
    optional: ['intro'],
    inForm: ['accounts', 'submit.other'],
  },
  'logout-confirm': {
    required: [FORM_OPEN, 'submit', FORM_CLOSE],
    optional: [],
    inForm: ['submit'],
  },
  'totp-enrolment': {
    required: [FORM_OPEN, 'offer', 'fields', 'submit', FORM_CLOSE],
    optional: ['error'],
    inForm: ['fields', 'submit'],
  },
  'passkey-enrolment': {
    required: [FORM_OPEN, 'fields', 'submit', 'script', FORM_CLOSE],
    optional: ['error'],
    inForm: ['fields', 'submit'],
  },
  'recovery-codes': {
    required: ['codes', FORM_OPEN, 'submit', FORM_CLOSE],
    optional: ['notice'],
    inForm: ['submit'],
  },
  'update-password': {
    required: [FORM_OPEN, 'fields', 'submit', FORM_CLOSE],
    optional: ['error'],
    inForm: ['fields', 'submit'],
  },
  'required-action': { required: ['message'], optional: ['links'], inForm: [] },
  registration: {
    required: [FORM_OPEN, 'fields', 'submit', FORM_CLOSE],
    optional: ['error', 'links'],
    inForm: ['fields', 'submit'],
  },
  reset: {
    required: [FORM_OPEN, 'fields', 'submit', FORM_CLOSE],
    optional: ['error', 'links'],
    inForm: ['fields', 'submit'],
  },
  verification: {
    required: ['message'],
    optional: [FORM_OPEN, 'submit', FORM_CLOSE, 'links'],
    inForm: ['submit'],
  },
  'required-actions': {
    required: [FORM_OPEN, 'fields', 'submit', FORM_CLOSE],
    optional: ['error'],
    inForm: ['fields', 'submit'],
  },
  'authorize-error': { required: ['message'], optional: ['links', 'code'], inForm: [] },
  'email-unverified': { required: ['message'], optional: ['links'], inForm: [] },
  'logged-out': {
    required: ['message'],
    optional: ['links', 'frames', 'script'],
    inForm: [],
  },
};
