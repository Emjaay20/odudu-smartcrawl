export interface Visible {
  readonly text: string;
  readonly fieldValues: readonly string[];
  readonly passwordFieldsFilled: number;
  readonly dialogTexts: readonly string[];
}

// SecretDialog's own sentence: the console shows a secret in no other dialog.
const SECRET_DIALOG = /only time the .+ is shown/iu;
// The setup banner's form: the word, a colon and a token alone on its line.
const PASSWORD_LINE = /^\s*password:\s*[A-Za-z0-9_-]{12,}\s*$/imu;

/**
 * What would put a real secret into a capture. A capture shows demo data
 * only, so a page holding the administrator's password, a typed password, an
 * open dialog that shows a one-time secret, or a banner line carrying a
 * password is refused rather than shot.
 */
export function findSecrets(visible: Visible, known: readonly string[]): string[] {
  const found: string[] = [];
  const typed = [visible.text, ...visible.fieldValues];
  for (const secret of known) {
    if (secret !== '' && typed.some((value) => value.includes(secret))) {
      found.push('the page shows a secret it was given');
    }
  }
  if (visible.passwordFieldsFilled > 0) found.push('a password field is filled');
  if (visible.dialogTexts.some((text) => SECRET_DIALOG.test(text))) {
    found.push('a dialog shows a one-time secret');
  }
  if (PASSWORD_LINE.test(visible.text)) found.push('a line shows a password');
  return found;
}
