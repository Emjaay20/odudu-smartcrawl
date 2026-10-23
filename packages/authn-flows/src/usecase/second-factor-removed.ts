import { type TenantScopedDatabase } from '@odudu/db';
import { credentialRepository } from '@odudu/domain-identity';
import { requiredActionRepository } from '#/repository/required-actions';

export interface RecoveryRevocation {
  readonly revoked: number;
  readonly reason: 'last_factor_removed';
}

export interface SecondFactorRemovedOutcome {
  readonly recoveryCodesRevoked: number;
}

// Called after a TOTP or passkey row is deleted, in the same transaction and
// with the subject's row locked, so two removals serialise. A recovery code
// stands in only for a TOTP code, so with no TOTP left the whole set goes,
// spent rows included, and any owed set with it (ADR 0021's amendment);
// `record` writes the audit row, and is not called when nothing was revoked.
export async function onSecondFactorRemoved(
  tx: TenantScopedDatabase,
  input: { subjectId: string },
  record: (detail: RecoveryRevocation) => Promise<void>,
): Promise<SecondFactorRemovedOutcome> {
  const credentials = credentialRepository(tx);
  const standing = await credentials.recoveryStanding(input.subjectId);
  if (standing.hasTotp) return { recoveryCodesRevoked: 0 };

  await requiredActionRepository(tx).complete(input.subjectId, 'generate-recovery-codes');
  if (standing.held === 0) return { recoveryCodesRevoked: 0 };

  const revoked = await credentials.deleteRecoveryCodes(input.subjectId);
  await record({ revoked, reason: 'last_factor_removed' });
  return { recoveryCodesRevoked: revoked };
}
