import { sessionRepository, sessions } from '@odudu/authn-flows';
import { signingKeyRepository, signJwt } from '@odudu/crypto';
import { type TenantScopedDatabase } from '@odudu/db';
import { auditRepository } from '@odudu/domain-audit';
import { newId } from '@odudu/kernel';
import { and, eq, gt } from 'drizzle-orm';
import { tokenGrantRepository, type ClientLogoutTarget } from '#/repository/grants';
import { logoutDeliveryRepository } from '#/repository/logout-deliveries';
import { logoutTokenClaims, LOGOUT_TOKEN_TYP } from '#/service/logout-token';

function hasBackchannelLogoutUri(
  target: ClientLogoutTarget,
): target is ClientLogoutTarget & { backchannelLogoutUri: string } {
  return target.backchannelLogoutUri !== null;
}

export interface EndSessionDeps {
  readonly kek: Uint8Array;
}

export interface EndSessionInput {
  readonly tenantId: string;
  readonly sessionId: string;
  readonly subjectId: string;
  readonly now: Date;
  readonly issuer: string;
  readonly via: 'logout' | 'admin';
}

// The one path that ends a session — the RP-Initiated Logout flow
// (`#/usecase/logout.ts`) and the admin API's session-ending route both
// call this rather than each carrying its own copy. One transaction, per
// Back-Channel Logout §2.7: end the session, revoke every grant it holds,
// then enqueue a delivery per client that used it and registered a
// back-channel URI. A failure anywhere rolls it all back, so nothing
// retries a delivery row that was never written.
export async function endSession(
  tx: TenantScopedDatabase,
  deps: EndSessionDeps,
  input: EndSessionInput,
): Promise<void> {
  const ended = await sessionRepository(tx).end(input.sessionId, input.now);
  if (ended) {
    await auditRepository(tx).record({
      eventType: 'session',
      action: 'session.ended',
      outcome: 'allowed',
      actorSubjectId: input.subjectId,
      resourceType: 'session',
      resourceId: input.sessionId,
      detail: { via: input.via },
    });
  }
  await tokenGrantRepository(tx).revokeForSession(input.sessionId, input.now);

  const targets = await tokenGrantRepository(tx).clientsForSession(input.sessionId);
  const backchannelTargets = targets.filter(hasBackchannelLogoutUri);
  if (backchannelTargets.length === 0) return;

  const key = await signingKeyRepository(tx).active();
  const deliveries = await Promise.all(
    backchannelTargets.map(async (target) => {
      const claims = logoutTokenClaims({
        issuer: input.issuer,
        audience: target.oauthClientId,
        subject: input.subjectId,
        sessionId: input.sessionId,
        now: input.now,
      });
      const logoutToken = await signJwt(
        { ...claims },
        { key, kek: deps.kek, typ: LOGOUT_TOKEN_TYP },
      );
      return {
        id: newId(),
        tenantId: input.tenantId,
        clientId: target.clientId,
        sessionId: input.sessionId,
        endpoint: target.backchannelLogoutUri,
        logoutToken,
        nextAttemptAt: input.now,
      };
    }),
  );
  await logoutDeliveryRepository(tx).enqueue(deliveries);
}

export interface EndAllAccessInput {
  readonly tenantId: string;
  readonly subjectId: string;
  readonly now: Date;
  readonly issuer: string;
}

// What recovering an account owes whoever else is signed in to it: every session
// of the subject ended the way a logout ends one (grants revoked, back-channel
// deliveries queued), then every grant left, offline ones included, revoked.
// One transaction with the password change that asks for it.
export async function endAllAccess(
  tx: TenantScopedDatabase,
  deps: EndSessionDeps,
  input: EndAllAccessInput,
): Promise<void> {
  const live = await tx
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.subjectId, input.subjectId), gt(sessions.expiresAt, input.now)));
  for (const { id } of live) {
    await endSession(tx, deps, {
      tenantId: input.tenantId,
      sessionId: id,
      subjectId: input.subjectId,
      now: input.now,
      issuer: input.issuer,
      via: 'logout',
    });
  }
  await tokenGrantRepository(tx).revokeForSubject(input.subjectId, input.now);
}
