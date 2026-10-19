import { type TenantScopedDatabase } from '@odudu/db';
import { credentialRepository } from '@odudu/domain-identity';

export interface RecoveryRevocation {
  readonly revoked: number;
  readonly reason: 'last_factor_removed';
}

export interface SecondFactorRemovedOutcome {
  readonly recoveryCodesRevoked: number;
}

// Called after a TOTP or passkey credential row has been deleted, in the
// same transaction and with the subject's row locked, so two removals
// serialise and the second sees the first's deletion. A recovery code
// stands in for a second factor; with none left the set is a way past a
// factor that no longer exists, possibly one that left with a lost device,
// so the whole set goes, spent rows included, and a re-enrolment finds none
// and issues a fresh one. `record` writes the audit row in the caller's
// transaction; it is not called when there was nothing to revoke.
export async function onSecondFactorRemoved(
  tx: TenantScopedDatabase,
  input: { subjectId: string },
  record: (detail: RecoveryRevocation) => Promise<void>,
): Promise<SecondFactorRemovedOutcome> {
  const credentials = credentialRepository(tx);
  const standing = await credentials.recoveryStanding(input.subjectId);
  if (standing.hasSecondFactor || standing.held === 0) return { recoveryCodesRevoked: 0 };

  const revoked = await credentials.deleteRecoveryCodes(input.subjectId);
  await record({ revoked, reason: 'last_factor_removed' });
  return { recoveryCodesRevoked: revoked };
}
