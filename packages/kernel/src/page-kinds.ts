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
}

const FORM_OPEN = 'form.open';
const FORM_CLOSE = 'form.close';

// `fields` is one slot where the form's inputs depend on the step (sign-in
// shows a username and password, then a code, then a recovery code).
// `error` is the server's problem summary and is optional because a page
// without a problem renders nothing there. `links` is the way on (back to
// sign-in, continue). Not-found, server-error, throttled and the console's
// refusal page are in no tenant's scope and have no kind.
export const PAGE_KINDS: Record<PageKind, PageManifest> = {
  'sign-in': {
    required: [FORM_OPEN, 'fields', 'submit', FORM_CLOSE],
    optional: ['error', 'links', 'passkey'],
  },
  consent: {
    required: [FORM_OPEN, 'scopes', 'submit.allow', 'submit.deny', FORM_CLOSE],
    optional: ['error'],
  },
  'select-account': {
    required: [FORM_OPEN, 'accounts', 'submit.other', FORM_CLOSE],
    optional: [],
  },
  'logout-confirm': {
    required: [FORM_OPEN, 'submit', FORM_CLOSE],
    optional: [],
  },
  'totp-enrolment': {
    required: [FORM_OPEN, 'offer', 'fields', 'submit', FORM_CLOSE],
    optional: ['error'],
  },
  'passkey-enrolment': {
    required: [FORM_OPEN, 'fields', 'submit', 'script', FORM_CLOSE],
    optional: ['error'],
  },
  'recovery-codes': {
    required: ['codes', FORM_OPEN, 'submit', FORM_CLOSE],
    optional: [],
  },
  'update-password': {
    required: [FORM_OPEN, 'fields', 'submit', FORM_CLOSE],
    optional: ['error'],
  },
  'required-action': {
    required: ['message'],
    optional: ['links'],
  },
  registration: {
    required: [FORM_OPEN, 'fields', 'submit', FORM_CLOSE],
    optional: ['error', 'links'],
  },
  reset: {
    required: [FORM_OPEN, 'fields', 'submit', FORM_CLOSE],
    optional: ['error', 'links'],
  },
  verification: {
    required: ['message'],
    optional: [FORM_OPEN, 'submit', FORM_CLOSE, 'links'],
  },
  'required-actions': {
    required: [FORM_OPEN, 'fields', 'submit', FORM_CLOSE],
    optional: ['error'],
  },
  'authorize-error': {
    required: ['message'],
    optional: ['links'],
  },
  'email-unverified': {
    required: ['message'],
    optional: ['links'],
  },
  'logged-out': {
    required: ['message'],
    optional: ['links', 'frames', 'script'],
  },
};
