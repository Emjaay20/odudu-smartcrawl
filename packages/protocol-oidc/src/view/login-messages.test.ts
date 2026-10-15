import { describe, expect, it } from 'vitest';
import { ALREADY_USED_RECOVERY_CODE, refusalMessage } from '#/view/login-messages';

describe('refusalMessage', () => {
  it('says the same thing for every cause a step can have, naming no cause', () => {
    for (const form of ['password', 'otp', 'recovery-code', 'something-new']) {
      const message = refusalMessage(form, 'rejected');
      expect(message).not.toMatch(/exist|locked|disabled|unknown|not found|too many/iu);
    }
  });

  it('asks about the code on a second-factor form and about the details on the first', () => {
    expect(refusalMessage('password', 'rejected')).toBe(
      'Sign-in failed. Check your details and try again.',
    );
    expect(refusalMessage('otp', 'rejected')).toBe(
      'That code did not work. Check it and try again.',
    );
    expect(refusalMessage('recovery-code', 'rejected')).toBe(
      'That recovery code did not work. Check it and try again.',
    );
  });

  it('keeps the actionable message for a spent recovery code', () => {
    expect(refusalMessage('otp', 'already_used')).toBe(ALREADY_USED_RECOVERY_CODE);
    expect(ALREADY_USED_RECOVERY_CODE).toContain('already used that recovery code');
  });
});
