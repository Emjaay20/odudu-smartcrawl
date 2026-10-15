import { describe, expect, it } from 'vitest';
import { maskAddress, maskIn } from '#/usecase/mail';

const ADDRESS = 'ada.lovelace@example.com';

describe('maskIn', () => {
  it('masks the whole address in any case', () => {
    expect(maskIn(`550 no such user ${ADDRESS.toUpperCase()}`, ADDRESS)).toBe(
      `550 no such user ${maskAddress(ADDRESS)}`,
    );
  });

  it('masks the local part against another domain', () => {
    expect(maskIn('rejected ada.lovelace@mx.other.test', ADDRESS)).toBe(
      'rejected a***@mx.other.test',
    );
  });

  it('masks the address percent-encoded, in either case and either form', () => {
    expect(
      maskIn('see https://relay.test/bounce?to=ada.lovelace%40example.com', ADDRESS),
    ).not.toMatch(/lovelace/iu);
    expect(maskIn('to=ada.lovelace%40EXAMPLE.com', ADDRESS)).not.toMatch(/lovelace/iu);
    expect(maskIn('to=ada.lovelace%40example.com', ADDRESS)).not.toContain('%40example');
  });

  it('masks a bare local part set among punctuation, and not a longer word that holds it', () => {
    expect(maskIn('mailbox "ada.lovelace" is full.', ADDRESS)).not.toContain('lovelace');
    expect(maskIn('user=ada.lovelace;', ADDRESS)).not.toContain('lovelace');
    expect(maskIn('mailbox ada.lovelace.', ADDRESS)).not.toContain('lovelace');
    expect(maskIn('the adalovelace queue', ADDRESS)).toBe('the adalovelace queue');
  });

  it('leaves a very short local part to the address forms, so common words stay readable', () => {
    expect(maskIn('a mailbox a@example.com is full', 'a@example.com')).toBe(
      'a mailbox a***@example.com is full',
    );
  });

  it('is a no-op for text that does not mention the recipient', () => {
    expect(maskIn('connection timed out', ADDRESS)).toBe('connection timed out');
  });
});
