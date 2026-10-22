import { hashPassword, hashUserPassword, verifyPassword } from '@odudu/domain-identity';
import { describe, expect, it } from 'vitest';
import { passwordStep } from '#/service/authenticators/password';

const decomposed = 'café au lait, deux sucres';

function counting() {
  let calls = 0;
  return {
    verify: (stored: string, plain: string) => {
      calls += 1;
      return verifyPassword(stored, plain);
    },
    calls: () => calls,
  };
}

describe('passwordStep and the second verification', () => {
  it('does one verification for a row marked normalised, right or wrong, however it was typed', async () => {
    const storedHash = await hashUserPassword(decomposed);
    const count = counting();
    const wrong = await passwordStep(
      { username: 'ada', password: 'anotheŕ password' },
      { subjectId: 's', storedHash, normalised: true },
      count.verify,
    );
    expect(wrong.kind).toBe('failure');
    expect(count.calls()).toBe(1);
  });

  it('does one verification for an unknown account, as for a marked one', async () => {
    const count = counting();
    const unknown = await passwordStep(
      { username: 'nobody', password: 'anotheŕ password' },
      { subjectId: null, storedHash: null, normalised: true },
      count.verify,
    );
    expect(unknown.kind).toBe('failure');
    expect(count.calls()).toBe(1);
  });

  it('tries the typed form too for a row that predates normalising, and asks for its upgrade', async () => {
    const storedHash = await hashPassword(decomposed);
    const count = counting();
    const upgrades: (string | null)[] = [];
    const result = await passwordStep(
      { username: 'ada', password: decomposed },
      {
        subjectId: 's',
        storedHash,
        normalised: false,
        upgrade: (hash) => {
          upgrades.push(hash);
          return Promise.resolve();
        },
      },
      count.verify,
    );
    expect(count.calls()).toBe(2);
    expect(result.kind).toBe('success');
    if (result.kind !== 'success') throw new Error('not a success');
    expect(upgrades).toEqual([]);
    expect(await result.commit?.()).toBe(true);
    expect(upgrades).toHaveLength(1);
    expect(await verifyPassword(upgrades[0] ?? '', 'café au lait, deux sucres')).toBe(true);
  });
});
