import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { findSecrets, type Visible } from './guard.ts';

const clean: Visible = {
  text: 'Clients\nCreate a client\nodudu-admin 0199aa00-0000-7000-8000-000000000001',
  attributes: ['/console/demo/clients', 'Signed in'],
  fieldValues: ['my-app'],
  passwordFieldsFilled: 0,
};

// The shapes the server really generates: 24 random bytes, base64url.
const oneTimePassword = (): string => randomBytes(24).toString('base64url');

describe('findSecrets', () => {
  it('lets a page of demo data through, ids and long paths included', () => {
    expect(findSecrets(clean, ['hunter2hunter2'])).toEqual([]);
  });

  it('refuses a value it was given, in text, an attribute or a field', () => {
    const given = 'admin@real.example';
    expect(findSecrets({ ...clean, text: `Signed in as ${given}` }, [given])).toHaveLength(1);
    expect(findSecrets({ ...clean, attributes: [given] }, [given])).toHaveLength(1);
    expect(findSecrets({ ...clean, fieldValues: [given] }, [given])).toHaveLength(1);
  });

  it('lets a component identifier through, which is words joined by hyphens', () => {
    const attributes = ['react-aria-description-for-the-combo-box-field-label', 'a'.repeat(40)];
    expect(findSecrets({ ...clean, attributes }, [])).toEqual([]);
  });

  it('refuses a filled password field', () => {
    expect(findSecrets({ ...clean, passwordFieldsFilled: 1 }, [])).toEqual([
      'a password field is filled',
    ]);
  });

  it('refuses a one-time password or client secret wherever it is rendered', () => {
    const secret = oneTimePassword();
    expect(secret).toHaveLength(32);
    expect(findSecrets({ ...clean, text: `toast ${secret}` }, [])).toHaveLength(1);
    expect(findSecrets({ ...clean, attributes: [secret] }, [])).toHaveLength(1);
    expect(findSecrets({ ...clean, fieldValues: [secret] }, [])).toHaveLength(1);
  });

  it("refuses the console's shown-once sentence outside a dialog", () => {
    const text = 'This is the only time the one-time password is shown.';
    expect(findSecrets({ ...clean, text }, [])).toHaveLength(1);
  });

  it('matches the sentence the console really renders', () => {
    const source = readFileSync(
      path.resolve(
        import.meta.dirname,
        '../../../admin-console/src/shared/view/SecretDialog/SecretDialog.tsx',
      ),
      'utf8',
    );
    const rendered = /This is the only time the \{label\} is shown\./u.exec(
      source.replace(/\s+/gu, ' '),
    );
    expect(rendered).not.toBeNull();
    const text = 'This is the only time the client secret is shown.';
    expect(findSecrets({ ...clean, text }, [])).toHaveLength(1);
  });

  it('lets a confirmation question through', () => {
    const text = 'Issue ada a one-time password? This replaces the password ada has.';
    expect(findSecrets({ ...clean, text }, [])).toEqual([]);
  });

  it('lets prose through that says a subject has no password: it owes a change', () => {
    const text = 'A subject created here has no password: it owes a password change';
    expect(findSecrets({ ...clean, text }, [])).toEqual([]);
  });

  it('refuses a banner line that carries a password', () => {
    expect(findSecrets({ ...clean, text: ` password: ${oneTimePassword()}` }, [])).not.toEqual([]);
  });
});
