import {
  type AuditAction,
  type AuditEventType,
  type AuditOutcome,
  type AuditReason,
  type VocabularyEventType,
} from '#/service/vocabulary';

type VocabularyAction = AuditAction<VocabularyEventType>;

export const AUDIT_EVENT_TYPE_DOCS: Record<AuditEventType, string> = {
  admin_mutation:
    'A write made through the admin API or the `odudu console` command. Its action is free-form: ' +
    'one per mutation, named `<resource>.<verb>`.',
  admin_access:
    'A refusal at the admin API door: an authenticated caller without the capability, or a ' +
    'genuine token from another tenant.',
  authentication:
    'An answer to a sign-in step or to client authentication: a password, one-time code, ' +
    'recovery code or passkey, a second factor offered, a lockout tripped.',
  session: 'A user session was created or ended.',
  token: 'A token was issued, refreshed, exchanged or revoked, or a grant was revoked on reuse.',
  credential:
    'A credential was created or changed: registration, email verification, password reset and ' +
    'change, enrolment of a one-time-code or passkey factor, recovery codes issued.',
};

export const AUDIT_ACTION_DOCS: Record<VocabularyAction, string> = {
  'capability.refused':
    'An authenticated admin caller lacked the capability a route needs. `detail` names it.',
  'token.foreign_issuer':
    'A genuine token issued by another tenant was presented to the admin API.',
  'login.password': 'A password was checked at sign-in.',
  'login.otp': 'A one-time code was checked at sign-in.',
  'login.recovery_code': 'A recovery code was used in place of a second factor.',
  'login.passkey': 'A passkey assertion was checked at sign-in.',
  'factor.offered': 'A second factor was offered to a user who had passed the first.',
  'lockout.tripped': 'Failed sign-ins reached the limit and the subject was locked out.',
  'client.authenticate':
    'A client\u2019s authentication was refused at an endpoint that requires it.',
  'session.created': 'A user session was created by a completed sign-in.',
  'session.ended': 'A user session ended. `detail.via` says by logout, by an admin or by eviction.',
  'token.issue': 'The token endpoint issued tokens, or refused to.',
  'token.refresh': 'A refresh token was redeemed, or the redemption was refused.',
  'token.exchange':
    'A token exchange (RFC 8693) was answered. `detail.mode` says delegation or impersonation.',
  'token.revoke': 'A token was revoked at the revocation endpoint.',
  'grant.revoked_on_reuse':
    'A refresh token was presented again after rotation, so its whole grant was revoked.',
  'grant.revoked_on_code_replay':
    'An authorization code was redeemed a second time, so the grant it produced was revoked.',
  'account.registered': 'A user registered their own account.',
  'email.verified': 'A user verified their email address through the mailed link.',
  'password.reset': 'A password was set through a reset link.',
  'password.changed': 'A user changed their password.',
  'otp.enrolled': 'A user enrolled a one-time-code authenticator.',
  'passkey.enrolled': 'A user enrolled a passkey.',
  'recovery_codes.issued': 'A user was issued a new set of recovery codes.',
};

export const AUDIT_REASON_DOCS: Record<AuditReason, string> = {
  unknown_subject: 'The username or email names no subject.',
  bad_credential: 'The credential presented did not match.',
  locked_out: 'The subject is locked out after too many failures.',
  replayed: 'A credential that can be used once was presented again.',
  already_used: 'The code, token or link was already used.',
  subject_mismatch: 'The credential belongs to another subject than the one signing in.',
  invalid_grant: 'The grant presented is unknown, expired or not usable here.',
  invalid_scope: 'A requested scope is not allowed for this client.',
  invalid_target: 'A requested resource is not allowed for this client.',
  unauthorized_client: 'The client is not allowed to use this grant type.',
  unsupported_token_type: 'The token type is not one the endpoint handles.',
  rate_limited: 'The request was over its budget.',
  foreign_issuer: 'The token was issued by another tenant.',
  missing_capability: 'The caller lacks the admin capability the route requires.',
};

export const AUDIT_OUTCOME_DOCS: Record<AuditOutcome, string> = {
  allowed: 'The action happened.',
  refused: 'The action was refused by a rule: a bad credential, a missing capability, a limit.',
  failed: 'The action was attempted and an error stopped it.',
};
