import { withTenant, type DatabaseHandle, type TenantScopedDatabase } from '@odudu/db';
import { auditRepository, type RequestContext } from '@odudu/domain-audit';
import {
  isRegistrationKey,
  pendingRegistrationRepository,
} from '#/repository/pending-registrations';

// Re-exported so the view layer can tell a registration link from another
// without importing the repository (no-view-to-repository).
export { isRegistrationKey };
import { classifyAccountCreationError, type TakenIdentifiers } from '#/usecase/register';

export interface VerifiedAccountInput {
  readonly username: string;
  readonly email: string;
  readonly passwordHash: string;
}

export interface CompleteRegistrationDeps {
  readonly database: DatabaseHandle;
  readonly tenantId: string;
  readonly request: RequestContext;
  readonly now: () => Date;
  // Injected like register's createAccount: the identity tables belong to
  // @odudu/domain-identity. The account it makes holds the hash register
  // made, and its address is verified, because the link proved it.
  readonly createVerifiedAccount: (
    tx: TenantScopedDatabase,
    tenantId: string,
    input: VerifiedAccountInput,
  ) => Promise<{ subjectId: string }>;
  readonly findTaken: (
    tx: TenantScopedDatabase,
    tenantId: string,
    who: { username: string; email: string },
  ) => Promise<TakenIdentifiers>;
}

export type CompleteRegistrationResult =
  | { kind: 'registered'; authenticationSessionId: string | null }
  | { kind: 'username_taken' }
  | { kind: 'invalid' };

// One transaction: the pending row is taken, uniqueness is checked again
// against the accounts that exist now, and the account is made. A key that is
// unknown, spent, expired or another tenant's gives the same answer.
export async function completeRegistration(
  deps: CompleteRegistrationDeps,
  key: string,
): Promise<CompleteRegistrationResult> {
  try {
    return await withTenant(
      deps.database.db,
      deps.tenantId,
      async (tx): Promise<CompleteRegistrationResult> => {
        const pending = await pendingRegistrationRepository(tx).take(key, deps.now());
        if (pending === null) return { kind: 'invalid' };
        const taken = await deps.findTaken(tx, deps.tenantId, pending);
        if (taken.username) return { kind: 'username_taken' };
        if (taken.emailOwner !== null) return { kind: 'invalid' };
        const account = await deps.createVerifiedAccount(tx, deps.tenantId, pending);
        await auditRepository(tx).record({
          eventType: 'credential',
          action: 'account.registered',
          outcome: 'allowed',
          actorSubjectId: account.subjectId,
          resourceType: 'subject',
          resourceId: account.subjectId,
        });
        return { kind: 'registered', authenticationSessionId: pending.authenticationSessionId };
      },
      deps.request,
    );
  } catch (err) {
    const failure = classifyAccountCreationError(err);
    if (failure === 'username_taken') return { kind: 'username_taken' };
    if (failure === 'email_taken' || failure === 'invalid_email') return { kind: 'invalid' };
    throw err;
  }
}

// Whether a link would create an account, asked without creating it.
export async function registrationWaiting(
  deps: Pick<CompleteRegistrationDeps, 'database' | 'tenantId' | 'now'>,
  key: string,
): Promise<boolean> {
  return withTenant(deps.database.db, deps.tenantId, (tx) =>
    pendingRegistrationRepository(tx).waiting(key, deps.now()),
  );
}
