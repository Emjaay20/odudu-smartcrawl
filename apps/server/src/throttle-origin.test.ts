import { describe, expect, it } from 'vitest';
import { throttleOrigin } from '#/throttle-origin';

describe('throttleOrigin', () => {
  it('leaves an IPv4 address as it is', () => {
    expect(throttleOrigin('198.51.100.7')).toBe('198.51.100.7');
  });

  it('keys an IPv4-mapped IPv6 address by the IPv4 address it carries', () => {
    expect(throttleOrigin('::ffff:198.51.100.7')).toBe('198.51.100.7');
    expect(throttleOrigin('::FFFF:C633:6407')).toBe('198.51.100.7');
    expect(throttleOrigin('0:0:0:0:0:ffff:198.51.100.7')).toBe('198.51.100.7');
  });

  it('keys IPv6 by its /64, so every address in one allocation shares a budget', () => {
    const first = throttleOrigin('2001:db8:1:2::1');

    expect(throttleOrigin('2001:db8:1:2:ffff:ffff:ffff:ffff')).toBe(first);
    expect(throttleOrigin('2001:db8:1:2:abcd::9')).toBe(first);
  });

  it('keeps different /64s apart', () => {
    expect(throttleOrigin('2001:db8:1:2::1')).not.toBe(throttleOrigin('2001:db8:1:3::1'));
    expect(throttleOrigin('2001:db8:1:2::1')).not.toBe(throttleOrigin('2001:db9:1:2::1'));
  });

  it('reads every spelling of one address the same way', () => {
    const canonical = throttleOrigin('2001:db8::1');

    expect(throttleOrigin('2001:DB8:0:0:0:0:0:1')).toBe(canonical);
    expect(throttleOrigin('2001:0db8::0001')).toBe(canonical);
    expect(throttleOrigin('2001:db8:0::1')).toBe(canonical);
  });

  it('drops a zone id, which names an interface rather than a host', () => {
    expect(throttleOrigin('fe80::1%eth0')).toBe(throttleOrigin('fe80::1'));
    expect(throttleOrigin('fe80::1%eth0')).toBe(throttleOrigin('fe80::2%en1'));
  });

  it('never lets a v6 /64 key collide with an IPv4 key', () => {
    expect(throttleOrigin('::1')).not.toBe(throttleOrigin('0.0.0.1'));
  });

  it('bounds what it passes through for a value that is no address', () => {
    expect(throttleOrigin('not-an-ip')).toBe('not-an-ip');
    expect(throttleOrigin('x'.repeat(500))).toHaveLength(64);
  });
});
