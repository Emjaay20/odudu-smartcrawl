// What this refuses is a short list of known shapes, not a proof that a page
// holds no secret: the given strings, a filled password field, the console's
// own "shown once" sentence, a token the length and alphabet of a generated
// one-time password or client secret, and the setup banner's password line.
// A green capture means none of those appeared; read the sidecar record
// beside each image for what the page held.
export interface Visible {
  // Every text node, hidden ones included.
  readonly text: string;
  // Every attribute value on the page.
  readonly attributes: readonly string[];
  readonly fieldValues: readonly string[];
  readonly passwordFieldsFilled: number;
}

// SecretDialog's own sentence, wherever it is rendered (a dialog, a toast, a panel).
const SHOWN_ONCE = /only time the .+ is shown/iu;
const PASSWORD_LINE = /^\s*password:\s*[A-Za-z0-9_-]{12,}\s*$/imu;
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/giu;
// 24 random bytes as base64url, which is what a one-time password is.
const GENERATED = /(?<![A-Za-z0-9_-])[A-Za-z0-9_-]{32,}(?![A-Za-z0-9_-])/u;

// Random base64url mixes cases and digits and hardly ever holds many hyphens;
// an identifier such as a component id is words joined by hyphens.
function looksRandom(token: string): boolean {
  return (
    /\d/u.test(token) &&
    /[A-Z]/u.test(token) &&
    /[a-z]/u.test(token) &&
    token.split('-').length <= 4
  );
}

export function findSecrets(visible: Visible, known: readonly string[]): string[] {
  const found: string[] = [];
  const surfaces = [visible.text, ...visible.attributes, ...visible.fieldValues];
  for (const secret of known) {
    if (secret !== '' && surfaces.some((value) => value.includes(secret))) {
      found.push('the page shows a value it was given to refuse');
    }
  }
  if (visible.passwordFieldsFilled > 0) found.push('a password field is filled');
  if (SHOWN_ONCE.test(visible.text)) found.push('the page shows a secret once');
  if (PASSWORD_LINE.test(visible.text)) found.push('a line shows a password');
  for (const value of surfaces) {
    const token = GENERATED.exec(value.replaceAll(UUID, ''))?.[0];
    if (token !== undefined && looksRandom(token)) {
      found.push(
        `a token the shape of a generated secret is on the page (${token.slice(0, 4)}…, ${String(token.length)} characters)`,
      );
    }
  }
  return found;
}
