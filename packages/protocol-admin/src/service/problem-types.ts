export interface AdminProblemType {
  readonly status: number;
  readonly summary: string;
}

// What a problem whose `type` is plain `about:blank` says: nothing beyond its status.
export const GENERIC_PROBLEM_SUMMARY =
  'A problem with `type` `about:blank` carries no more meaning than its HTTP status and ' +
  '`title`: `detail` says what was wrong with this request. Most refusals are of this kind.';

// The refusals that have a type of their own, keyed by the fragment after
// `about:blank#`, which a client can switch on without reading `detail`.
export const ADMIN_PROBLEM_TYPES: Readonly<Record<string, AdminProblemType>> = {
  'audit-query-too-broad': {
    status: 400,
    summary:
      'The audit read ran past its five second bound because its filters match too many rows ' +
      'to serve cheaply. Narrow the time range with `from` and `to`.',
  },
  'export-too-large': {
    status: 413,
    summary:
      'An audit export or a tenant export would be larger than the cap, and is refused whole ' +
      'rather than cut short. Narrow the audit export with `from`, `to` or another filter.',
  },
  'flow-duplicate-authenticator': {
    status: 400,
    summary:
      'A replacement authentication flow names the same authenticator in two steps. A step is ' +
      'addressed by its authenticator, so a repeat has no unambiguous meaning.',
  },
  'flow-empty': {
    status: 400,
    summary:
      'A replacement authentication flow has no steps. A tenant with no flow cannot be logged ' +
      'into.',
  },
  'flow-no-enabled-step': {
    status: 400,
    summary: 'Every step of a replacement authentication flow is disabled, so nobody could log in.',
  },
  'flow-no-first-challenge': {
    status: 400,
    summary:
      'No step of a replacement authentication flow would run at the start of a login, when ' +
      'no subject is bound yet.',
  },
  'flow-unknown-authenticator': {
    status: 400,
    summary:
      'A step of a replacement authentication flow names an authenticator that is not ' +
      'registered. `detail` lists the ones that are.',
  },
  'key-active': {
    status: 409,
    summary: 'The signing key is the active one and cannot be retired. Promote another key first.',
  },
  'key-algorithm-needed': {
    status: 409,
    summary:
      'Retiring the signing key would leave no key for an algorithm a client still requires ' +
      'for its ID tokens or UserInfo responses. `detail` names the clients.',
  },
  'key-not-retired': {
    status: 409,
    summary: 'Only a retired signing key can be deleted. Retire it first.',
  },
  'last-administrator': {
    status: 409,
    summary:
      'The write would leave the tenant with no enabled administrator. `detail` names who ' +
      'would be the last.',
  },
  'logout-deliveries-pending': {
    status: 409,
    summary:
      'The tenant still has back-channel logout tokens to send, and deleting it would ' +
      'discard them. Wait for them to be delivered.',
  },
  'no-email': {
    status: 409,
    summary: 'The subject has no email address to send the message to.',
  },
  'no-mail-relay': {
    status: 409,
    summary:
      'The tenant has no SMTP relay and the deployment no sender, so the mail would only be ' +
      'logged.',
  },
  'reset-password-off': {
    status: 409,
    summary:
      'The tenant has `reset_password_allowed` off, so it would refuse the link. Turn the ' +
      'setting on first.',
  },
  'sessions-live': {
    status: 409,
    summary:
      'Deleting the tenant was refused because sessions are still live. Disable the tenant ' +
      'again to end them and tell their relying parties.',
  },
  'sessions-not-ended': {
    status: 500,
    summary:
      'The tenant was disabled, but ending its sessions did not finish. Repeat the request to ' +
      'finish it.',
  },
  'tenant-enabled': {
    status: 409,
    summary:
      'A tenant must be disabled before it is deleted, which ends its sessions and tells ' +
      'their relying parties.',
  },
};

export function problemTypeUri(name: string): string {
  return `about:blank#${name}`;
}
