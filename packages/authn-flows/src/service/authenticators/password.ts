import { hashUserPassword, matchUserPassword, verifyPassword } from '@odudu/domain-identity';
import { type AuthenticatorResult } from '#/schema/authenticator';

// Verify against a constant hash when the caller has no real one, so an
// unknown username and a wrong password cost the same time as well as
// returning the same result.
const DUMMY_HASH = await hashUserPassword('odudu-dummy-verification-target');

export interface PasswordInput {
  username?: string;
  password?: string;
}

// What the caller (usecase/executor) already looked up, before this function
// runs — this stays a leaf: no `tx`, no repository, no cross-package call.
// `subjectId` is null exactly when there is no account to succeed into,
// whether because the username doesn't exist or the account has no password
// credential; `storedHash` is null under the same two conditions.
export interface PasswordVerification {
  subjectId: string | null;
  storedHash: string | null;
  // Whether the hash is marked as made from the NFC form. Only a hash that
  // is not may also be tried against the password as typed, so an attacker
  // cannot make a normalised account cost two verifications. True when there
  // is no account: the dummy hash is normalised.
  normalised: boolean;
  // Replaces a legacy hash and marks it (`null` marks it as it is), run once
  // the sign-in is known to be this subject's.
  upgrade?: (hash: string | null) => Promise<void>;
}

export async function passwordStep(
  input: PasswordInput,
  verification: PasswordVerification,
  verify: (stored: string, plain: string) => Promise<boolean> = verifyPassword,
): Promise<AuthenticatorResult> {
  if (input.username === undefined || input.password === undefined) {
    return { kind: 'challenge', form: 'password' };
  }
  const { password } = input;

  // Same call shape whether the user exists or not: an unknown username
  // reaches matchUserPassword against DUMMY_HASH exactly as a wrong password
  // reaches it against the real one.
  const matched = await matchUserPassword(
    verification.storedHash ?? DUMMY_HASH,
    password,
    !verification.normalised,
    verify,
  );

  if (verification.subjectId === null || verification.storedHash === null || matched === null) {
    return { kind: 'failure', reason: 'invalid_credentials' };
  }
  const { subjectId, upgrade } = verification;
  if (verification.normalised || upgrade === undefined) return { kind: 'success', subjectId };
  return {
    kind: 'success',
    subjectId,
    commit: async () => {
      await upgrade(matched === 'as-typed' ? await hashUserPassword(password) : null);
      return true;
    },
  };
}
