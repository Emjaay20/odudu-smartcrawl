import assert from 'node:assert/strict';
import { test } from 'node:test';
import { expiryOf } from './src/expiry.ts';

const jwt = (claims: unknown) =>
  `header.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`;

test('reads exp from a JWT access token', () => {
  assert.equal(expiryOf(jwt({ exp: 1_800_000_000 }))?.toISOString(), '2027-01-15T08:00:00.000Z');
});

test('gives no time for an opaque token, a missing exp or one that is not a number', () => {
  for (const token of [
    'opaque-reference-token',
    '',
    'a.b.c',
    jwt({}),
    jwt({ exp: 'soon' }),
    jwt(null),
    jwt('text'),
  ]) {
    assert.equal(expiryOf(token), undefined, token);
  }
});
