// NIST SP 800-63B-4 section 3.1.1.2: fifteen characters when the password is
// the only factor, eight when it is one of two. Whether every sign-in has a
// second factor is what the tenant's `otp_required` says.
export const PASSWORD_ALONE_MIN_LENGTH = 15;
export const PASSWORD_WITH_SECOND_FACTOR_MIN_LENGTH = 8;

export type PasswordConformance =
  'conforms' | 'conforms_with_second_factor' | 'needs_second_factor';

// A hint, never a refusal: the settings API accepts any length in its range
// whatever this answers.
export function passwordConformance(
  minLength: number,
  secondFactorRequired: boolean,
): PasswordConformance {
  if (minLength >= PASSWORD_ALONE_MIN_LENGTH) return 'conforms';
  if (secondFactorRequired && minLength >= PASSWORD_WITH_SECOND_FACTOR_MIN_LENGTH) {
    return 'conforms_with_second_factor';
  }
  return 'needs_second_factor';
}
