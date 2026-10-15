import { type LoginRefusal } from '#/usecase/login-submission';

// One message per step, whatever the cause: a wrong password, an unknown
// name, a locked or disabled account and a failed passkey all read alike, so
// the page is no oracle for which accounts exist.
export const SIGN_IN_FAILED = 'Sign-in failed. Check your details and try again.';
export const CODE_FAILED = 'That code did not work. Check it and try again.';
export const RECOVERY_CODE_FAILED = 'That recovery code did not work. Check it and try again.';

// Said only of a code this very attempt already holds the list for, so it
// tells the person nothing about which codes exist.
export const ALREADY_USED_RECOVERY_CODE =
  'You have already used that recovery code. Try another one from your list.';

export function refusalMessage(form: string, refusal: LoginRefusal): string {
  if (refusal === 'already_used') return ALREADY_USED_RECOVERY_CODE;
  if (form === 'otp') return CODE_FAILED;
  if (form === 'recovery-code') return RECOVERY_CODE_FAILED;
  return SIGN_IN_FAILED;
}
