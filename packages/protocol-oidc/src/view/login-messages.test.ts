import { describe, expect, it } from 'vitest';
import {
  ALREADY_USED_RECOVERY_CODE,
  CODE_FAILED,
  RECOVERY_CODE_FAILED,
  refusalMessage,
  SIGN_IN_FAILED,
} from '#/view/login-messages';
import { en, t } from '#/view/messages';
import { DEFAULT_PAGE_LOCALE } from '@odudu/kernel';

describe('refusalMessage', () => {
  it('names one message per step, whatever the cause: the same id for every rejection', () => {
    for (const form of ['password', 'otp', 'recovery-code', 'something-new']) {
      const id = refusalMessage(form, 'rejected');
      expect([SIGN_IN_FAILED, CODE_FAILED, RECOVERY_CODE_FAILED]).toContain(id);
      expect(t(DEFAULT_PAGE_LOCALE, id)).not.toMatch(
        /exist|locked|disabled|unknown|not found|too many/iu,
      );
    }
  });

  it('asks about the code on a second-factor form and about the details on the first', () => {
    expect(refusalMessage('password', 'rejected')).toBe(SIGN_IN_FAILED);
    expect(refusalMessage('something-new', 'rejected')).toBe(SIGN_IN_FAILED);
    expect(refusalMessage('otp', 'rejected')).toBe(CODE_FAILED);
    expect(refusalMessage('recovery-code', 'rejected')).toBe(RECOVERY_CODE_FAILED);
  });

  it('keeps the wording of each message under a stable id', () => {
    expect(SIGN_IN_FAILED).toBe('login.refusal.signInFailed');
    expect(en[SIGN_IN_FAILED]).toBe('Sign-in failed. Check your details and try again.');
    expect(en[CODE_FAILED]).toBe('That code did not work. Check it and try again.');
    expect(en[RECOVERY_CODE_FAILED]).toBe(
      'That recovery code did not work. Check it and try again.',
    );
  });

  it('keeps the actionable message for a spent recovery code', () => {
    expect(refusalMessage('otp', 'already_used')).toBe(ALREADY_USED_RECOVERY_CODE);
    expect(refusalMessage('password', 'already_used')).toBe(ALREADY_USED_RECOVERY_CODE);
    expect(en[ALREADY_USED_RECOVERY_CODE]).toContain('already used that recovery code');
  });
});
