import { describe, expect, it } from 'vitest';
import { findSecrets, type Visible } from './guard.ts';

const clean: Visible = {
  text: 'Clients\nCreate a client',
  fieldValues: ['my-app'],
  passwordFieldsFilled: 0,
  dialogTexts: [],
};

describe('findSecrets', () => {
  it('lets a page of demo data through', () => {
    expect(findSecrets(clean, ['hunter2hunter2'])).toEqual([]);
  });

  it('refuses a page that shows a secret it was given, in text or in a field', () => {
    expect(findSecrets({ ...clean, text: 'pw hunter2hunter2' }, ['hunter2hunter2'])).toHaveLength(
      1,
    );
    expect(
      findSecrets({ ...clean, fieldValues: ['hunter2hunter2'] }, ['hunter2hunter2']),
    ).toHaveLength(1);
  });

  it('refuses a filled password field', () => {
    expect(findSecrets({ ...clean, passwordFieldsFilled: 1 }, [])).toEqual([
      'a password field is filled',
    ]);
  });

  it('refuses an open dialog that shows a one-time password or a client secret', () => {
    const shown = (what: string): string =>
      `${what} This is the only time the ${what} is shown. Copy it and store it.`;
    expect(findSecrets({ ...clean, dialogTexts: [shown('one-time password')] }, [])).toHaveLength(
      1,
    );
    expect(findSecrets({ ...clean, dialogTexts: [shown('client secret')] }, [])).toHaveLength(1);
  });

  it('lets a confirmation dialog through', () => {
    expect(findSecrets({ ...clean, dialogTexts: ['Issue ada a one-time password?'] }, [])).toEqual(
      [],
    );
  });

  it('lets prose through that says a subject has no password: it owes a change', () => {
    const text = 'A subject created here has no password: it owes a password change';
    expect(findSecrets({ ...clean, text }, [])).toEqual([]);
  });

  it('refuses a banner line that carries a password', () => {
    expect(findSecrets({ ...clean, text: ' password: yjNimKOXz2kv' }, [])).toHaveLength(1);
  });
});
