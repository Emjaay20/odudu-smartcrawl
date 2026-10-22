import { type DatabaseHandle, type TenantScopedDatabase } from '@odudu/db';
import { requestContextFrom } from '@odudu/domain-audit';
import { PASSWORD_TOO_LONG, readPasswordField } from '@odudu/kernel';
import { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { signInPath } from '#/service/sign-in-path';
import { peekActionToken, type LinkedRequiredAction } from '#/usecase/action-token';
import { type PasswordFailure } from '#/view/password-rules';
import {
  completePasswordReset,
  type PasswordPolicy,
  type PolicyViolation,
} from '#/usecase/reset-password';
import {
  completeRequiredActions,
  type CompleteRequiredActionsDeps,
} from '#/usecase/execute-actions';
import { completeEmailVerification } from '#/usecase/verify-email';
import {
  renderResetLinkFailedPage,
  renderResetPasswordForm,
  renderResetPasswordSucceededPage,
} from '#/view/reset-html';
import {
  renderRequiredActionsForm,
  renderRequiredActionsSucceededPage,
} from '#/view/required-actions-html';
import {
  renderVerificationFailedPage,
  renderVerificationSucceededPage,
  sendVerificationHtml,
} from '#/view/verification-html';
import { requestLocale } from '#/view/request-locale';

export interface ActionTokenTenantLookup {
  readonly id: string;
  readonly enabled: boolean;
  // The kill switch: an operator who turns this off during an incident
  // means every outstanding reset-password link to stop working too, not
  // only the request form. A verify-email link is unaffected — redeeming
  // one is gated on tenant.enabled alone, the same as before this flag
  // existed.
  readonly resetPasswordAllowed: boolean;
  readonly passwordPolicy: PasswordPolicy;
}

export interface ActionTokenRouteDeps {
  // The tags a page can be shown in; defaults to what the server ships.
  pageLocales?: readonly string[];
  readonly database: DatabaseHandle;
  readonly findTenant: (name: string) => Promise<ActionTokenTenantLookup | null>;
  readonly getCurrentEmail: (tx: TenantScopedDatabase, subjectId: string) => Promise<string | null>;
  readonly markVerified: (tx: TenantScopedDatabase, subjectId: string) => Promise<void>;
  // Injected for the same reason getCurrentEmail and markVerified are:
  // @odudu/account never imports @odudu/domain-identity, where hashPassword
  // and the credentials table live.
  readonly setPassword: (
    tx: TenantScopedDatabase,
    subjectId: string,
    newPassword: string,
  ) => Promise<void>;
  readonly getUsername: (tx: TenantScopedDatabase, subjectId: string) => Promise<string>;
  readonly evaluatePassword: (
    candidate: string,
    policy: PasswordPolicy,
    subject: { username: string; email: string | null },
  ) => PolicyViolation[];
  // Both injected for the same reason setPassword is — see
  // completePasswordReset in #/usecase/reset-password.ts, which explains
  // what each one closes.
  readonly unchangedPasswordViolations: (
    tx: TenantScopedDatabase,
    subjectId: string,
    candidate: string,
  ) => Promise<PolicyViolation[]>;
  readonly clearPasswordUpdateAction: (
    tx: TenantScopedDatabase,
    subjectId: string,
  ) => Promise<void>;
  // Injected for the same reason: the subject's owed actions are
  // @odudu/authn-flows' table, which this package does not import.
  readonly addRequiredActions: CompleteRequiredActionsDeps['addRequiredActions'];
}

// @fastify/formbody parses a repeated query or body field into an array; a
// repeat is treated as absent rather than silently picking one, the same
// rule packages/protocol-oidc/src/view/routes/login.ts's firstString
// applies.
function firstString(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function firstNonEmptyString(value: string | string[] | undefined): string | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined;
  return value;
}

// Where a person whose reset link failed asks for another: this tenant's
// own request form, offered only while the tenant still allows resets.
function newResetLink(tenantName: string, tenant: ActionTokenTenantLookup): string | null {
  return tenant.resetPasswordAllowed
    ? `/tenants/${encodeURIComponent(tenantName)}/login-actions/reset-password`
    : null;
}

async function completeActionsLink(
  request: FastifyRequest<{
    Params: { tenant: string };
    Body: Record<string, string | string[] | undefined>;
  }>,
  reply: FastifyReply,
  deps: ActionTokenRouteDeps,
  tenant: ActionTokenTenantLookup,
  key: string,
  peeked: { actions: readonly LinkedRequiredAction[]; setsPassword: boolean },
): Promise<FastifyReply> {
  const locale = requestLocale(request, deps);
  const { setsPassword } = peeked;
  const returnTo = signInPath(request.params.tenant, request.body.return_to);
  // The form the link opened, back in place with why the password was refused.
  const again = (failure: PasswordFailure): FastifyReply =>
    sendVerificationHtml(
      reply,
      400,
      renderRequiredActionsForm(
        request.params.tenant,
        key,
        peeked.actions,
        setsPassword,
        returnTo,
        failure,
        locale,
      ),
    );
  if (setsPassword && !tenant.resetPasswordAllowed) {
    return sendVerificationHtml(reply, 400, renderResetLinkFailedPage(null, returnTo, locale));
  }
  const candidate = readPasswordField(request.body.password);
  if (candidate.kind === 'too_long') {
    return again([PASSWORD_TOO_LONG]);
  }
  const password =
    candidate.kind === 'present' && candidate.password.length > 0 ? candidate.password : undefined;

  const result = await completeRequiredActions(
    {
      database: deps.database,
      tenantId: tenant.id,
      request: requestContextFrom(request),
      setPassword: deps.setPassword,
      passwordPolicy: tenant.passwordPolicy,
      evaluatePassword: deps.evaluatePassword,
      getUsername: deps.getUsername,
      unchangedPasswordViolations: deps.unchangedPasswordViolations,
      clearPasswordUpdateAction: deps.clearPasswordUpdateAction,
      addRequiredActions: deps.addRequiredActions,
    },
    key,
    password,
  );
  switch (result.kind) {
    case 'invalid':
      return sendVerificationHtml(reply, 400, renderResetLinkFailedPage(null, returnTo, locale));
    case 'password_required':
      return again('required');
    case 'invalid_password':
      return again(result.violations);
    case 'done':
      return sendVerificationHtml(
        reply,
        200,
        renderRequiredActionsSucceededPage(result.remaining, returnTo, locale),
      );
  }
}

// Not under /protocol/openid-connect/: this is Odudu's own account UI, the
// same namespace choice login.ts documents for /login-actions/authenticate.
export function registerActionTokenRoute(app: FastifyInstance, deps: ActionTokenRouteDeps): void {
  app.get<{
    Params: { tenant: string };
    Querystring: Record<string, string | string[] | undefined>;
  }>('/tenants/:tenant/login-actions/action-token', async (request, reply) => {
    const locale = requestLocale(request, deps);
    const key = firstString(request.query.key);
    const returnTo = signInPath(request.params.tenant, request.query.return_to);
    const tenant = key === undefined ? null : await deps.findTenant(request.params.tenant);

    // A disabled tenant refuses here the same way it refuses at /token,
    // /userinfo, discovery and login: consuming a token is a write against
    // that tenant's users table, and disabling a tenant is meant to stop all
    // of those, not just the ones a client can see.
    if (key === undefined || !tenant?.enabled) {
      return sendVerificationHtml(reply, 400, renderVerificationFailedPage(returnTo, locale));
    }

    // A read, not a redemption: a reset-password link needs a page shown
    // before anything is consumed, so its type has to be known ahead of
    // that decision. A verify-email link consumes on this same GET, the
    // way it always has — peeking first only tells the two branches apart,
    // it never changes the verify-email one's behaviour.
    const peeked = await peekActionToken({ database: deps.database, tenantId: tenant.id }, key);
    if (peeked.kind === 'invalid') {
      // A reset or actions link the row of which is still held says so, and a
      // reset link offers a new one; any other refusal stays the generic page.
      if (peeked.type === 'reset_password' || peeked.type === 'execute_actions') {
        return sendVerificationHtml(
          reply,
          400,
          renderResetLinkFailedPage(
            peeked.type === 'reset_password' ? newResetLink(request.params.tenant, tenant) : null,
            returnTo,
            locale,
          ),
        );
      }
      return sendVerificationHtml(reply, 400, renderVerificationFailedPage(returnTo, locale));
    }

    if (peeked.type === 'reset_password') {
      if (!tenant.resetPasswordAllowed) {
        return sendVerificationHtml(reply, 400, renderResetLinkFailedPage(null, returnTo, locale));
      }
      return sendVerificationHtml(
        reply,
        200,
        renderResetPasswordForm(request.params.tenant, key, returnTo, undefined, locale),
      );
    }

    // A link that sets a password is a reset link, and the reset kill switch
    // stops it the same way.
    if (peeked.type === 'execute_actions') {
      if (peeked.setsPassword && !tenant.resetPasswordAllowed) {
        return sendVerificationHtml(reply, 400, renderResetLinkFailedPage(null, returnTo, locale));
      }
      return sendVerificationHtml(
        reply,
        200,
        renderRequiredActionsForm(
          request.params.tenant,
          key,
          peeked.actions,
          peeked.setsPassword,
          returnTo,
          undefined,
          locale,
        ),
      );
    }

    const result = await completeEmailVerification(
      {
        database: deps.database,
        tenantId: tenant.id,
        request: requestContextFrom(request),
        getCurrentEmail: deps.getCurrentEmail,
        markVerified: deps.markVerified,
      },
      key,
    );

    if (result.kind === 'invalid') {
      return sendVerificationHtml(reply, 400, renderVerificationFailedPage(returnTo, locale));
    }
    return sendVerificationHtml(reply, 200, renderVerificationSucceededPage(returnTo, locale));
  });

  app.post<{
    Params: { tenant: string };
    Body: Record<string, string | string[] | undefined>;
  }>('/tenants/:tenant/login-actions/action-token', async (request, reply) => {
    const locale = requestLocale(request, deps);
    const body = request.body;
    const key = firstNonEmptyString(body.key);
    const candidate = readPasswordField(body.password);
    const returnTo = signInPath(request.params.tenant, body.return_to);
    const tenant = key === undefined ? null : await deps.findTenant(request.params.tenant);

    if (key === undefined || !tenant?.enabled) {
      return sendVerificationHtml(reply, 400, renderResetLinkFailedPage(null, returnTo, locale));
    }

    const peeked = await peekActionToken({ database: deps.database, tenantId: tenant.id }, key);
    if (peeked.kind === 'usable' && peeked.type === 'execute_actions') {
      return completeActionsLink(request, reply, deps, tenant, key, peeked);
    }
    if (!tenant.resetPasswordAllowed) {
      return sendVerificationHtml(reply, 400, renderResetLinkFailedPage(null, returnTo, locale));
    }
    // A key nothing usable holds gets the link-failed page whatever else was
    // posted, rather than a form for a link that can no longer be redeemed.
    if (peeked.kind === 'invalid') {
      return sendVerificationHtml(
        reply,
        400,
        renderResetLinkFailedPage(newResetLink(request.params.tenant, tenant), returnTo, locale),
      );
    }
    // The form this submission came from, back in place with why it was refused.
    const again = (failure: PasswordFailure): FastifyReply =>
      sendVerificationHtml(
        reply,
        400,
        renderResetPasswordForm(request.params.tenant, key, returnTo, failure, locale),
      );

    // Listed as a rule of the policy, because to the person typing it that
    // is what it is — but decided here rather than in evaluatePassword, so
    // the length is bounded before anything hashes it.
    if (candidate.kind === 'too_long') {
      return again([PASSWORD_TOO_LONG]);
    }
    const password =
      candidate.kind === 'present' && candidate.password.length > 0
        ? candidate.password
        : undefined;

    // Distinct from the link being unusable: the key is present and has
    // not been checked yet, so telling the redeemer their link "can't be
    // used" here would be false — it is a missing field, not a spent or
    // expired token.
    if (password === undefined) {
      return again('required');
    }

    const result = await completePasswordReset(
      {
        database: deps.database,
        tenantId: tenant.id,
        request: requestContextFrom(request),
        setPassword: deps.setPassword,
        passwordPolicy: tenant.passwordPolicy,
        evaluatePassword: deps.evaluatePassword,
        getUsername: deps.getUsername,
        unchangedPasswordViolations: deps.unchangedPasswordViolations,
        clearPasswordUpdateAction: deps.clearPasswordUpdateAction,
      },
      key,
      password,
    );

    if (result.kind === 'invalid_password') {
      return again(result.violations);
    }
    if (result.kind === 'invalid') {
      return sendVerificationHtml(
        reply,
        400,
        renderResetLinkFailedPage(newResetLink(request.params.tenant, tenant), returnTo, locale),
      );
    }
    return sendVerificationHtml(reply, 200, renderResetPasswordSucceededPage(returnTo, locale));
  });
}
