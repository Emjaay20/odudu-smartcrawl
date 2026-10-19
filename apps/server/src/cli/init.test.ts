import { describe, expect, it } from 'vitest';
import { adminPasswordFromEnv, scramVerifier } from '#/cli/init';

describe('adminPasswordFromEnv', () => {
  it('treats an empty value as unset, as a blank compose default leaves it', () => {
    expect(adminPasswordFromEnv({ ODUDU_ADMIN_PASSWORD: '' })).toBeUndefined();
    expect(adminPasswordFromEnv({})).toBeUndefined();
    expect(adminPasswordFromEnv({ ODUDU_ADMIN_PASSWORD: 'x' })).toBe('x');
  });
});

// The server key and stored key follow RFC 5802 section 3; a verifier built
// wrongly is refused by Postgres at connection time, which init.int.test.ts
// exercises by signing in as the service role.
describe('scramVerifier', () => {
  it('has the shape Postgres stores for SCRAM-SHA-256', () => {
    const salt = Buffer.from('W22ZaJ0SNY7soEsUEjb6gQ==', 'base64');

    expect(scramVerifier('pencil', salt, 4096)).toBe(
      'SCRAM-SHA-256$4096:W22ZaJ0SNY7soEsUEjb6gQ==$' +
        'WG5d8oPm3OtcPnkdi4Uo7BkeZkBFzpcXkuLmtbsT4qY=:' +
        'wfPLwcE6nTWhTAmQ7tl2KeoiWGPlZqQxSrmfPwDl2dU=',
    );
  });
});
