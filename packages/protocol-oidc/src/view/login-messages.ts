import { type MessageId } from '#/view/messages';
import { type LoginRefusal } from '#/usecase/login-submission';

// One message per step, whatever the cause: a wrong password, an unknown
// name, a locked or disabled account and a failed passkey all read alike, so
// the page is no oracle for which accounts exist. Each constant is the ID of
// a catalogue message, which the page formats in the person's language.
export const SIGN_IN_FAILED = 'login.refusal.signInFailed' satisfies MessageId;
export const CODE_FAILED = 'login.refusal.codeFailed' satisfies MessageId;
export const RECOVERY_CODE_FAILED = 'login.refusal.recoveryCodeFailed' satisfies MessageId;

// Said only of a code this very attempt already holds the list for, so it
// tells the person nothing about which codes exist.
export const ALREADY_USED_RECOVERY_CODE =
  'login.refusal.alreadyUsedRecoveryCode' satisfies MessageId;

export type RefusalMessageId =
  | typeof SIGN_IN_FAILED
  | typeof CODE_FAILED
  | typeof RECOVERY_CODE_FAILED
  | typeof ALREADY_USED_RECOVERY_CODE;

export function refusalMessage(form: string, refusal: LoginRefusal): RefusalMessageId {
  if (refusal === 'already_used') return ALREADY_USED_RECOVERY_CODE;
  if (form === 'otp') return CODE_FAILED;
  if (form === 'recovery-code') return RECOVERY_CODE_FAILED;
  return SIGN_IN_FAILED;
}
