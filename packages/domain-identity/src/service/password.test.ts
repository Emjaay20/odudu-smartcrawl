import { describe, expect, it } from 'vitest';
import {
  hashPassword,
  hashUserPassword,
  normalisePassword,
  verifyPassword,
  verifyUserPassword,
} from '#/service/password';

describe('[ODUDU-PASSWORD-HASHING-01] password verification', () => {
  it('round-trips a password', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    expect(await verifyPassword(hash, 'correct-horse-battery-staple')).toBe(true);
  });

  it('rejects a wrong password', async () => {
    expect(await verifyPassword(await hashPassword('a'), 'b')).toBe(false);
  });

  it('produces a different hash for the same password each time', async () => {
    expect(await hashPassword('a')).not.toEqual(await hashPassword('a'));
  });

  it('produces an argon2id hash, not argon2i or argon2d', async () => {
    expect(await hashPassword('a')).toMatch(/^\$argon2id\$/);
  });

  it('returns false rather than throwing on a malformed stored hash', async () => {
    expect(await verifyPassword('not-a-hash', 'a')).toBe(false);
  });
});

// RFC 6749 §10.10 excludes credentials intended for end-user use from the
// 2^-128 guessing bound and demands "other means" instead: a human-chosen
// password has too little entropy for the bound to be reachable, so what
// protects it is the cost of each guess against the stored form. The stored
// hash's own parameters are that cost, so they are what is asserted — the
// OWASP Argon2id baseline of m=19456 KiB, t=2, p=1.
describe('[RFC6749-10.10-01] end-user passwords are protected by the stored hash cost', () => {
  const PHC = /^\$argon2id\$v=(\d+)\$m=(\d+),t=(\d+),p=(\d+)\$/u;

  async function parameters(): Promise<{
    version: number;
    memoryKib: number;
    iterations: number;
    parallelism: number;
  }> {
    const stored = await hashPassword('correct-horse-battery-staple');
    const match = PHC.exec(stored);
    if (match === null) throw new Error(`stored hash is not an Argon2id PHC string: ${stored}`);
    const group = (i: number): number => {
      const raw = match[i];
      if (raw === undefined) throw new Error(`capture group ${String(i)} is missing`);
      return Number(raw);
    };
    return {
      version: group(1),
      memoryKib: group(2),
      iterations: group(3),
      parallelism: group(4),
    };
  }

  it('stores 19456 KiB of memory cost', async () => {
    expect((await parameters()).memoryKib).toBe(19456);
  });

  it('stores 2 iterations', async () => {
    expect((await parameters()).iterations).toBe(2);
  });

  it('stores a parallelism of 1', async () => {
    expect((await parameters()).parallelism).toBe(1);
  });

  it('stores the current Argon2 version, 0x13', async () => {
    expect((await parameters()).version).toBe(19);
  });

  it('carries a salt and a digest of the lengths Argon2id defaults to', async () => {
    const stored = await hashPassword('correct-horse-battery-staple');
    const [, , , , salt, digest] = stored.split('$');
    expect(Buffer.from(salt ?? '', 'base64').byteLength).toBe(16);
    expect(Buffer.from(digest ?? '', 'base64').byteLength).toBe(32);
  });
});

// A password is hashed in its NFC form, so a name typed composed or
// decomposed is one password. Hashes stored before that were made from the
// raw bytes, which is why verifying falls back to the form as typed.
describe('user passwords are NFC-normalised', () => {
  const composed = 'café au lait 123';
  const decomposed = 'café au lait 123';

  it('hashes the composed and decomposed forms to one password', async () => {
    const hash = await hashUserPassword(decomposed);
    expect(await verifyUserPassword(hash, composed)).toBe(true);
    expect(await verifyUserPassword(hash, decomposed)).toBe(true);
    expect(await verifyPassword(hash, composed)).toBe(true);
  });

  it('still accepts a hash made from the decomposed bytes before normalising', async () => {
    const legacy = await hashPassword(decomposed);
    expect(await verifyUserPassword(legacy, decomposed)).toBe(true);
  });

  it('does not accept the composed form for a legacy decomposed hash', async () => {
    const legacy = await hashPassword(decomposed);
    expect(await verifyUserPassword(legacy, composed)).toBe(false);
  });

  it('rejects a different password', async () => {
    expect(await verifyUserPassword(await hashUserPassword(composed), 'other')).toBe(false);
  });

  it('leaves a client secret or recovery code as typed', async () => {
    const hash = await hashPassword(decomposed);
    expect(await verifyPassword(hash, composed)).toBe(false);
  });

  it('normalises to NFC', () => {
    expect(normalisePassword(decomposed)).toBe(composed);
  });
});
