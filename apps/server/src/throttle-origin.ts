import { isIPv4, isIPv6 } from 'node:net';

const MAX_PASSTHROUGH_LENGTH = 64;

function hextets(address: string): number[] {
  const [head = '', tail] = address.split('::');
  const read = (part: string): number[] => (part === '' ? [] : part.split(':').flatMap(hextetsOf));
  const front = read(head);
  if (tail === undefined) return front;
  const back = read(tail);
  return [...front, ...Array.from({ length: 8 - front.length - back.length }, () => 0), ...back];
}

// An embedded dotted quad stands for the last two hextets.
function hextetsOf(group: string): number[] {
  if (!group.includes('.')) return [Number.parseInt(group, 16)];
  const [a = 0, b = 0, c = 0, d = 0] = group.split('.').map(Number);
  return [a * 256 + b, c * 256 + d];
}

/**
 * The key a client address is throttled under. IPv6 is keyed by its /64,
 * because one home or hosting allocation is a /64 holding 2^64 addresses
 * and an attacker inside it would otherwise get a fresh budget per
 * address. An IPv4-mapped address is the IPv4 address it carries, which is
 * how a dual-stack listener reports every IPv4 peer. Anything that is no
 * address at all — `X-Forwarded-For` is client text when the proxy appends
 * rather than overwrites — passes through, cut to a bounded length.
 */
export function throttleOrigin(ip: string): string {
  const address = ip.split('%')[0]?.toLowerCase() ?? '';
  if (isIPv4(address)) return address;
  if (!isIPv6(address)) return ip.slice(0, MAX_PASSTHROUGH_LENGTH);

  const groups = hextets(address);
  const mapped = groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff;
  if (mapped) {
    const [high = 0, low = 0] = groups.slice(6);
    return `${String(high >> 8)}.${String(high & 0xff)}.${String(low >> 8)}.${String(low & 0xff)}`;
  }
  return `${groups
    .slice(0, 4)
    .map((group) => group.toString(16))
    .join(':')}::/64`;
}
