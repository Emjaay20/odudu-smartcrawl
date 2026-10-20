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

  it('lets the public half of a published key through and refuses a private member', () => {
    const point = randomBytes(32).toString('base64url');
    const jwks = (member: string): string =>
      `{"keys":[{"kty":"EC","crv":"P-256","${member}":"${point}"}]}`;
    expect(point).toHaveLength(43);
    expect(findSecrets({ ...clean, text: jwks('x') }, [])).toEqual([]);
    expect(findSecrets({ ...clean, text: jwks('y') }, [])).toEqual([]);
    expect(findSecrets({ ...clean, text: jwks('n') }, [])).toEqual([]);
    expect(findSecrets({ ...clean, text: jwks('d') }, [])).toHaveLength(1);
  });

  it('refuses every private member of an RSA key, and lets its public half through', () => {
    const value = (): string => randomBytes(128).toString('base64url');
    const member = (name: string): string => `{"kty":"RSA","${name}":"${value()}"}`;
    for (const name of ['d', 'p', 'q', 'dp', 'dq', 'qi']) {
      expect(findSecrets({ ...clean, text: member(name) }, []), name).toHaveLength(1);
    }
    const publicKey = `{"kty":"RSA","n":"${value()}","e":"AQAB"}`;
    expect(findSecrets({ ...clean, text: publicKey }, [])).toEqual([]);
    const privateKey = `{"kty":"RSA","n":"${value()}","e":"AQAB","d":"${value()}","p":"${value()}","q":"${value()}","dp":"${value()}","dq":"${value()}","qi":"${value()}"}`;
    expect(findSecrets({ ...clean, text: privateKey }, []).length).toBeGreaterThan(0);
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

  it('refuses the dialog the console really renders, whose sentence spans text nodes', () => {
    const nodes = JSON.parse(
      readFileSync(path.join(import.meta.dirname, 'fixtures/secret-dialog.json'), 'utf8'),
    ) as string[];
    // Without the secret itself, so only the sentence can be what is refused.
    const text = nodes.filter((node) => !/^[A-Za-z0-9_-]{32,}$/u.test(node)).join('\n');
    expect(text).toContain('This is the only time the \nclient secret\n is shown.');
    expect(findSecrets({ ...clean, text }, [])).toEqual(['the page shows a secret once']);
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
